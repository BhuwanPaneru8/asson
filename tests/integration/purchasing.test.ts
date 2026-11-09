import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { receiveGoods, savePurchaseOrder, setPurchaseOrderStatus } from "@/actions/admin/purchasing";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";
import { RedirectError } from "../support/next-mocks";

describe("purchasing & goods receipt", () => {
  beforeEach(resetDb);

  async function placedPO() {
    const p = await makeProduct({ price: 3199, cost: 1454, stock: { "28": 0, "30": 35 } });
    const manager = await makeUser("MANAGER");
    actAs(manager);
    const supplier = await db.supplier.create({ data: { name: "Tank Road" } });
    const po = await db.purchaseOrder.create({ data: { supplierId: supplier.id, createdById: manager.id } });
    const saved = await savePurchaseOrder({ poId: po.id, landedCost: 800_000, items: [
      { variantId: p.variants[0].id, quantityOrdered: 30, unitCost: 145_400 },
      { variantId: p.variants[1].id, quantityOrdered: 30, unitCost: 145_400 },
    ] });
    expect(saved.ok).toBe(true);
    return { p, po, manager };
  }

  it("adds only counted good units, records damage, and blends landed cost into the average", async () => {
    const { p, po } = await placedPO();
    expect((await setPurchaseOrderStatus(po.id, "ORDERED")).ok).toBe(true);
    const items = await db.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id }, orderBy: { variant: { sku: "asc" } } });
    const r = await receiveGoods({ poId: po.id, lines: [{ poItemId: items[0].id, quantity: 28, damaged: 2 }, { poItemId: items[1].id, quantity: 30, damaged: 0 }] });
    expect(r.ok).toBe(true);
    // goods Rs 87,240 + Rs 8,000 freight → landed Rs 1,454 × (1 + 8000/87240) = Rs 1,587.33
    const v28 = await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } });
    const v30 = await db.variant.findUniqueOrThrow({ where: { id: p.variants[1].id } });
    expect(v28).toMatchObject({ stock: 28, costPrice: 158_733 });
    expect(v30.stock).toBe(65);
    expect(v30.costPrice).toBe(Math.round((35 * 145_400 + 30 * 158_733) / 65));
    expect(await db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).toMatchObject({ status: "RECEIVED" });
  });

  it("refuses to receive more than is outstanding, and can't cancel after receiving", async () => {
    const { po } = await placedPO();
    await setPurchaseOrderStatus(po.id, "ORDERED");
    const items = await db.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
    expect((await receiveGoods({ poId: po.id, lines: [{ poItemId: items[0].id, quantity: 31, damaged: 0 }] })).ok).toBe(false);
    expect((await receiveGoods({ poId: po.id, lines: [{ poItemId: items[0].id, quantity: 10, damaged: 0 }] })).ok).toBe(true);
    expect(await db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).toMatchObject({ status: "PARTIALLY_RECEIVED" });
    expect((await setPurchaseOrderStatus(po.id, "CANCELLED")).ok).toBe(false);
    // received lines are frozen
    const saved = await savePurchaseOrder({ poId: po.id, landedCost: 800_000, items: items.map((i) => ({ variantId: i.variantId, quantityOrdered: i.quantityOrdered, unitCost: 1 })) });
    expect(saved.ok).toBe(false);
  });

  it("cashiers can't touch purchasing", async () => {
    const { po } = await placedPO();
    actAs(await makeUser("CASHIER"));
    await expect(setPurchaseOrderStatus(po.id, "ORDERED")).rejects.toBeInstanceOf(RedirectError);
  });
});
