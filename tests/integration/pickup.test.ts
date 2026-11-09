import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addToCart } from "@/actions/cart";
import { placeOrder } from "@/actions/checkout";
import { closeShift, collectPickup, listPickups, openShift } from "@/actions/pos";
import { updateOrderStatus } from "@/actions/admin/orders";
import { transitionOrder } from "@/lib/orders";
import { expectedCashForShift, buildDaySummary, ktmDate } from "@/lib/pos";
import { RedirectError, session } from "../support/next-mocks";
import { actAs, makeLocation, makeProduct, makeUser, resetDb, stockAt } from "../support/db";

async function order(extra: Partial<Parameters<typeof placeOrder>[0]>, lines: { variantId: string; quantity?: number }[]) {
  session.user = null;
  session.cookies.clear();
  for (const l of lines) expect((await addToCart({ variantId: l.variantId, quantity: l.quantity ?? 1 })).ok).toBe(true);
  try {
    const r = await placeOrder({ email: "maya@test.local", phone: "9841234567", shippingMethod: "standard", paymentMethod: "COD", ...extra });
    return { error: r?.error, fieldErrors: r?.fieldErrors };
  } catch (e) {
    if (e instanceof RedirectError) return { orderId: e.url.split("/")[2].split("?")[0] };
    throw e;
  }
}

async function setup() {
  const wh = await makeLocation({ code: "WH", kind: "WAREHOUSE", priority: 10 });
  const pkr = await makeLocation({ code: "PKR", name: "Asson Pokhara", priority: 30, pickup: true });
  const p = await makeProduct({ price: 1500, stock: { M: 5 }, at: wh.id });
  return { wh, pkr, p };
}

describe("click-and-collect", () => {
  beforeEach(resetDb);

  it("needs no address, is free, and takes stock off the pickup shop's shelf first", async () => {
    const { wh, pkr, p } = await setup();
    await db.storeStock.create({ data: { storeId: pkr.id, variantId: p.variants[0].id, quantity: 1 } });
    const r = await order({ pickupStoreId: pkr.id, pickupName: "Maya Gurung" }, [{ variantId: p.variants[0].id }]);
    expect(r.orderId).toBeTruthy();
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o).toMatchObject({ pickupStoreId: pkr.id, shippingFee: 0, total: 150_000, shippingMethod: "pickup" });
    expect(o.shippingAddress).toMatchObject({ pickup: true, store: "Asson Pokhara", fullName: "Maya Gurung" });
    // warehouse has priority, but the pickup shop has it on the shelf → no trip needed
    expect([await stockAt(pkr.id, p.variants[0].id), await stockAt(wh.id, p.variants[0].id)]).toEqual([0, 5]);
  });

  it("falls back to the warehouse when the shop doesn't have it", async () => {
    const { wh, pkr, p } = await setup();
    const r = await order({ pickupStoreId: pkr.id, pickupName: "Maya" }, [{ variantId: p.variants[0].id, quantity: 2 }]);
    expect((await db.orderAllocation.findFirstOrThrow({ where: { orderId: r.orderId } })).storeId).toBe(wh.id);
  });

  it("rejects shops that aren't pickup points and asks who is collecting", async () => {
    const { wh, pkr, p } = await setup();
    expect(await order({ pickupStoreId: wh.id, pickupName: "Maya" }, [{ variantId: p.variants[0].id }])).toMatchObject({ error: expect.stringMatching(/isn't taking pickup orders/) });
    expect(await order({ pickupStoreId: pkr.id }, [{ variantId: p.variants[0].id }])).toMatchObject({ fieldErrors: { pickupName: expect.any(String) } });
    expect(await db.order.count()).toBe(0);
  });

  it("ready → SMS with the shop; can't be shipped; hand-over only at that shop's till, paid into the drawer", async () => {
    const { pkr, p } = await setup();
    const { orderId } = await order({ pickupStoreId: pkr.id, pickupName: "Maya" }, [{ variantId: p.variants[0].id }]);
    await transitionOrder({ orderId: orderId!, to: "CONFIRMED", actor: "t" });
    await transitionOrder({ orderId: orderId!, to: "PACKED", actor: "t" });
    const sms = await db.notification.findFirstOrThrow({ where: { orderId, template: "ready_for_pickup" } });
    expect(sms.body).toMatch(/ready for pickup at Asson Pokhara, Kathmandu\. Pay Rs\. 1,500 at the counter/);
    await expect(transitionOrder({ orderId: orderId!, to: "SHIPPED", actor: "t" })).rejects.toThrow(/Can't move/);

    // staff can't skip the till (payment would never reach a drawer)
    actAs(await makeUser("STAFF"));
    expect(await updateOrderStatus({ orderId: orderId!, to: "DELIVERED" })).toMatchObject({ ok: false, error: expect.stringMatching(/till/) });

    // a cashier at another shop can't hand it over
    const flagship = await makeLocation({ code: "FLAGSHIP" });
    const other = await makeUser("CASHIER");
    actAs(other);
    expect(await openShift(0, flagship.id)).toMatchObject({ ok: true });
    expect(await collectPickup({ orderId: orderId!, method: "CASH" })).toMatchObject({ ok: false, error: expect.stringMatching(/pickup at Asson Pokhara/) });

    const cashier = await makeUser("CASHIER");
    actAs(cashier);
    expect(await openShift(500, pkr.id)).toMatchObject({ ok: true });
    expect(await listPickups("1")).toMatchObject({ ok: true, rows: [{ due: 150_000, name: "Maya" }] });
    expect(await collectPickup({ orderId: orderId! })).toMatchObject({ ok: false, error: expect.stringMatching(/Take Rs\. 1,500/) });
    expect(await collectPickup({ orderId: orderId!, method: "CASH", tendered: 200_000 })).toMatchObject({ ok: true, change: 50_000 });

    const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { tenders: true } });
    expect(o).toMatchObject({ status: "DELIVERED", paymentStatus: "PAID", cashierId: cashier.id });
    expect(o.tenders).toMatchObject([{ method: "CASH", amount: 150_000 }]);
    const shift = (await db.shift.findFirstOrThrow({ where: { cashierId: cashier.id } }));
    expect(await expectedCashForShift(shift.id)).toBe(50_000 + 150_000); // Rs 500 float + Rs 1,500 collected
    expect((await buildDaySummary(pkr.id, ktmDate())).cash).toMatchObject({ pickups: 150_000, sales: 0 });
    expect(await closeShift(2000)).toMatchObject({ ok: true, difference: 0 });
    expect(await db.notification.count({ where: { orderId, template: "collected" } })).toBe(1);
    expect(await collectPickup({ orderId: orderId!, method: "CASH" })).toMatchObject({ ok: false }); // not twice
  });

  it("cancelling a ready order puts the units on the pickup shop's shelf, where they physically are", async () => {
    const { wh, pkr, p } = await setup();
    const { orderId } = await order({ pickupStoreId: pkr.id, pickupName: "Maya" }, [{ variantId: p.variants[0].id }]);
    await transitionOrder({ orderId: orderId!, to: "CONFIRMED", actor: "t" });
    await transitionOrder({ orderId: orderId!, to: "PACKED", actor: "t" });
    await transitionOrder({ orderId: orderId!, to: "CANCELLED", actor: "t", message: "Not collected in 7 days" });
    expect([await stockAt(pkr.id, p.variants[0].id), await stockAt(wh.id, p.variants[0].id)]).toEqual([1, 4]);
  });
});
