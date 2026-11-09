import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createPosSale, openShift } from "@/actions/pos";
import { findReturnableOrder, processReturn } from "@/actions/returns";
import { transitionOrder } from "@/lib/orders";
import { formatOrderNumber } from "@/lib/utils";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";

const ref = () => `test-${Math.random().toString(36).slice(2, 12)}`;

describe("store returns", () => {
  beforeEach(resetDb);

  async function sold(opts: { qty?: number; discountPct?: number } = {}) {
    const p = await makeProduct({ price: 2000, cost: 900, stock: { M: 10, L: 10 } });
    const owner = await makeUser("ADMIN");
    actAs(owner);
    await openShift(5000);
    const qty = opts.qty ?? 2;
    const sub = 200_000 * qty;
    const disc = opts.discountPct ? Math.floor((sub * opts.discountPct) / 100 / 100) * 100 : 0;
    const r = await createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: qty }], discount: disc ? { type: "PERCENT", value: opts.discountPct!, reason: "Promo" } : null, tenders: [{ method: "CASH", amount: sub - disc }] });
    if (!r.ok) throw new Error(r.error);
    const order = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { items: true } });
    return { p, owner, order };
  }

  it("cashiers need a manager PIN; refunds reflect the discount actually paid", async () => {
    const { order } = await sold({ qty: 2, discountPct: 10 });
    const manager = await makeUser("MANAGER", { pin: "2580" });
    const cashier = await makeUser("CASHIER");
    actAs(cashier);
    await openShift(5000);
    const base = { orderId: order.id, lines: [{ orderItemId: order.items[0].id, quantity: 1, condition: "RESELLABLE" as const }], reason: "Size too small", refundMethod: "CASH" as const };
    expect((await processReturn({ ...base, clientRef: ref() })).ok).toBe(false);
    const r = await processReturn({ ...base, clientRef: ref(), approverPin: "2580" });
    expect(r).toMatchObject({ ok: true, refund: 180_000 }); // Rs 2,000 less 10%
    expect((await db.return.findFirstOrThrow()).approvedById).toBe(manager.id);
  });

  it("restocks good items, quarantines damaged ones, and never over-returns", async () => {
    const { order, p } = await sold({ qty: 2 });
    const line = order.items[0].id;
    const r1 = await processReturn({ clientRef: ref(), orderId: order.id, lines: [{ orderItemId: line, quantity: 1, condition: "DAMAGED" }], reason: "Defect", refundMethod: "STORE_CREDIT" });
    expect(r1.ok).toBe(true);
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(8); // damaged not restocked
    expect(r1.ok && r1.voucherCode).toMatch(/^CR-/);
    const voucher = await db.coupon.findFirstOrThrow({ where: { isCredit: true } });
    expect(voucher.value).toBe(200_000);

    const over = await processReturn({ clientRef: ref(), orderId: order.id, lines: [{ orderItemId: line, quantity: 2, condition: "RESELLABLE" }], reason: "x", refundMethod: "CASH" });
    expect(over.ok).toBe(false);

    const r2 = await processReturn({ clientRef: ref(), orderId: order.id, lines: [{ orderItemId: line, quantity: 1, condition: "RESELLABLE" }], reason: "Changed mind", refundMethod: "CASH" });
    expect(r2.ok).toBe(true);
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(9);
    // fully returned → order closes as returned & refunded
    expect(await db.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: "RETURNED", paymentStatus: "REFUNDED" });
    const lookup = await findReturnableOrder(formatOrderNumber(order.number));
    expect(lookup.ok).toBe(false);
  });

  it("an admin RETURNED transition restocks only units not already returned at the till", async () => {
    const p = await makeProduct({ price: 1000, stock: { M: 10 } });
    const owner = await makeUser("ADMIN");
    actAs(owner);
    await openShift(0);
    // an online order for 3 units, delivered
    const order = await db.order.create({
      data: {
        email: "c@test.local", phone: "9841234567", status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "COD", subtotal: 300_000, total: 300_000, shippingMethod: "standard", shippingAddress: {},
        items: { create: [{ variantId: p.variants[0].id, productId: p.id, name: p.name, slug: p.slug, sku: p.variants[0].sku, color: "White", size: "M", image: "", unitPrice: 100_000, quantity: 3 }] },
      },
      include: { items: true },
    });
    await db.variant.update({ where: { id: p.variants[0].id }, data: { stock: 7 } });
    await processReturn({ clientRef: ref(), orderId: order.id, lines: [{ orderItemId: order.items[0].id, quantity: 1, condition: "RESELLABLE" }], reason: "Size", refundMethod: "CASH" });
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(8);
    await transitionOrder({ orderId: order.id, to: "RETURN_REQUESTED", actor: "test" });
    await transitionOrder({ orderId: order.id, to: "RETURNED", actor: "test" });
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(10); // +2, not +3
  });
});

describe("order state machine (transitionOrder)", () => {
  beforeEach(resetDb);

  it("rejects illegal moves and restocks on cancel exactly once under concurrency", async () => {
    const p = await makeProduct({ stock: { M: 5 } });
    const order = await db.order.create({
      data: {
        email: "c@test.local", phone: "9841234567", paymentMethod: "COD", subtotal: 200_000, total: 200_000, shippingMethod: "standard", shippingAddress: {},
        items: { create: [{ variantId: p.variants[0].id, productId: p.id, name: p.name, slug: p.slug, sku: "x", color: "W", size: "M", image: "", unitPrice: 100_000, quantity: 2 }] },
      },
    });
    await expect(transitionOrder({ orderId: order.id, to: "DELIVERED", actor: "t" })).rejects.toThrow(/Can't move/);
    const results = await Promise.allSettled([1, 2, 3].map(() => transitionOrder({ orderId: order.id, to: "CANCELLED", actor: "t" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(7);
  });
});
