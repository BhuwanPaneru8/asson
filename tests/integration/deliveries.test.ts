import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { packOrder } from "@/lib/fulfilment";
import { addParcel, handOver, openManifest } from "@/lib/manifests";
import { deliveriesDesk, receiveReturn, recordAttempt, reportLost, startReturn } from "@/lib/deliveries";
import { transitionOrder } from "@/lib/orders";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

describe("failed deliveries and returns to origin", () => {
  let staff: U, shopStaff: U, wh: L, shop: L, p: Awaited<ReturnType<typeof makeProduct>>;
  beforeEach(async () => {
    await resetDb();
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    shop = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    staff = await makeUser("STAFF", { name: "Desk", locations: [wh.id] });
    shopStaff = await makeUser("CASHIER", { name: "Ram", locations: [shop.id] });
    p = await makeProduct({ stock: { S: 10 }, at: wh.id });
  });
  const s = () => p.variants[0];
  const stockAt = async (storeId: string) => (await db.storeStock.findUnique({ where: { storeId_variantId: { storeId, variantId: s().id } } }))?.quantity ?? 0;
  let tn = 0;
  /** an order shipped from the warehouse on a manifest (stock taken from the warehouse as it would be at allocation) */
  const shipped = async (o: { cod?: boolean; district?: string; carrier?: string } = {}) => {
    const created = await db.order.create({ data: { email: "a@t.l", phone: "9800000000", status: "CONFIRMED", paymentMethod: o.cod === false ? "ONLINE" : "COD", paymentStatus: o.cod === false ? "PAID" : "PENDING", subtotal: 2000, shippingFee: 150, total: 2150, shippingMethod: "standard",
      shippingAddress: { fullName: "Gita Rai", phone: "9811111111", line1: "Ward 4", city: "Dharan", district: o.district ?? "Sunsari" },
      items: { create: [{ variantId: s().id, productId: p.id, name: p.name, slug: p.slug, sku: s().sku, color: "White", size: "S", image: "", unitPrice: 2000, quantity: 1 }] } }, include: { items: true } });
    await db.orderAllocation.create({ data: { orderId: created.id, orderItemId: created.items[0].id, variantId: s().id, storeId: wh.id, quantity: 1 } });
    await db.storeStock.update({ where: { storeId_variantId: { storeId: wh.id, variantId: s().id } }, data: { quantity: { decrement: 1 } } });
    await packOrder(staff, { orderId: created.id, storeId: wh.id, scans: [{ sku: s().sku, quantity: 1 }] });
    const m = (await db.$transaction((tx) => openManifest(tx, staff, { storeId: wh.id, carrier: o.carrier ?? "Pathao Parcel" }))).manifest;
    await db.$transaction((tx) => addParcel(tx, staff, m.id, { order: String(created.number), trackingNumber: `TR-${++tn}000` }));
    await db.$transaction((tx) => handOver(tx, staff, m.id, { riderName: "Hari", parcels: 1 }));
    return created;
  };
  const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

  it("failed attempts are recorded with an SMS asking the customer to call; the order stays with the courier", async () => {
    const o = await shipped();
    expect(await tx((t) => recordAttempt(t, staff, { orderId: o.id, reason: "NOT_REACHABLE" }))).toEqual({ attempts: 1 });
    expect(await tx((t) => recordAttempt(t, staff, { orderId: o.id, reason: "RESCHEDULED", note: "Sunday" }))).toEqual({ attempts: 2 });
    const sms = await db.notification.findMany({ where: { orderId: o.id, template: "delivery_failed" } });
    expect(sms).toHaveLength(1); // not for a customer who asked for another day
    expect(sms[0].body).toMatch(/couldn't deliver order AS\d+ today\. Please call/);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("SHIPPED");
    expect((await db.orderEvent.findFirstOrThrow({ where: { orderId: o.id }, orderBy: { createdAt: "desc" } })).message).toBe("Delivery attempt 2 failed: customer asked for another day (Sunday)");
    await expect(tx((t) => recordAttempt(t, shopStaff, { orderId: o.id, reason: "NOT_HOME" }))).rejects.toThrow(/not assigned to any location/);
  });

  it("a return: the order can't be moved by hand; it comes back, is received at another location, and goes on sale there", async () => {
    const o = await shipped({ cod: false });
    await expect(transitionOrder({ orderId: o.id, to: "RETURNING", actor: "x" })).rejects.toThrow(/handled in Fulfilment → Deliveries/);
    await tx((t) => recordAttempt(t, staff, { orderId: o.id, reason: "CUSTOMER_REFUSED" }));
    await tx((t) => startReturn(t, staff, { orderId: o.id }));
    const r = await db.returnToOrigin.findUniqueOrThrow({ where: { orderId: o.id } });
    expect([r.state, r.reason, r.carrier]).toEqual(["IN_TRANSIT", "CUSTOMER_REFUSED", "Pathao Parcel"]); // the last attempt's reason
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("RETURNING");
    await expect(transitionOrder({ orderId: o.id, to: "CANCELLED", actor: "x" })).rejects.toThrow(/handled in Fulfilment → Deliveries/);
    await expect(tx((t) => startReturn(t, staff, { orderId: o.id }))).rejects.toThrow(/isn't with a courier/);

    // it arrives at the Pokhara shop: staff there can receive it even though it left from the warehouse
    const before = { wh: await stockAt(wh.id), shop: await stockAt(shop.id) };
    await expect(tx((t) => receiveReturn(t, shopStaff, { order: String(o.number), storeId: wh.id, damaged: false, courierCharge: 0 }))).rejects.toThrow(/not assigned to Warehouse/);
    expect(await tx((t) => receiveReturn(t, shopStaff, { order: `AS${o.number}`, storeId: shop.id, damaged: false, courierCharge: 10000, note: "box dented" }))).toEqual({ number: o.number, damaged: false });
    expect([await stockAt(wh.id), await stockAt(shop.id)]).toEqual([before.wh, before.shop + 1]);
    const after = await db.order.findUniqueOrThrow({ where: { id: o.id }, include: { rto: true } });
    expect([after.status, after.paymentStatus]).toEqual(["CANCELLED", "REFUNDED"]); // prepaid: refund owed
    expect(after.rto).toMatchObject({ state: "RECEIVED", storeId: shop.id, courierCharge: 10000, damaged: false, note: "box dented", closedById: shopStaff.id });
    await expect(tx((t) => receiveReturn(t, shopStaff, { order: String(o.number), storeId: shop.id, damaged: false, courierCharge: 0 }))).rejects.toThrow(/already been received back/);
  });

  it("an unannounced return is accepted; damaged parcels are quarantined, not put on sale", async () => {
    const o = await shipped();
    const before = await stockAt(wh.id);
    await tx((t) => receiveReturn(t, staff, { order: String(o.number), storeId: wh.id, damaged: true, courierCharge: 0 }));
    expect(await stockAt(wh.id)).toBe(before);
    expect(await db.inventoryLog.findFirst({ where: { orderId: o.id, reason: "DAMAGED" } })).toMatchObject({ delta: 0, storeId: wh.id });
    expect(await db.returnToOrigin.findUniqueOrThrow({ where: { orderId: o.id } })).toMatchObject({ state: "RECEIVED", damaged: true, reason: "OTHER", note: "Arrived back without notice" });
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("CANCELLED");
  });

  it("a lost parcel is closed with a claim for the goods' value and nothing goes back on sale", async () => {
    const o = await shipped();
    const before = await stockAt(wh.id);
    await expect(tx((t) => reportLost(t, staff, { orderId: o.id, note: "" }))).rejects.toThrow(/what the courier told you/);
    await tx((t) => reportLost(t, staff, { orderId: o.id, note: "Pathao ticket 5521" }));
    expect(await stockAt(wh.id)).toBe(before);
    expect(await db.returnToOrigin.findUniqueOrThrow({ where: { orderId: o.id } })).toMatchObject({ state: "LOST", claimAmount: 2000, note: "Pathao ticket 5521" });
    await expect(db.returnToOrigin.update({ where: { orderId: o.id }, data: { closedAt: null } })).rejects.toThrow(/ReturnToOrigin_closed_complete/);
  });

  it("the desk: parcels with couriers oldest first, stuck after the set days, coming back, and the return rate by courier and district", async () => {
    const old = await shipped({ district: "Jhapa" }), fresh = await shipped({ carrier: "Nepal Can Move (NCM)" }), back = await shipped({ district: "Jhapa" });
    await db.orderEvent.updateMany({ where: { orderId: old.id, status: "SHIPPED" }, data: { createdAt: new Date(Date.now() - 8 * 86_400_000) } });
    await tx((t) => recordAttempt(t, staff, { orderId: old.id, reason: "WRONG_ADDRESS" }));
    await tx((t) => startReturn(t, staff, { orderId: back.id, reason: "CUSTOMER_REFUSED" }));
    const d = await deliveriesDesk({ all: true });
    expect(d.parcels.map((x) => [x.number, x.stuck, x.attempts, x.lastReason])).toEqual([[old.number, true, 1, "WRONG_ADDRESS"], [fresh.number, false, 0, null]]);
    expect(d.parcels[0].cod).toBe(2150);
    expect(d.stuck).toBe(1);
    expect(d.returning.map((r) => r.orderId)).toEqual([back.id]);
    expect(d.byCarrier).toEqual([{ carrier: "Pathao Parcel", shipped: 2, returned: 1 }, { carrier: "Nepal Can Move (NCM)", shipped: 1, returned: 0 }]);
    expect(d.byDistrict).toEqual([{ district: "Jhapa", shipped: 2, returned: 1 }]);
    expect(d.rate).toEqual({ shipped: 3, returned: 1, pct: 33.3 });
    expect(d.reasons).toEqual([{ reason: "CUSTOMER_REFUSED", count: 1 }]);
    // a shop cashier only sees parcels from their own locations
    expect((await deliveriesDesk({ all: false, storeIds: [shop.id] })).parcels).toHaveLength(0);
    expect((await deliveriesDesk({ all: false, storeIds: [wh.id] })).parcels).toHaveLength(2);
  });
});
