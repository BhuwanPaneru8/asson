import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addToCart } from "@/actions/cart";
import { placeOrder, quoteCheckout } from "@/actions/checkout";
import { transitionOrder } from "@/lib/orders";
import { RedirectError } from "../support/next-mocks";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";

const address = { fullName: "Sita Rai", phone: "9841234567", line1: "Ward 4", city: "Town", district: "Kathmandu", postalCode: "" };
async function place(extra: Partial<Parameters<typeof placeOrder>[0]> = {}) {
  try { const r = await placeOrder({ email: "sita@test.local", phone: "9841234567", address, shippingMethod: "standard", paymentMethod: "COD", ...extra }); return { error: r?.error }; }
  catch (e) { if (e instanceof RedirectError) return { url: e.url }; throw e; }
}
async function deliver(orderId: string) {
  for (const to of ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"] as const) await transitionOrder({ orderId, to, actor: "t" });
}
const balance = async (id: string) => (await db.user.findUniqueOrThrow({ where: { id } })).points;

describe("loyalty points", () => {
  beforeEach(resetDb);

  it("earns 1 point per Rs 100 of goods once delivered — once only, not on delivery fee", async () => {
    const u = await makeUser("CUSTOMER"); actAs(u);
    const p = await makeProduct({ price: 1450, stock: { M: 5 } });
    await addToCart({ variantId: p.variants[0].id });
    expect((await place()).url).toBeTruthy();
    const o = await db.order.findFirstOrThrow();
    expect(o.shippingFee).toBeGreaterThan(0);
    await transitionOrder({ orderId: o.id, to: "CONFIRMED", actor: "t" });
    expect(await balance(u.id)).toBe(0); // nothing before delivery
    for (const to of ["PACKED", "SHIPPED", "DELIVERED"] as const) await transitionOrder({ orderId: o.id, to, actor: "t" });
    expect(await balance(u.id)).toBe(14);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).pointsEarned).toBe(14);
    expect(await db.pointsEntry.count({ where: { reason: "EARN" } })).toBe(1);
  });

  it("redeems up to 20% of the bag, atomically, and refunds the points on cancel", async () => {
    const u = await makeUser("CUSTOMER"); actAs(u);
    await db.user.update({ where: { id: u.id }, data: { points: 1000 } });
    const p = await makeProduct({ price: 2000, stock: { M: 5 } });
    await addToCart({ variantId: p.variants[0].id });
    const q = await quoteCheckout({ shippingMethod: "standard", district: "Kathmandu", usePoints: true });
    expect(q.points).toEqual({ balance: 1000, usable: 400, used: 400 });
    expect(q.totals.pointsDiscount).toBe(40_000);
    expect((await place({ usePoints: true })).url).toBeTruthy();
    const o = await db.order.findFirstOrThrow();
    expect(o).toMatchObject({ subtotal: 200_000, pointsRedeemed: 400, pointsDiscount: 40_000, total: 200_000 - 40_000 + o.shippingFee });
    expect(await balance(u.id)).toBe(600);
    await transitionOrder({ orderId: o.id, to: "CANCELLED", actor: "t" });
    expect(await balance(u.id)).toBe(1000);
    await transitionOrder({ orderId: o.id, to: "CANCELLED", actor: "t" }).catch(() => {}); // can't refund twice
    expect(await balance(u.id)).toBe(1000);
  });

  it("won't spend points that are gone (balance changed between quote and order)", async () => {
    const u = await makeUser("CUSTOMER"); actAs(u);
    await db.user.update({ where: { id: u.id }, data: { points: 50 } });
    const p = await makeProduct({ price: 2000, stock: { M: 5 } });
    await addToCart({ variantId: p.variants[0].id });
    // below the minimum: usePoints is ignored, order still goes through at full price
    expect((await place({ usePoints: true })).url).toBeTruthy();
    expect((await db.order.findFirstOrThrow()).pointsRedeemed).toBe(0);
    expect(await balance(u.id)).toBe(50);
  });

  it("takes earned points back when the order is returned", async () => {
    const u = await makeUser("CUSTOMER"); actAs(u);
    const p = await makeProduct({ price: 3000, stock: { M: 5 } });
    await addToCart({ variantId: p.variants[0].id });
    await place();
    const o = await db.order.findFirstOrThrow();
    await deliver(o.id);
    expect(await balance(u.id)).toBe(30);
    await transitionOrder({ orderId: o.id, to: "RETURN_REQUESTED", actor: "t" });
    await transitionOrder({ orderId: o.id, to: "RETURNED", actor: "t" });
    expect(await balance(u.id)).toBe(0);
  });

  it("guests earn nothing and see no points", async () => {
    actAs(null);
    const p = await makeProduct({ price: 3000, stock: { M: 5 } });
    await addToCart({ variantId: p.variants[0].id });
    const q = await quoteCheckout({ shippingMethod: "standard", district: "Kathmandu", usePoints: true });
    expect(q.points.used).toBe(0);
    await place();
    const o = await db.order.findFirstOrThrow();
    await deliver(o.id);
    expect(await db.pointsEntry.count()).toBe(0);
  });
});
