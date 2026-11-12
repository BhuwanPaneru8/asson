import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { collectPickup, createShopOrderAction, openShift, posOrderLookup } from "@/actions/pos";
import { transitionOrder } from "@/lib/orders";
import { expectedCashForShift } from "@/lib/pos";
import { actAs, makeLocation, makeProduct, makeUser, resetDb, stockAt } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;
let n = 0;
const ref = () => `test-ref-${++n}-${Math.random().toString(36).slice(2, 8)}`;

describe("ordering from another location at the till", () => {
  let wh: L, ktm: L, pkr: L, cashier: U, other: U, p: Awaited<ReturnType<typeof makeProduct>>;
  beforeEach(async () => {
    await resetDb();
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE", priority: 10 });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop", pickup: true });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop", pickup: true });
    await db.store.update({ where: { id: ktm.id }, data: { district: "Kathmandu", shipsOnline: false } });
    await db.store.update({ where: { id: pkr.id }, data: { shipsOnline: false } });
    await db.store.update({ where: { id: wh.id }, data: { district: "Kathmandu", shipsOnline: true } });
    p = await makeProduct({ price: 2000, cost: 900, stock: { M: 4, L: 2 }, at: wh.id });
    await db.storeStock.create({ data: { storeId: pkr.id, variantId: p.variants[0].id, quantity: 5 } }); // Pokhara has some but doesn't send orders
    cashier = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    other = await makeUser("CASHIER", { name: "Sita", locations: [ktm.id] });
    actAs(cashier);
    expect((await openShift(5000, ktm.id)).ok).toBe(true);
  });
  const M = () => p.variants[0];

  it("search shows what's here and where else it can be sent from (only locations that send orders)", async () => {
    const r = await posOrderLookup(M().sku);
    expect(r[0]).toMatchObject({ variantId: M().id, stock: 0, elsewhere: [{ name: "Warehouse", quantity: 4 }] });
  });

  it("collect here, paid now: confirmed, stock reserved at the warehouse, the cash on this shift; collecting it later on another shift keeps the cash in the first drawer", async () => {
    const before = await expectedCashForShift((await db.shift.findFirstOrThrow({ where: { cashierId: cashier.id } })).id);
    const r = await createShopOrderAction({ clientRef: ref(), lines: [{ variantId: M().id, quantity: 2 }], customer: { name: "Gita Rai", phone: "9811111111" }, fulfil: "PICKUP", pay: "NOW", tender: { method: "CASH", tendered: 500_000 } });
    if (!r.ok) throw new Error(r.error);
    expect([r.total, r.change]).toEqual([400_000, 100_000]);
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { tenders: true, allocations: true, notifications: true } });
    expect([o.channel, o.status, o.paymentMethod, o.paymentStatus, o.pickupStoreId, o.takenAtStoreId, o.cashierId, o.shippingFee]).toEqual(["ONLINE", "CONFIRMED", "IN_STORE", "PAID", ktm.id, ktm.id, cashier.id, 0]);
    expect(o.allocations.map((a) => [a.storeId, a.quantity])).toEqual([[wh.id, 2]]);
    expect(await stockAt(wh.id, M().id)).toBe(2);
    expect(o.notifications[0]).toMatchObject({ template: "confirmed" });
    const shiftA = (await db.shift.findFirstOrThrow({ where: { cashierId: cashier.id } })).id;
    expect(await expectedCashForShift(shiftA)).toBe(before + 400_000);

    // packed and sent to the shop; another cashier on another shift hands it over: nothing due, the cash stays on shift A
    await transitionOrder({ orderId: o.id, to: "PACKED", actor: "wh" });
    actAs(other);
    expect((await openShift(1000, ktm.id)).ok).toBe(true);
    expect(await collectPickup({ orderId: o.id })).toEqual({ ok: true, change: 0 });
    const after = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect([after.status, after.shiftId, after.cashierId]).toEqual(["DELIVERED", shiftA, other.id]);
    expect(await expectedCashForShift(shiftA)).toBe(before + 400_000);
  });

  it("deliver, pay on delivery: the district's delivery fee is added and it's a COD order; a double tap makes one order", async () => {
    const input = { clientRef: ref(), lines: [{ variantId: p.variants[1].id, quantity: 1 }], customer: { name: "Hari", phone: "9822222222" }, fulfil: "DELIVERY" as const, address: { line1: "Ward 4", city: "Dharan", district: "Sunsari" }, pay: "LATER" as const };
    const [a, b] = await Promise.all([createShopOrderAction(input), createShopOrderAction(input)]);
    if (!a.ok || !b.ok) throw new Error("failed");
    expect(a.orderId).toBe(b.orderId);
    const o = await db.order.findUniqueOrThrow({ where: { id: a.orderId } });
    expect([o.paymentMethod, o.paymentStatus, o.pickupStoreId, o.shiftId]).toEqual(["COD", "PENDING", null, null]);
    expect(o.shippingFee).toBeGreaterThan(0);
    expect(o.total).toBe(200_000 + o.shippingFee);
    expect((o.shippingAddress as { district: string; state: string }).district).toBe("Sunsari");
    expect(await db.order.count({ where: { takenAtStoreId: ktm.id } })).toBe(1);
  });

  it("refuses what can't be done: no stock anywhere that sends, bad phone, missing address, short cash", async () => {
    const base = { clientRef: ref(), customer: { name: "Gita", phone: "9811111111" }, fulfil: "PICKUP" as const, pay: "LATER" as const };
    expect(await createShopOrderAction({ ...base, lines: [{ variantId: p.variants[1].id, quantity: 3 }] })).toMatchObject({ ok: false, error: expect.stringMatching(/search again/) });
    expect(await createShopOrderAction({ ...base, clientRef: ref(), lines: [{ variantId: M().id, quantity: 1 }], customer: { name: "Gita", phone: "123" } })).toMatchObject({ ok: false, error: expect.stringMatching(/10-digit/) });
    expect(await createShopOrderAction({ ...base, clientRef: ref(), lines: [{ variantId: M().id, quantity: 1 }], fulfil: "DELIVERY" })).toMatchObject({ ok: false, error: expect.stringMatching(/delivery address/) });
    expect(await createShopOrderAction({ ...base, clientRef: ref(), lines: [{ variantId: M().id, quantity: 1 }], pay: "NOW", tender: { method: "CASH", tendered: 100 } })).toMatchObject({ ok: false, error: expect.stringMatching(/less than the total/) });
    expect(await db.order.count()).toBe(0);
    expect(await stockAt(wh.id, M().id)).toBe(4); // nothing reserved
  });
});
