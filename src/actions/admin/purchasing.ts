"use server";

import { redirect } from "next/navigation";
import { queueBackInStock } from "@/lib/stock-alerts";
import { dispatchNotifications } from "@/lib/notifications";
import { after } from "next/server";
import { refresh, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { fieldErrors } from "@/lib/validators";
import { landedUnitCost, weightedAverageCost } from "@/lib/costing";
import { lookupVariants, type VariantHit } from "@/lib/pos";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };



// ---------- Suppliers ----------

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Enter the supplier name").max(120),
  contact: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  country: z.string().trim().max(60).default("Nepal"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export async function saveSupplier(input: unknown, id?: string): Promise<R<{ id: string }>> {
  await requirePermission("purchasing");
  const p = supplierSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error) };
  const data = Object.fromEntries(Object.entries(p.data).map(([k, v]) => [k, v === "" ? null : v])) as typeof p.data;
  const s = id ? await db.supplier.update({ where: { id }, data }) : await db.supplier.create({ data });
  refresh();
  return { ok: true, id: s.id };
}

// ---------- Purchase orders ----------

export async function purchasingLookup(q: string): Promise<VariantHit[]> {
  await requirePermission("purchasing");
  return lookupVariants(q, { activeOnly: false });
}

export async function createPurchaseOrder(supplierId: string, variants: { variantId: string; quantity: number; unitCost?: number | null }[] = []) {
  const me = await requirePermission("purchasing");
  const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new Error("Supplier not found");
  // default unit cost: the variant's current average cost
  const costs = await db.variant.findMany({ where: { id: { in: variants.map((v) => v.variantId) } }, select: { id: true, costPrice: true } });
  const po = await db.purchaseOrder.create({
    data: {
      supplierId, createdById: me.id,
      items: { create: variants.filter((v) => v.quantity > 0).map((v) => ({ variantId: v.variantId, quantityOrdered: v.quantity, unitCost: v.unitCost ?? costs.find((c) => c.id === v.variantId)?.costPrice ?? 0 })) },
    },
  });
  redirect(`/admin/purchasing/${po.id}`);
}

const draftSchema = z.object({
  poId: z.string(),
  expectedAt: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
  landedCost: z.number().min(0).max(100_000_000), // paisa
  items: z.array(z.object({ variantId: z.string(), quantityOrdered: z.number().int().min(1).max(100_000), unitCost: z.number().int().min(0).max(100_000_000) })).max(500),
});

export async function savePurchaseOrder(input: z.input<typeof draftSchema>): Promise<R> {
  await requirePermission("purchasing");
  const p = draftSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check quantities and costs." };
  const d = p.data;
  const po = await db.purchaseOrder.findUnique({ where: { id: d.poId }, include: { items: true } });
  if (!po) return { ok: false, error: "Purchase order not found." };
  if (po.status === "RECEIVED" || po.status === "CANCELLED") return { ok: false, error: "This purchase order is closed." };
  const received = po.items.filter((i) => i.quantityReceived + i.quantityDamaged > 0);
  // once goods have arrived, those lines are frozen (cost already flowed into inventory)
  for (const r of received) {
    const next = d.items.find((i) => i.variantId === r.variantId);
    if (!next) return { ok: false, error: "Lines that have already been received can't be removed." };
    if (next.unitCost !== r.unitCost) return { ok: false, error: "Unit cost of received lines can't change." };
    if (next.quantityOrdered < r.quantityReceived + r.quantityDamaged) return { ok: false, error: "Ordered quantity can't be below what was received." };
  }
  if (received.length && d.landedCost !== po.landedCost) return { ok: false, error: "Landed cost is locked once goods have been received." };
  await db.$transaction(async (tx) => {
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { landedCost: Math.round(d.landedCost), notes: d.notes || null, expectedAt: d.expectedAt ? new Date(`${d.expectedAt}T12:00:00+05:45`) : null } });
    const keep = new Set(d.items.map((i) => i.variantId));
    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po.id, variantId: { notIn: [...keep] }, quantityReceived: 0, quantityDamaged: 0 } });
    for (const i of d.items) {
      await tx.purchaseOrderItem.upsert({
        where: { purchaseOrderId_variantId: { purchaseOrderId: po.id, variantId: i.variantId } },
        update: { quantityOrdered: i.quantityOrdered, unitCost: i.unitCost },
        create: { purchaseOrderId: po.id, variantId: i.variantId, quantityOrdered: i.quantityOrdered, unitCost: i.unitCost },
      });
    }
  });
  refresh();
  return { ok: true };
}

