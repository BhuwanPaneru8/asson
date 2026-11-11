import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cancelWave, compareScans, createWave, finishWave, packOrder, packingView, wavePickList } from "@/lib/fulfilment";
import { assignBin } from "@/lib/bins";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

describe("waves and packing", () => {
  let picker: U, mgr: U, other: U, wh: L, shop: L, p: Awaited<ReturnType<typeof makeProduct>>;
  beforeEach(async () => {
    await resetDb();
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    shop = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    picker = await makeUser("STAFF", { name: "Picker", locations: [wh.id] });
    mgr = await makeUser("MANAGER", { name: "Sita", locations: [wh.id] });
    other = await makeUser("CASHIER", { name: "Ram", locations: [shop.id] });
    p = await makeProduct({ stock: { S: 20, M: 20 }, at: wh.id });
  });
  const v = (size: string) => p.variants.find((x) => x.size === size)!;
  let n = 0;
  const order = async (lines: [string, number][], o: { express?: boolean; minutesAgo?: number; at?: L } = {}) => {
    const created = await db.order.create({ data: { email: "a@t.l", phone: "9800000000", status: "CONFIRMED", paymentMethod: "COD", subtotal: 1000, total: 1000, shippingMethod: o.express ? "express" : "standard", shippingAddress: {}, createdAt: new Date(Date.now() - (o.minutesAgo ?? ++n) * 60_000),
      items: { create: lines.map(([size, q]) => ({ variantId: v(size).id, productId: p.id, name: p.name, slug: p.slug, sku: v(size).sku, color: "White", size, image: "", unitPrice: 500, quantity: q })) } }, include: { items: true } });
    for (const it of created.items) await db.orderAllocation.create({ data: { orderId: created.id, orderItemId: it.id, variantId: it.variantId, storeId: (o.at ?? wh).id, quantity: it.quantity } });
    return created;
  };

  it("a wave takes express first, then the oldest; slots; one pick list in bin order; no order in two waves", async () => {
    const old = await order([["S", 1]], { minutesAgo: 300 });
    const mid = await order([["M", 2], ["S", 1]], { minutesAgo: 200 });
    const exp = await order([["M", 1]], { minutesAgo: 10, express: true });
    await order([["S", 1]], { minutesAgo: 400, at: shop }); // waiting at another location
    await db.$transaction((tx) => assignBin(tx, picker, { storeId: wh.id, sku: v("M").sku, code: "A-2" }));
    await db.$transaction((tx) => assignBin(tx, picker, { storeId: wh.id, sku: v("S").sku, code: "A-10" }));

    await expect(db.$transaction((tx) => createWave(tx, other, { storeId: wh.id, maxOrders: 5 }))).rejects.toThrow(/not assigned to Warehouse/);
    const w1 = await db.$transaction((tx) => createWave(tx, picker, { storeId: wh.id, maxOrders: 2 }));
    expect((await db.waveOrder.findMany({ where: { waveId: w1.id }, orderBy: { slot: "asc" } })).map((x) => x.orderId)).toEqual([exp.id, old.id]);
    const w2 = await db.$transaction((tx) => createWave(tx, picker, { storeId: wh.id, maxOrders: 5 }));
    expect((await db.waveOrder.findMany({ where: { waveId: w2.id } })).map((x) => x.orderId)).toEqual([mid.id]);
    await expect(db.$transaction((tx) => createWave(tx, picker, { storeId: wh.id, maxOrders: 5 }))).rejects.toThrow(/No confirmed orders waiting/);

    const list = (await wavePickList(w1.id))!;
    expect(list.lines.map((l) => [l.sku, l.bin?.code, l.slots])).toEqual([[v("M").sku, "A-2", [{ slot: 1, quantity: 1 }]], [v("S").sku, "A-10", [{ slot: 2, quantity: 1 }]]]);
    await db.$transaction((tx) => finishWave(tx, picker, w1.id));
    expect(await db.orderAllocation.count({ where: { orderId: { in: [exp.id, old.id] }, pickedAt: null } })).toBe(0);
    await expect(db.$transaction((tx) => finishWave(tx, picker, w1.id))).rejects.toThrow(/picked/);

    // cancelling a wave puts its orders back in the queue
    await db.$transaction((tx) => cancelWave(tx, picker, w2.id));
    const w3 = await db.$transaction((tx) => createWave(tx, picker, { storeId: wh.id, maxOrders: 5 }));
    expect((await db.waveOrder.findMany({ where: { waveId: w3.id } })).map((x) => x.orderId)).toEqual([mid.id]);
  });

  it("two people building waves at once never put an order in both", async () => {
    for (let i = 0; i < 6; i++) await order([["S", 1]]);
    const r = await Promise.allSettled([picker, mgr].map((u) => db.$transaction((tx) => createWave(tx, u, { storeId: wh.id, maxOrders: 4 }))));
    expect(r.every((x) => x.status === "fulfilled")).toBe(true);
    expect(await db.waveOrder.count()).toBe(6); // 4 + 2, each order once
  });

  it("packing checks every item: refuses mismatches, managers can override with a reason, the order is packed with its scans", async () => {
    const o = await order([["M", 2], ["S", 1]]);
    expect(compareScans([{ sku: "A", quantity: 2 }], [{ sku: "a", quantity: 1 }, { sku: "B", quantity: 1 }])).toEqual({ matched: false, missing: [{ sku: "A", quantity: 1 }], extra: [{ sku: "B", quantity: 1 }] });
    const view = (await packingView(o.number))!;
    expect(view.expected.map((e) => [e.sku, e.quantity])).toEqual([[v("M").sku, 2], [v("S").sku, 1]]);
    expect(view.unpicked).toBe(3);

    await expect(packOrder(picker, { orderId: o.id, storeId: wh.id, scans: [{ sku: v("M").sku, quantity: 2 }] })).rejects.toThrow(new RegExp(`1 × ${v("S").sku} missing`));
    await expect(packOrder(picker, { orderId: o.id, storeId: wh.id, scans: [{ sku: v("M").sku, quantity: 2 }], override: "label torn" })).rejects.toThrow(/Only a manager/);
    await expect(packOrder(picker, { orderId: o.id, scans: [{ sku: v("M").sku, quantity: 2 }, { sku: v("S").sku, quantity: 1 }], weightGrams: 0 })).rejects.toThrow(/grams/);
    await packOrder(picker, { orderId: o.id, storeId: wh.id, scans: [{ sku: v("M").sku.toLowerCase(), quantity: 2 }, { sku: v("S").sku, quantity: 1 }], weightGrams: 850, box: "M box" });
    const after = await db.order.findUniqueOrThrow({ where: { id: o.id }, include: { packCheck: true, events: true } });
    expect(after.status).toBe("PACKED");
    expect(after.packCheck).toMatchObject({ matched: true, weightGrams: 850, box: "M box", packedById: picker.id });
    expect(after.events.at(-1)!.message).toBe("Packed: every item scanned");
    expect(await db.orderAllocation.count({ where: { orderId: o.id, pickedAt: null } })).toBe(0);
    await expect(packOrder(picker, { orderId: o.id, scans: [] })).rejects.toThrow(/not waiting to be packed/);

    const o2 = await order([["S", 1]]);
    await packOrder(mgr, { orderId: o2.id, storeId: wh.id, scans: [], override: "Barcode label torn; checked by eye" });
    expect(await db.packCheck.findUniqueOrThrow({ where: { orderId: o2.id } })).toMatchObject({ matched: false, override: "Barcode label torn; checked by eye" });
    await expect(db.packCheck.create({ data: { orderId: (await order([["S", 1]])).id, scans: [], matched: false, packedById: mgr.id } })).rejects.toThrow(/PackCheck_override/);
  });
});
