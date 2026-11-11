import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { assignBin, binOverview, byBin, createBins, importAssignments, normaliseCode, putawayList, sortKeyOf } from "@/lib/bins";
import { getPickList } from "@/lib/picking";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

describe("bins", () => {
  let staff: U, other: U, wh: L, shop: L, p: Awaited<ReturnType<typeof makeProduct>>;
  beforeEach(async () => {
    await resetDb();
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    shop = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    staff = await makeUser("STAFF", { name: "Picker", locations: [wh.id] });
    other = await makeUser("CASHIER", { name: "Ram", locations: [shop.id] });
    p = await makeProduct({ stock: { S: 5, M: 8, L: 3 }, at: wh.id });
  });
  const sku = (size: string) => p.variants.find((v) => v.size === size)!.sku;

  it("codes are normalised and sort the way people walk", () => {
    expect(["a 3 2", "a-03-02", " b_1/4 "].map(normaliseCode)).toEqual(["A-3-2", "A-03-02", "B-1-4"]);
    expect(() => normaliseCode("$$")).toThrow(/isn't a bin code/);
    expect(["A-10-1", "B-1-1", "A-2-1", "A-2-10", "A-2-2"].sort((a, b) => sortKeyOf(a).localeCompare(sortKeyOf(b)))).toEqual(["A-2-1", "A-2-2", "A-2-10", "A-10-1", "B-1-1"]);
    expect(byBin([{ sku: "Z", bin: null }, { sku: "Y", bin: { sortKey: sortKeyOf("A-10") } }, { sku: "X", bin: { sortKey: sortKeyOf("A-2") } }]).map((r) => r.sku)).toEqual(["X", "Y", "Z"]);
  });

  it("scan to assign; moving a size to another bin; only at your location; a bin belongs to one location", async () => {
    await expect(db.$transaction((tx) => assignBin(tx, other, { storeId: wh.id, sku: sku("M"), code: "A-1" }))).rejects.toThrow(/not assigned to Warehouse/);
    await expect(db.$transaction((tx) => assignBin(tx, staff, { storeId: wh.id, sku: "NOPE", code: "A-1" }))).rejects.toThrow(/No size with SKU NOPE/);
    expect(await db.$transaction((tx) => assignBin(tx, staff, { storeId: wh.id, sku: sku("M").toLowerCase(), code: "a 1 2" }))).toEqual({ sku: sku("M"), code: "A-1-2", previous: null });
    expect(await db.$transaction((tx) => assignBin(tx, staff, { storeId: wh.id, sku: sku("M"), code: "B-4" }))).toMatchObject({ previous: "A-1-2" });
    expect(await db.binAssignment.count()).toBe(1);
    const shopBin = await db.bin.create({ data: { storeId: shop.id, code: "S-1", sortKey: "S-0001" } });
    await expect(db.binAssignment.update({ where: { storeId_variantId: { storeId: wh.id, variantId: p.variants[1].id } }, data: { binId: shopBin.id } })).rejects.toThrow(/another location/);
  });

  it("bulk import is all or nothing; the pick list, putaway and coverage follow the bins", async () => {
    expect(await db.$transaction((tx) => createBins(tx, staff, wh.id, ["A-1", "A-2", "A-10", "a-1"]))).toEqual({ added: 3, existing: 1 });
    await expect(db.$transaction((tx) => importAssignments(tx, staff, wh.id, `SKU,BIN\n${sku("S")},A-10\nNOPE,A-1\n${sku("M")},A-2\n${sku("M")},A-1`))).rejects.toThrow(/Nothing imported.*no size with SKU NOPE.*two bins/);
    expect(await db.binAssignment.count()).toBe(0);
    expect(await db.$transaction((tx) => importAssignments(tx, staff, wh.id, `${sku("S")}\tA-10\n${sku("M")};A-2\n`))).toEqual({ assigned: 2, bins: 2 });

    let o = await binOverview(wh.id);
    expect(o.unbinnedCount).toBe(1); // L has stock and no bin
    expect(o.units).toEqual({ total: 16, binned: 13 });
    expect(o.bins.map((b) => [b.code, b.sizes, b.units])).toEqual([["A-1", 0, 0], ["A-2", 1, 8], ["A-10", 1, 5]]);

    // a confirmed order of S, M and L allocated to the warehouse: picked in bin order, L (no bin) last
    const order = await db.order.create({ data: { email: "a@t.l", phone: "9800000000", status: "CONFIRMED", paymentMethod: "COD", subtotal: 3000, total: 3000, shippingMethod: "standard", shippingAddress: {},
      items: { create: ["L", "S", "M"].map((size) => ({ variantId: p.variants.find((v) => v.size === size)!.id, productId: p.id, name: p.name, slug: p.slug, sku: sku(size), color: "White", size, image: "", unitPrice: 1000, quantity: 1 })) } }, include: { items: true } });
    for (const it of order.items) await db.orderAllocation.create({ data: { orderId: order.id, orderItemId: it.id, variantId: it.variantId, storeId: wh.id, quantity: 1 } });
    const list = await getPickList(wh.id);
    expect(list.skus.map((s) => [s.sku, s.bin?.code ?? null])).toEqual([[sku("M"), "A-2"], [sku("S"), "A-10"], [sku("L"), null]]);
    expect(list.orders[0].lines.find((l) => l.sku === sku("M"))!.bin).toBe("A-2");

    const po = await db.purchaseOrder.create({ data: { supplier: { create: { name: "Mill" } }, status: "RECEIVED", createdById: staff.id } });
    const grn = await db.goodsReceipt.create({ data: { purchaseOrderId: po.id, receivedById: staff.id, storeId: wh.id, items: { create: ["L", "S"].map((size) => ({ poItemId: `poi-${size}`, variantId: p.variants.find((v) => v.size === size)!.id, quantity: 4, damaged: 0, landedUnitCost: 100 })) } } });
    expect((await putawayList(grn.id))!.lines.map((l) => [l.size, l.bin?.code ?? null, l.quantity])).toEqual([["S", "A-10", 4], ["L", null, 4]]);
    o = await binOverview(wh.id);
    expect(o.unbinned.map((u) => u.size)).toEqual(["L"]);
  });
});