export async function setPurchaseOrderStatus(poId: string, to: "ORDERED" | "CANCELLED"): Promise<R> {
  await requirePermission("purchasing");
  const po = await db.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
  if (!po) return { ok: false, error: "Not found." };
  if (to === "ORDERED") {
    if (po.status !== "DRAFT") return { ok: false, error: "Only drafts can be placed." };
    if (!po.items.length) return { ok: false, error: "Add at least one item." };
    if (po.items.some((i) => i.unitCost <= 0)) return { ok: false, error: "Every line needs a unit cost before ordering." };
    await db.purchaseOrder.update({ where: { id: poId }, data: { status: "ORDERED", orderedAt: new Date() } });
  } else {
    if (po.items.some((i) => i.quantityReceived + i.quantityDamaged > 0)) return { ok: false, error: "Goods have been received — this order can't be cancelled." };
    await db.purchaseOrder.update({ where: { id: poId }, data: { status: "CANCELLED" } });
  }
  refresh();
  return { ok: true };
}

// ---------- Goods receipt ----------

const receiptSchema = z.object({
  poId: z.string(),
  note: z.string().trim().max(500).optional(),
  lines: z.array(z.object({ poItemId: z.string(), quantity: z.number().int().min(0).max(100_000), damaged: z.number().int().min(0).max(100_000) })).min(1),
});

/**
 * Count & verify → stock goes up by GOOD units counted (never by what the invoice says).
 * Each unit's landed cost blends into the variant's weighted-average cost.
 */
export async function receiveGoods(input: z.input<typeof receiptSchema>): Promise<R<{ receiptNumber: number }>> {
  const me = await requirePermission("purchasing");
  const p = receiptSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Enter counted quantities." };
  const d = p.data;
  const lines = d.lines.filter((l) => l.quantity + l.damaged > 0);
  if (!lines.length) return { ok: false, error: "Enter at least one counted quantity." };

  try {
    const result = await db.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({ where: { id: d.poId }, include: { items: true } });
      if (!po) throw new Error("Purchase order not found.");
      if (po.status !== "ORDERED" && po.status !== "PARTIALLY_RECEIVED") throw new Error("Place the order before receiving goods.");
      const goodsValue = po.items.reduce((s, i) => s + i.unitCost * i.quantityOrdered, 0);
      const receipt = await tx.goodsReceipt.create({ data: { purchaseOrderId: po.id, receivedById: me.id, note: d.note || null }, select: { id: true, number: true } });

      for (const l of lines) {
        const item = po.items.find((i) => i.id === l.poItemId);
        if (!item) throw new Error("A line doesn't belong to this order.");
        const outstanding = item.quantityOrdered - item.quantityReceived - item.quantityDamaged;
        if (l.quantity + l.damaged > outstanding) throw new Error(`Only ${outstanding} unit(s) are still expected for one of the lines. Edit the order if the supplier sent more.`);
        // optimistic lock so two people can't receive the same line at once
        const upd = await tx.purchaseOrderItem.updateMany({
          where: { id: item.id, quantityReceived: item.quantityReceived, quantityDamaged: item.quantityDamaged },
          data: { quantityReceived: { increment: l.quantity }, quantityDamaged: { increment: l.damaged } },
        });
        if (!upd.count) throw new Error("Someone else is receiving this order. Refresh and try again.");

        const landed = landedUnitCost(item.unitCost, po.landedCost, goodsValue);
        if (l.quantity > 0) {
          const v = await tx.variant.findUniqueOrThrow({ where: { id: item.variantId }, select: { stock: true, costPrice: true } });
          await tx.variant.update({ where: { id: item.variantId }, data: { stock: { increment: l.quantity }, costPrice: weightedAverageCost(v.stock, v.costPrice, l.quantity, landed) } });
          await tx.inventoryLog.create({ data: { variantId: item.variantId, delta: l.quantity, reason: "RECEIVED", note: `PO-${String(po.number).padStart(5, "0")} · GRN-${receipt.number}`, actorId: me.id } });
        }
        await tx.goodsReceiptItem.create({ data: { receiptId: receipt.id, poItemId: item.id, variantId: item.variantId, quantity: l.quantity, damaged: l.damaged, landedUnitCost: landed } });
      }

      const fresh = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
      const complete = fresh.every((i) => i.quantityReceived + i.quantityDamaged >= i.quantityOrdered);
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: complete ? "RECEIVED" : "PARTIALLY_RECEIVED" } });
      await queueBackInStock(tx, lines.filter((l) => l.quantity > 0).flatMap((l) => po.items.filter((i) => i.id === l.poItemId).map((i) => i.variantId)));
      return receipt;
    }, { timeout: 30_000 });
    revalidateTag("products", { expire: 0 });
    after(() => dispatchNotifications().catch((e) => console.error("dispatchNotifications", e)));
    refresh();
    return { ok: true, receiptNumber: result.number };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Receiving failed." };
  }
}

