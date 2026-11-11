import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { packOrder } from "@/lib/fulfilment";
import { addParcel, cancelManifest, handOver, manifestOverview, manifestView, openManifest, removeParcel } from "@/lib/manifests";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

describe("courier hand-over manifests", () => {
  let packer: U, other: U, wh: L, shop: L, p: Awaited<ReturnType<typeof makeProduct>>;
  beforeEach(async () => {
    await resetDb();
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    shop = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    packer = await makeUser("STAFF", { name: "Packer", locations: [wh.id] });
    other = await makeUser("CASHIER", { name: "Ram", locations: [shop.id] });
    p = await makeProduct({ stock: { S: 20 }, at: wh.id });
  });
  const s = () => p.variants[0];
  /** a confirmed order allocated at `at`, packed there by scan */
  const packed = async (o: { cod?: boolean; total?: number; at?: L; pickup?: L; tracking?: string; pack?: boolean } = {}) => {
    const at = o.at ?? wh;
    const created = await db.order.create({ data: { email: "a@t.l", phone: "9800000000", status: "CONFIRMED", paymentMethod: o.cod === false ? "ONLINE" : "COD", paymentStatus: o.cod === false ? "PAID" : "PENDING", subtotal: o.total ?? 1500, total: o.total ?? 1500, shippingMethod: "standard", trackingNumber: o.tracking ?? null, pickupStoreId: o.pickup?.id ?? null,
      shippingAddress: { fullName: "Gita Rai", phone: "9811111111", line1: "Ward 4", city: "Dharan", district: "Sunsari" },
      items: { create: [{ variantId: s().id, productId: p.id, name: p.name, slug: p.slug, sku: s().sku, color: "White", size: "S", image: "", unitPrice: 1500, quantity: 1 }] } }, include: { items: true } });
    await db.orderAllocation.create({ data: { orderId: created.id, orderItemId: created.items[0].id, variantId: s().id, storeId: at.id, quantity: 1 } });
    if (o.pack !== false) await packOrder(packer, { orderId: created.id, storeId: at.id, scans: [{ sku: s().sku, quantity: 1 }] });
    return created;
  };
  const open = (u: U, carrier = "Pathao Parcel", at = wh) => db.$transaction((tx) => openManifest(tx, u, { storeId: at.id, carrier }));
  const add = (u: U, id: string, order: string | number, tracking?: string) => db.$transaction((tx) => addParcel(tx, u, id, { order: String(order), trackingNumber: tracking }));

  it("one open manifest per courier; parcels scanned on with tracking numbers; only packed courier parcels from here", async () => {
    const a = await packed(), b = await packed({ cod: false, tracking: "pp-111 222" }), notPacked = await packed({ pack: false });
    const pickup = await packed({ pickup: shop }), elsewhere = await packed({ at: shop });
    const m = (await open(packer)).manifest;
    expect((await open(packer, "pathao parcel")).manifest.id).toBe(m.id); // same courier → same open manifest
    const ncm = (await open(packer, "Nepal Can Move (NCM)")).manifest;
    expect(ncm.id).not.toBe(m.id);
    await expect(open(other)).rejects.toThrow(/not assigned to Warehouse/);

    await expect(add(packer, m.id, a.number)).rejects.toThrow(/tracking number/);
    expect(await add(packer, m.id, `AS${String(a.number).padStart(6, "0")}`, " pp-0001 ")).toEqual({ orderNumber: a.number, trackingNumber: "PP-0001", cod: 1500 });
    expect(await add(packer, m.id, b.number)).toMatchObject({ trackingNumber: "PP-111222", cod: 0 }); // prepaid, tracking already on the order
    await expect(add(packer, m.id, a.number, "PP-9")).rejects.toThrow(/already on M-/);
    await expect(add(packer, ncm.id, a.number, "N-1234")).rejects.toThrow(/already on M-\d+ \(Pathao Parcel\)/);
    await expect(add(packer, m.id, notPacked.number, "PP-0002")).rejects.toThrow(/confirmed: only packed orders/);
    await expect(add(packer, m.id, pickup.number, "PP-0003")).rejects.toThrow(/collected from a shop/);
    await expect(add(packer, m.id, elsewhere.number, "PP-0004")).rejects.toThrow(/wasn't packed at this location/);
    await expect(add(packer, m.id, 999999, "PP-0005")).rejects.toThrow(/No order/);
    const c = await packed();
    await expect(add(packer, m.id, c.number, "pp-0001")).rejects.toThrow(/PP-0001 is already on/); // same courier, same tracking
    await expect(add(packer, m.id, c.number, "x")).rejects.toThrow(/4 to 40/);

    const ov = await manifestOverview(wh.id);
    expect(ov.open.map((x) => [x.carrier, x.parcels, x.cod])).toEqual([["Pathao Parcel", 2, 1500], ["Nepal Can Move (NCM)", 0, 0]]);
    expect(ov.ready).toBe(1); // c (notPacked isn't packed; pickup and shop orders aren't ours)
    await db.$transaction((tx) => removeParcel(tx, packer, m.id, b.id));
    expect((await manifestOverview(wh.id)).ready).toBe(2);
    await expect(db.manifest.create({ data: { storeId: wh.id, carrier: "PATHAO PARCEL", createdById: packer.id } })).rejects.toThrow(/Manifest_open_carrier|Unique/);
  });

  it("hand-over: the rider's count must match; every order ships with its tracking number at once; then the manifest is closed", async () => {
    const a = await packed({ total: 2000 }), b = await packed({ cod: false });
    const m = (await open(packer)).manifest;
    await add(packer, m.id, a.number, "PP-1001");
    await add(packer, m.id, b.number, "PP-1002");
    const hand = (d: { riderName: string; parcels: number; riderPhone?: string }) => db.$transaction((tx) => handOver(tx, packer, m.id, d));
    await expect(hand({ riderName: "Hari", parcels: 3 })).rejects.toThrow(/counted 3 but the manifest has 2/);
    await expect(hand({ riderName: " ", parcels: 2 })).rejects.toThrow(/rider's name/);
    expect(await hand({ riderName: "Hari Thapa", riderPhone: "98-0000-1111", parcels: 2 })).toEqual({ parcels: 2, codTotal: 2000 });

    const orders = await db.order.findMany({ where: { id: { in: [a.id, b.id] } }, orderBy: { number: "asc" }, include: { events: { orderBy: { createdAt: "desc" }, take: 1 } } });
    expect(orders.map((o) => [o.status, o.carrier, o.trackingNumber])).toEqual([["SHIPPED", "Pathao Parcel", "PP-1001"], ["SHIPPED", "Pathao Parcel", "PP-1002"]]);
    expect(orders[0].events[0].message).toMatch(/Handed to Pathao Parcel \(PP-1001\) on M-\d+, rider Hari Thapa/);
    expect(await db.notification.count({ where: { orderId: { in: [a.id, b.id] } } })).toBeGreaterThanOrEqual(2); // customers told it's shipped
    expect(await db.manifest.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ status: "HANDED_OVER", riderName: "Hari Thapa", riderPhone: "9800001111", parcels: 2, codTotal: 2000, handedById: packer.id });
    expect(await db.auditLog.count({ where: { action: "manifest.handover" } })).toBe(1);
    await expect(hand({ riderName: "Hari", parcels: 2 })).rejects.toThrow(/already handed over/);
    await expect(add(packer, m.id, (await packed()).number, "PP-1003")).rejects.toThrow(/already handed over/);

    // a new manifest for the same courier can open now; the view tracks delivery and the courier's COD payment
    expect((await open(packer)).manifest.id).not.toBe(m.id);
    await db.order.update({ where: { id: a.id }, data: { status: "DELIVERED" } });
    const v = (await manifestView(m.id))!;
    expect([v.parcels.length, v.cod, v.delivered, v.remitted, v.parcels[0].place]).toEqual([2, 2000, 1, 0, "Dharan, Sunsari"]);
    expect((await manifestOverview(wh.id)).today.map((x) => x.parcels)).toEqual([2]);
  });

  it("if one order can't ship (cancelled meanwhile) nothing ships, and cancelling a manifest frees its parcels", async () => {
    const a = await packed(), b = await packed();
    const m = (await open(packer)).manifest;
    await add(packer, m.id, a.number, "PP-2001");
    await add(packer, m.id, b.number, "PP-2002");
    await db.order.update({ where: { id: b.id }, data: { status: "CANCELLED" } });
    await expect(db.$transaction((tx) => handOver(tx, packer, m.id, { riderName: "Hari", parcels: 2 }))).rejects.toThrow(/can't ship/);
    expect((await db.order.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("PACKED"); // rolled back
    expect((await db.manifest.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("OPEN");

    await db.$transaction((tx) => cancelManifest(tx, packer, m.id));
    expect(await db.manifestOrder.count()).toBe(0);
    const m2 = (await open(packer, "Upaya City Cargo")).manifest;
    await add(packer, m2.id, a.number, "UP-2001"); // free to go on another manifest; the tracking number belongs to another courier
    await expect(db.manifest.update({ where: { id: m2.id }, data: { status: "HANDED_OVER" } })).rejects.toThrow(/Manifest_handed_complete/);
  });

  it("two people scanning the same parcel onto two couriers' manifests: it lands on one", async () => {
    const a = await packed();
    const m1 = (await open(packer)).manifest, m2 = (await open(packer, "Aramex Nepal")).manifest;
    const r = await Promise.allSettled([add(packer, m1.id, a.number, "PP-3001"), add(packer, m2.id, a.number, "AR-3001")]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.manifestOrder.count()).toBe(1);
  });
});
