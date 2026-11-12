import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createExchange, exchangeFit, exchangeOptions, exchangesDesk, receiveExchange } from "@/lib/exchanges";
import { transitionOrder } from "@/lib/orders";
import { profitAndLoss } from "@/lib/finance";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

describe("online size exchanges", () => {
  let staff: U, wh: L, p: Awaited<ReturnType<typeof makeProduct>>;
  beforeEach(async () => {
    await resetDb();
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    staff = await makeUser("STAFF", { name: "Desk", locations: [wh.id] });
    p = await makeProduct({ price: 2000, cost: 800, stock: { S: 5, M: 5, L: 0 }, at: wh.id });
    await db.store.update({ where: { id: wh.id }, data: { shipsOnline: true } });
  });
  const v = (size: string) => p.variants.find((x) => x.size === size)!;
  const stockAt = async (size: string) => (await db.storeStock.findUnique({ where: { storeId_variantId: { storeId: wh.id, variantId: v(size).id } } }))?.quantity ?? 0;
  /** a delivered online order for 2 × S (stock taken at allocation, as checkout does) */
  const delivered = async (daysAgo = 2) => {
    const o = await db.order.create({ data: { email: "g@t.l", phone: "9811111111", status: "DELIVERED", paymentMethod: "COD", paymentStatus: "PAID", subtotal: 400000, total: 400000, shippingMethod: "standard", channel: "ONLINE",
      shippingAddress: { fullName: "Gita Rai", phone: "9811111111", line1: "Ward 4", city: "Dharan", district: "Sunsari" },
      items: { create: [{ variantId: v("S").id, productId: p.id, name: p.name, slug: p.slug, sku: v("S").sku, color: v("S").color, size: "S", image: "", unitPrice: 200000, unitCost: 80000, quantity: 2 }] },
      events: { create: [{ status: "DELIVERED", message: "Delivered", actor: "x", createdAt: new Date(Date.now() - daysAgo * 86_400_000) }] } }, include: { items: true } });
    await db.storeStock.update({ where: { storeId_variantId: { storeId: wh.id, variantId: v("S").id } }, data: { quantity: { decrement: 2 } } });
    return o;
  };

  it("offers other sizes in stock (same colour) within the window; refuses outside it, shop sales and undelivered orders", async () => {
    const o = await delivered();
    const opts = (await exchangeOptions(o.id))!;
    expect(opts.blocked).toBeNull();
    expect(opts.items).toEqual([{ orderItemId: o.items[0].id, name: p.name, color: v("S").color, size: "S", left: 2, sizes: [{ variantId: v("M").id, size: "M", stock: 5 }] }]); // L has no stock
    expect((await exchangeOptions((await delivered(10)).id))!.blocked).toMatch(/7-day exchange window has closed/);
    await db.order.update({ where: { id: o.id }, data: { channel: "STORE" } });
    expect((await exchangeOptions(o.id))!.blocked).toMatch(/exchanged at the shop/);
  });

  it("an exchange: a free confirmed replacement order with the new size reserved, the customer told, and the old items owed back", async () => {
    const o = await delivered();
    const before = await stockAt("M");
    await expect(tx((t) => createExchange(t, { orderId: o.id, lines: [{ orderItemId: o.items[0].id, quantity: 3, newVariantId: v("M").id }], reason: "", actor: "g@t.l" }))).rejects.toThrow(/only 2 can be exchanged/);
    await expect(tx((t) => createExchange(t, { orderId: o.id, lines: [{ orderItemId: o.items[0].id, quantity: 1, newVariantId: v("L").id }], reason: "", actor: "g@t.l" }))).rejects.toThrow(/that size isn't available/);
    const { exchange, replacement } = await tx((t) => createExchange(t, { orderId: o.id, lines: [{ orderItemId: o.items[0].id, quantity: 1, newVariantId: v("M").id }], reason: "Size too small", actor: "g@t.l" }));
    expect(await stockAt("M")).toBe(before - 1);
    const r = await db.order.findUniqueOrThrow({ where: { id: replacement.id }, include: { items: true, notifications: true, events: true } });
    expect([r.status, r.paymentStatus, r.total, r.subtotal, r.discount, r.shippingFee, r.channel]).toEqual(["CONFIRMED", "PAID", 0, 200000, 200000, 0, "ONLINE"]);
    expect(r.items.map((i) => [i.size, i.quantity, i.unitPrice, i.unitCost])).toEqual([["M", 1, 200000, 80000]]);
    expect(r.notifications[0]).toMatchObject({ template: "exchange" });
    expect(r.events[0].message).toBe(`Exchange for AS${String(o.number).padStart(6, "0")}: ${p.name} S → M`);
    expect((await exchangeOptions(o.id))!.items[0].left).toBe(1); // one more S can still be swapped
    // returns are blocked on both orders now
    await expect(transitionOrder({ orderId: o.id, to: "RETURN_REQUESTED", actor: "g@t.l" })).rejects.toThrow(/exchanged again but not returned/);
    expect(exchange.status).toBe("OPEN");
  });

  it("receiving the old items: back on sale (or quarantined), a zero-refund return, the original stays delivered, and profit is counted once", async () => {
    const o = await delivered();
    const { exchange, replacement } = await tx((t) => createExchange(t, { orderId: o.id, lines: [{ orderItemId: o.items[0].id, quantity: 2, newVariantId: v("M").id }], reason: "", actor: "g@t.l" }));
    await expect(tx((t) => receiveExchange(t, staff, { ref: `EX-${exchange.number}`, storeId: wh.id, conditions: {} }))).rejects.toThrow(/hasn't gone out yet/);
    await db.order.update({ where: { id: replacement.id }, data: { status: "DELIVERED" } });
    const sBefore = await stockAt("S");
    const item = await db.exchangeItem.findFirstOrThrow({ where: { exchangeId: exchange.id } });
    expect(await tx((t) => receiveExchange(t, staff, { ref: `AS${o.number}`, storeId: wh.id, conditions: { [item.id]: "RESELLABLE" } }))).toEqual({ number: exchange.number, damaged: 0 });
    expect(await stockAt("S")).toBe(sBefore + 2);
    const ret = await db.return.findFirstOrThrow({ where: { orderId: o.id }, include: { items: true } });
    expect([ret.refundMethod, ret.refundAmount, ret.items[0].quantity, ret.items[0].amount, ret.storeId]).toEqual(["EXCHANGE", 0, 2, 0, wh.id]); // received here
    const orig = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect([orig.status, orig.paymentStatus]).toEqual(["DELIVERED", "PAID"]);
    expect((await db.exchange.findUniqueOrThrow({ where: { id: exchange.id } })).status).toBe("DONE");
    await expect(tx((t) => receiveExchange(t, staff, { ref: `EX-${exchange.number}`, storeId: wh.id, conditions: {} }))).rejects.toThrow(/already received/);

    // P&L: revenue Rs 4,000 once; cost of 2 units once (2 out on the original + 2 out on the replacement − 2 back)
    const start = new Date(Date.now() - 86_400_000), end = new Date(Date.now() + 86_400_000);
    const pl = await profitAndLoss(start, end, "", "");
    expect([pl.netSales, pl.refunds]).toEqual([400000, 0]);
    expect(pl.cogs).toBe(160000);
  });

  it("damaged old items are quarantined; a replacement that never arrives cancels the exchange and frees the units to swap again", async () => {
    const o = await delivered();
    const a = await tx((t) => createExchange(t, { orderId: o.id, lines: [{ orderItemId: o.items[0].id, quantity: 1, newVariantId: v("M").id }], reason: "", actor: "g@t.l" }));
    await db.order.update({ where: { id: a.replacement.id }, data: { status: "SHIPPED" } });
    const it = await db.exchangeItem.findFirstOrThrow({ where: { exchangeId: a.exchange.id } });
    const sBefore = await stockAt("S");
    await tx((t) => receiveExchange(t, staff, { ref: `EX-${a.exchange.number}`, storeId: wh.id, conditions: { [it.id]: "DAMAGED" } }));
    expect(await stockAt("S")).toBe(sBefore);
    expect(await db.inventoryLog.findFirst({ where: { orderId: o.id, reason: "DAMAGED" } })).toMatchObject({ delta: 0 });

    const b = await tx((t) => createExchange(t, { orderId: o.id, lines: [{ orderItemId: o.items[0].id, quantity: 1, newVariantId: v("M").id }], reason: "", actor: "g@t.l" }));
    const mBefore = await stockAt("M");
    await transitionOrder({ orderId: b.replacement.id, to: "CANCELLED", actor: "staff" });
    expect((await db.exchange.findUniqueOrThrow({ where: { id: b.exchange.id } })).status).toBe("CANCELLED");
    expect(await stockAt("M")).toBe(mBefore + 1); // the reserved new size went back
    expect((await exchangeOptions(o.id))!.items[0].left).toBe(1); // that unit can be swapped again
    const desk = await exchangesDesk();
    expect([desk.open.length, desk.last30]).toEqual([0, { total: 2, done: 1, cancelled: 1 }]);
    expect(desk.swaps).toEqual([{ name: p.name, from: "S", to: "M", n: 1 }]);
  });

  it("two exchange requests at once can't swap the same units twice", async () => {
    const o = await delivered();
    const r = await Promise.allSettled([1, 2].map(() => tx((t) => createExchange(t, { orderId: o.id, lines: [{ orderItemId: o.items[0].id, quantity: 2, newVariantId: v("M").id }], reason: "", actor: "g@t.l" }))));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.exchange.count()).toBe(1);
  });

  it("care staff can start one for a caller (audited); fit advice appears once 5+ units were swapped mostly one way", async () => {
    const o = await delivered();
    await tx((t) => createExchange(t, { orderId: o.id, lines: [{ orderItemId: o.items[0].id, quantity: 1, newVariantId: v("M").id }], reason: "called: too tight", actor: staff.email, staff }));
    expect(await db.auditLog.findFirst({ where: { action: "exchange.create" } })).toMatchObject({ actorId: staff.id });
    expect(await exchangeFit(p.id)).toBeNull(); // 1 unit: too few to say

    for (const size of ["S", "M"]) await db.storeStock.update({ where: { storeId_variantId: { storeId: wh.id, variantId: v(size).id } }, data: { quantity: 20 } });
    for (let i = 0; i < 4; i++) { const x = await delivered(); await tx((t) => createExchange(t, { orderId: x.id, lines: [{ orderItemId: x.items[0].id, quantity: 1, newVariantId: v("M").id }], reason: "", actor: "c" })); }
    expect(await exchangeFit(p.id)).toEqual({ direction: "up", units: 5 }); // S → M, all five
    // three swaps the other way: 5 of 8 is under 70%, so no advice
    for (let i = 0; i < 3; i++) {
      const y = await db.order.create({ data: { email: "h@t.l", phone: "9822222222", status: "DELIVERED", paymentMethod: "COD", paymentStatus: "PAID", subtotal: 200000, total: 200000, shippingMethod: "standard", channel: "ONLINE", shippingAddress: { fullName: "H", district: "Kaski" },
        items: { create: [{ variantId: v("M").id, productId: p.id, name: p.name, slug: p.slug, sku: v("M").sku, color: v("M").color, size: "M", image: "", unitPrice: 200000, unitCost: 80000, quantity: 1 }] },
        events: { create: [{ status: "DELIVERED", message: "Delivered", actor: "x" }] } }, include: { items: true } });
      await tx((t) => createExchange(t, { orderId: y.id, lines: [{ orderItemId: y.items[0].id, quantity: 1, newVariantId: v("S").id }], reason: "", actor: "h" }));
    }
    expect(await exchangeFit(p.id)).toBeNull();
  });
});
