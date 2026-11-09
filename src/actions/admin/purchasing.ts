"use server";

import { reportErrorSoon } from "@/lib/errors";
import { audit, diff } from "@/lib/audit";
import { formatPrice } from "@/lib/utils";
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
import { activeLocation, moveStock } from "@/lib/stock";
import { requireStoreAccess } from "@/lib/scope";
import { reorderPlan } from "@/lib/insights";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };



// ---------- Suppliers ----------

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Enter the supplier name").max(120),
  pan: z.string().trim().regex(/^\d{9}$/, "PAN is 9 digits").optional().or(z.literal("")),
  contact: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  country: z.string().trim().max(60).default("Nepal"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  active: z.boolean().default(true),
  paymentTermsDays: z.coerce.number().int().min(0, "0–365 days").max(365, "0–365 days").default(30),
});

export async function saveSupplier(input: unknown, id?: string): Promise<R<{ id: string }>> {
  const me = await requirePermission("purchasing");
  const p = supplierSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error) };
  const data = Object.fromEntries(Object.entries(p.data).map(([k, v]) => [k, v === "" ? null : v])) as typeof p.data;
  const s = await db.$transaction(async (tx) => {
    const before = id ? await tx.supplier.findUnique({ where: { id } }) : null;
    const saved = id ? await tx.supplier.update({ where: { id }, data }) : await tx.supplier.create({ data });
    const d = before ? diff(before as Record<string, unknown>, data as Record<string, unknown>, Object.keys(data)) : null;
    if (!before) await audit(tx, me, { action: "supplier.create", entity: ["Supplier", saved.id], summary: `Added supplier ${saved.name}` });
    else if (d && Object.keys(d.changes).length) await audit(tx, me, { action: "supplier.update", entity: ["Supplier", saved.id], summary: `${saved.name}: ${d.text}`, changes: d.changes });
    return saved;
  });
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
  await audit(db, me, { action: "po.create", entity: ["PurchaseOrder", po.id], summary: `Draft PO-${String(po.number).padStart(5, "0")} for ${supplier.name}` });
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
  const me = await requirePermission("purchasing");
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
    const value = (items: { quantityOrdered: number; unitCost: number }[]) => items.reduce((s, i) => s + i.quantityOrdered * i.unitCost, 0);
    const before = value(po.items), after = value(d.items);
    if (before !== after || po.landedCost !== Math.round(d.landedCost) || po.items.length !== d.items.length) {
      await audit(tx, me, { action: "po.update", entity: ["PurchaseOrder", po.id], summary: `PO-${String(po.number).padStart(5, "0")} edited: ${d.items.length} lines, goods ${formatPrice(before)} → ${formatPrice(after)}${po.landedCost !== Math.round(d.landedCost) ? `, landed cost ${formatPrice(po.landedCost)} → ${formatPrice(Math.round(d.landedCost))}` : ""}`, changes: { lines: [po.items.length, d.items.length], goodsValue: [before, after], landedCost: [po.landedCost, Math.round(d.landedCost)] } });
    }
  });
  refresh();
  return { ok: true };
}

export async function setPurchaseOrderStatus(poId: string, to: "ORDERED" | "CANCELLED"): Promise<R> {
  const me = await requirePermission("purchasing");
  const po = await db.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true, supplier: { select: { name: true } } } });
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
  const goods = po.items.reduce((s, i) => s + i.quantityOrdered * i.unitCost, 0);
  await audit(db, me, { action: to === "ORDERED" ? "po.order" : "po.cancel", entity: ["PurchaseOrder", poId], summary: `PO-${String(po.number).padStart(5, "0")} (${po.supplier.name}, ${formatPrice(goods)}) ${to === "ORDERED" ? "placed" : "cancelled"}`, changes: { status: [po.status, to] } });
  refresh();
  return { ok: true };
}

// ---------- Goods receipt ----------

const receiptSchema = z.object({
  poId: z.string(),
  /** location the goods are counted into (default: the main warehouse) */
  storeId: z.string().optional(),
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
      const into = await activeLocation(tx, d.storeId);
      await requireStoreAccess(me, into.id, tx); // goods are counted in by staff at that location
      const receipt = await tx.goodsReceipt.create({ data: { purchaseOrderId: po.id, receivedById: me.id, storeId: into.id, note: d.note || null }, select: { id: true, number: true } });

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
          // cost blends over stock at every location (one weighted-average cost per variant)
          await tx.variant.update({ where: { id: item.variantId }, data: { costPrice: weightedAverageCost(v.stock, v.costPrice, l.quantity, landed) } });
          await moveStock(tx, { variantId: item.variantId, storeId: into.id, delta: l.quantity, reason: "RECEIVED", note: `PO-${String(po.number).padStart(5, "0")} · GRN-${receipt.number}`, actorId: me.id });
        }
        await tx.goodsReceiptItem.create({ data: { receiptId: receipt.id, poItemId: item.id, variantId: item.variantId, quantity: l.quantity, damaged: l.damaged, landedUnitCost: landed } });
      }

      const fresh = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
      const complete = fresh.every((i) => i.quantityReceived + i.quantityDamaged >= i.quantityOrdered);
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: complete ? "RECEIVED" : "PARTIALLY_RECEIVED" } });
      await queueBackInStock(tx, lines.filter((l) => l.quantity > 0).flatMap((l) => po.items.filter((i) => i.id === l.poItemId).map((i) => i.variantId)));
      const good = lines.reduce((s, l) => s + l.quantity, 0), bad = lines.reduce((s, l) => s + l.damaged, 0);
      await audit(tx, me, { action: "po.receive", entity: ["PurchaseOrder", po.id], summary: `GRN-${receipt.number} on PO-${String(po.number).padStart(5, "0")}: ${good} good unit${good === 1 ? "" : "s"} into ${into.name}${bad ? `, ${bad} damaged` : ""}${complete ? " — order complete" : ""}`, changes: { receiptId: receipt.id, good, damaged: bad } });
      return receipt;
    }, { timeout: 30_000 });
    revalidateTag("products", { expire: 0 });
    after(() => dispatchNotifications().catch(reportErrorSoon("dispatchNotifications")));
    refresh();
    return { ok: true, receiptNumber: result.number };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Receiving failed." };
  }
}

// ---------- Reorder suggestions ----------

export type ReorderSuggestion = { variantId: string; sku: string; name: string; color: string; size: string; stock: number; sold30: number; suggested: number; cost: number | null; supplierId: string | null; supplierName: string | null };

/** What to reorder, by sales speed (same rule as Admin → Insights): runs out within lead time + 2 weeks. */
export async function getReorderSuggestions(): Promise<ReorderSuggestion[]> {
  await requirePermission("purchasing");
  return (await reorderPlan()).slice(0, 60).map((r) => ({
    variantId: r.variantId, sku: r.sku, name: r.name, color: r.color, size: r.size, stock: r.stock, sold30: r.sold30,
    suggested: r.suggested, cost: r.cost, supplierId: r.supplierId, supplierName: r.supplierName,
  }));
}
