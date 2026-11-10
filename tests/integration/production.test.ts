import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { issueMaterials, receiveMaterial, receiveProduction, requirements, stopProduction, toMilli } from "@/lib/production";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;
type P = Awaited<ReturnType<typeof makeProduct>>;

describe("own production", () => {
  let owner: U, wh: L, p: P, fabric: { id: string }, buttons: { id: string }, mill: { id: string }, workshop: { id: string };

  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN");
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    p = await makeProduct({ name: "Linen Shirt", stock: { M: 0, L: 0 }, at: wh.id });
    mill = await db.supplier.create({ data: { name: "Everest Textiles" } });
    workshop = await db.supplier.create({ data: { name: "Patan Stitching House", paymentTermsDays: 15 } });
    fabric = await db.material.create({ data: { code: "FAB-LIN-WHT", name: "White linen", kind: "FABRIC", unit: "m", supplierId: mill.id } });
    buttons = await db.material.create({ data: { code: "TRM-BTN-12", name: "Shell buttons", kind: "TRIM", unit: "pcs" } });
    await db.bomLine.createMany({ data: [{ productId: p.id, materialId: fabric.id, quantity: toMilli(1.6) }, { productId: p.id, materialId: buttons.id, quantity: toMilli(8) }] });
    await db.product.update({ where: { id: p.id }, data: { labourCost: 15_000 } }); // Rs 150 a piece
  });

  const order = async (planned: Record<string, number>) => db.productionOrder.create({
    data: { productId: p.id, workshopId: workshop.id, storeId: wh.id, labourPerPiece: 15_000, createdById: owner.id,
      lines: { create: p.variants.filter((v) => planned[v.size]).map((v) => ({ variantId: v.id, planned: planned[v.size] })) } },
  });

  it("receiving fabric blends its cost and records the mill's invoice with VAT", async () => {
    await db.$transaction((tx) => receiveMaterial(tx, owner, { materialId: fabric.id, storeId: wh.id, quantity: toMilli(100), unitCost: 40_000, supplierId: mill.id, bill: { reference: "EV-901", vatAmount: 520_000 } }));
    await db.$transaction((tx) => receiveMaterial(tx, owner, { materialId: fabric.id, storeId: wh.id, quantity: toMilli(50), unitCost: 46_000 }));
    expect(await db.material.findUniqueOrThrow({ where: { id: fabric.id } })).toMatchObject({ costPerUnit: 42_000 }); // (100×400 + 50×460) / 150
    expect(await db.materialStock.findFirstOrThrow({ where: { materialId: fabric.id } })).toMatchObject({ quantity: 150_000 });
    expect(await db.supplierBill.findFirstOrThrow()).toMatchObject({ supplierId: mill.id, reference: "EV-901", amount: 4_000_000 + 520_000, vatAmount: 520_000 });
  });

  it("issuing needs every material on hand (with the cutting allowance) and takes it all at once", async () => {
    await db.$transaction((tx) => receiveMaterial(tx, owner, { materialId: fabric.id, storeId: wh.id, quantity: toMilli(100), unitCost: 40_000 }));
    const o = await order({ M: 30, L: 20 }); // 50 pieces
    const req = await requirements(db, p.id, 50, wh.id);
    expect(req.find((r) => r.code === "FAB-LIN-WHT")).toMatchObject({ need: toMilli(82.4), have: toMilli(100), short: 0 }); // 1.6 × 50 × 1.03
    expect(req.find((r) => r.code === "TRM-BTN-12")).toMatchObject({ need: toMilli(412), short: toMilli(412) });
    await expect(db.$transaction((tx) => issueMaterials(tx, owner, o.id))).rejects.toThrow(/Shell buttons short by 412 pcs/);
    expect((await db.materialStock.findFirstOrThrow({ where: { materialId: fabric.id } })).quantity).toBe(toMilli(100)); // nothing taken

    await db.$transaction((tx) => receiveMaterial(tx, owner, { materialId: buttons.id, storeId: wh.id, quantity: toMilli(500), unitCost: 500 }));
    expect(await db.$transaction((tx) => issueMaterials(tx, owner, o.id))).toEqual({ materialsCost: 82.4 * 40_000 + 412 * 500 });
    expect(await db.productionOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: "ISSUED" });
    expect((await db.materialStock.findFirstOrThrow({ where: { materialId: fabric.id } })).quantity).toBe(toMilli(17.6));
    await expect(db.$transaction((tx) => issueMaterials(tx, owner, o.id))).rejects.toThrow(/already been issued/);
  });

  it("deliveries go into stock at real cost, bill the workshop for good pieces, and complete the order", async () => {
    await db.$transaction((tx) => receiveMaterial(tx, owner, { materialId: fabric.id, storeId: wh.id, quantity: toMilli(100), unitCost: 40_000 }));
    await db.$transaction((tx) => receiveMaterial(tx, owner, { materialId: buttons.id, storeId: wh.id, quantity: toMilli(500), unitCost: 500 }));
    const o = await order({ M: 30, L: 20 });
    await db.$transaction((tx) => issueMaterials(tx, owner, o.id));
    const [m, l] = [p.variants.find((v) => v.size === "M")!, p.variants.find((v) => v.size === "L")!];

    const r1 = await db.$transaction((tx) => receiveProduction(tx, owner, o.id, [{ variantId: m.id, good: 28, rejected: 2 }]));
    // materials (3,296,000 + 206,000) / 50 planned = 70,040 + labour 15,000
    expect(r1).toMatchObject({ good: 28, rejected: 2, unitCost: 85_040, labourAmount: 420_000, completed: false });
    expect(await db.storeStock.findFirstOrThrow({ where: { variantId: m.id, storeId: wh.id } })).toMatchObject({ quantity: 28 });
    expect((await db.variant.findUniqueOrThrow({ where: { id: m.id } })).costPrice).toBe(85_040);
    expect(await db.supplierBill.findFirstOrThrow({ where: { supplierId: workshop.id } })).toMatchObject({ reference: expect.stringMatching(/^PRD-\d{5}\/PR-\d+$/), amount: 420_000 });
    expect(await db.inventoryLog.findFirstOrThrow({ where: { variantId: m.id } })).toMatchObject({ reason: "PRODUCED", delta: 28 });

    await expect(db.$transaction((tx) => receiveProduction(tx, owner, o.id, [{ variantId: l.id, good: 30, rejected: 0 }]))).rejects.toThrow(/more pieces than were ordered/);
    const r2 = await db.$transaction((tx) => receiveProduction(tx, owner, o.id, [{ variantId: l.id, good: 20, rejected: 0 }]));
    expect(r2.completed).toBe(true);
    expect(await db.productionOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: "COMPLETED", completedAt: expect.any(Date) });
    expect(await db.supplierBill.count({ where: { supplierId: workshop.id } })).toBe(2);
    // stock still adds up across locations (the database trigger)
    const v = await db.variant.findUniqueOrThrow({ where: { id: l.id } });
    expect(v.stock).toBe(20);
  });

  it("cancelling before any delivery puts the materials back; after deliveries it closes short", async () => {
    await db.$transaction((tx) => receiveMaterial(tx, owner, { materialId: fabric.id, storeId: wh.id, quantity: toMilli(100), unitCost: 40_000 }));
    await db.$transaction((tx) => receiveMaterial(tx, owner, { materialId: buttons.id, storeId: wh.id, quantity: toMilli(500), unitCost: 500 }));
    const o = await order({ M: 10 });
    await db.$transaction((tx) => issueMaterials(tx, owner, o.id));
    expect(await db.$transaction((tx) => stopProduction(tx, owner, o.id, "workshop closed for Tihar"))).toEqual({ returned: 2, closed: false });
    expect((await db.materialStock.findFirstOrThrow({ where: { materialId: fabric.id } })).quantity).toBe(toMilli(100));
    expect(await db.productionOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: "CANCELLED", materialsCost: 0 });

    const o2 = await order({ M: 10 });
    await db.$transaction((tx) => issueMaterials(tx, owner, o2.id));
    await db.$transaction((tx) => receiveProduction(tx, owner, o2.id, [{ variantId: p.variants.find((v) => v.size === "M")!.id, good: 6, rejected: 0 }]));
    expect(await db.$transaction((tx) => stopProduction(tx, owner, o2.id, "rest cancelled"))).toEqual({ returned: 0, closed: true });
    expect((await db.productionOrder.findUniqueOrThrow({ where: { id: o2.id } })).status).toBe("COMPLETED");
    expect(await db.auditLog.count({ where: { action: { startsWith: "production." } } })).toBe(5);
  });

  it("material stock can never go below zero, even if code tries", async () => {
    await db.$transaction((tx) => receiveMaterial(tx, owner, { materialId: fabric.id, storeId: wh.id, quantity: 1000, unitCost: 40_000 }));
    await expect(db.materialStock.updateMany({ data: { quantity: -1 } })).rejects.toThrow();
  });
});