// ---------- Reorder suggestions ----------

export type ReorderSuggestion = { variantId: string; sku: string; name: string; color: string; size: string; stock: number; sold30: number; suggested: number; cost: number | null; supplierId: string | null; supplierName: string | null };

/** Low-stock variants with recent demand → how many to order to cover ~45 days. */
export async function getReorderSuggestions(): Promise<ReorderSuggestion[]> {
  await requirePermission("purchasing");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const low = await db.variant.findMany({
    where: { product: { status: "ACTIVE" }, stock: { lte: 5 } },
    include: { product: { select: { name: true } }, purchaseItems: { orderBy: { purchaseOrder: { createdAt: "desc" } }, take: 1, include: { purchaseOrder: { select: { supplierId: true, supplier: { select: { name: true } } } } } } },
    take: 300,
  });
  const sold = await db.orderItem.groupBy({ by: ["variantId"], where: { variantId: { in: low.map((v) => v.id) }, order: { createdAt: { gte: since }, status: { notIn: ["CANCELLED"] } } }, _sum: { quantity: true } });
  // units already on open POs shouldn't be ordered twice
  const onOrder = await db.purchaseOrderItem.findMany({ where: { variantId: { in: low.map((v) => v.id) }, purchaseOrder: { status: { in: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"] } } }, select: { variantId: true, quantityOrdered: true, quantityReceived: true, quantityDamaged: true } });
  return low
    .map((v) => {
      const sold30 = sold.find((s) => s.variantId === v.id)?._sum.quantity ?? 0;
      const incoming = onOrder.filter((o) => o.variantId === v.id).reduce((s, o) => s + o.quantityOrdered - o.quantityReceived - o.quantityDamaged, 0);
      const target = Math.ceil((sold30 / 30) * 45) + v.lowStockThreshold;
      const last = v.purchaseItems[0]?.purchaseOrder;
      return { variantId: v.id, sku: v.sku, name: v.product.name, color: v.color, size: v.size, stock: v.stock, sold30, suggested: Math.max(0, target - v.stock - incoming), cost: v.costPrice, supplierId: last?.supplierId ?? null, supplierName: last?.supplier.name ?? null };
    })
    .filter((s) => s.suggested > 0)
    .sort((a, b) => b.sold30 - a.sold30)
    .slice(0, 60);
}
