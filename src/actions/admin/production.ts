"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { reportError } from "@/lib/errors";
import { PayablesError } from "@/lib/payables";
import { issueMaterials, ProductionError, prdNo, receiveMaterial, receiveProduction, requirements, stopProduction, toMilli } from "@/lib/production";
import { requireStoreAccess, ScopeError } from "@/lib/scope";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const paisa = (rupees: number) => Math.round(rupees * 100);

function failure(e: unknown, where: string): { ok: false; error: string } {
  if (e instanceof ProductionError || e instanceof ScopeError || e instanceof PayablesError) return { ok: false, error: e.message };
  void reportError(where, e);
  return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
}

async function orderLocation(id: string) {
  const o = await db.productionOrder.findUnique({ where: { id }, select: { storeId: true } });
  if (!o) throw new ProductionError("Production order not found.");
  return o.storeId;
}

// ---------- materials ----------

const materialSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,30}$/, "Letters, numbers and dashes, e.g. FAB-LIN-WHT"),
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["FABRIC", "TRIM", "PACKAGING"]),
  unit: z.string().trim().min(1).max(12),
  color: z.string().trim().max(40).optional(),
  supplierId: z.string().optional(),
  minStock: z.coerce.number().min(0).max(1_000_000).default(0),
});

export async function saveMaterial(input: z.input<typeof materialSchema>, id?: string): Promise<R> {
  const me = await requirePermission("production");
  const p = materialSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the details." };
  const d = p.data;
  const clash = await db.material.findFirst({ where: { code: d.code, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { ok: false, error: `Code ${d.code} is already used.` };
  const data = { code: d.code, name: d.name, kind: d.kind, unit: d.unit, color: d.color || null, supplierId: d.supplierId || null, minStock: toMilli(d.minStock) };
  await db.$transaction(async (tx) => {
    const m = id ? await tx.material.update({ where: { id }, data }) : await tx.material.create({ data });
    await audit(tx, me, { action: id ? "material.update" : "material.create", entity: ["Material", m.id], summary: `${id ? "Updated" : "Added"} material ${d.name} (${d.code})` });
  });
  refresh();
  return { ok: true };
}

const receiveSchema = z.object({
  materialId: z.string().min(1),
  storeId: z.string().min(1),
  quantity: z.coerce.number().positive("Enter how much arrived").max(1_000_000),
  unitCost: z.coerce.number().min(0).max(1_000_000),
  supplierId: z.string().optional(),
  invoice: z.string().trim().max(60).optional(),
  vat: z.coerce.number().min(0).max(100_000_000).default(0),
  note: z.string().trim().max(200).optional(),
});

/** Fabric or trims arrived. With an invoice number, the supplier's bill is recorded too (Payables). */
export async function receiveMaterialStock(input: z.input<typeof receiveSchema>): Promise<R> {
  const me = await requirePermission("production");
  const p = receiveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the quantities." };
  const d = p.data;
  if (d.invoice && !d.supplierId) return { ok: false, error: "Choose the supplier to record their invoice." };
  try {
    await requireStoreAccess(me, d.storeId);
    await db.$transaction((tx) => receiveMaterial(tx, me, {
      materialId: d.materialId, storeId: d.storeId, quantity: toMilli(d.quantity), unitCost: paisa(d.unitCost), supplierId: d.supplierId || null,
      bill: d.invoice ? { reference: d.invoice, vatAmount: paisa(d.vat) } : null, note: d.note,
    }));
  } catch (e) {
    return failure(e, "receiveMaterialStock");
  }
  refresh();
  return { ok: true };
}

// ---------- bill of materials ----------

const bomSchema = z.object({
  lines: z.array(z.object({ materialId: z.string().min(1), quantity: z.coerce.number().positive().max(10_000), note: z.string().trim().max(80).optional() })).max(30),
  labourCost: z.coerce.number().min(0).max(100_000),
});

/** What one piece of a product uses, and the workshop's stitching charge per piece. Replaces the old list. */
export async function saveBom(productId: string, input: z.input<typeof bomSchema>): Promise<R> {
  const me = await requirePermission("production");
  const p = bomSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Each material needs a quantity per piece." };
  const ids = p.data.lines.map((l) => l.materialId);
  if (new Set(ids).size !== ids.length) return { ok: false, error: "A material is listed twice." };
  const product = await db.product.findUnique({ where: { id: productId }, select: { name: true } });
  if (!product) return { ok: false, error: "Product not found." };
  await db.$transaction(async (tx) => {
    await tx.bomLine.deleteMany({ where: { productId } });
    if (p.data.lines.length) await tx.bomLine.createMany({ data: p.data.lines.map((l) => ({ productId, materialId: l.materialId, quantity: toMilli(l.quantity), note: l.note || null })) });
    await tx.product.update({ where: { id: productId }, data: { labourCost: paisa(p.data.labourCost) } });
    await audit(tx, me, { action: "bom.save", entity: ["Product", productId], summary: `Bill of materials for ${product.name}: ${p.data.lines.length} material(s), stitching Rs. ${p.data.labourCost} a piece` });
  });
  refresh();
  return { ok: true };
}

// ---------- production orders ----------

const orderSchema = z.object({
  productId: z.string().min(1),
  workshopId: z.string().min(1, "Choose the workshop"),
  storeId: z.string().min(1, "Choose the location"),
  labourPerPiece: z.coerce.number().min(0).max(100_000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional(),
  lines: z.array(z.object({ variantId: z.string().min(1), planned: z.coerce.number().int().min(0).max(100_000) })),
});

export async function createProductionOrder(input: z.input<typeof orderSchema>): Promise<R> {
  const me = await requirePermission("production");
  const p = orderSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the order." };
  const d = p.data;
  const lines = d.lines.filter((l) => l.planned > 0);
  if (!lines.length) return { ok: false, error: "Plan at least one piece." };
  let id: string;
  try {
    await requireStoreAccess(me, d.storeId);
    const variants = await db.variant.count({ where: { id: { in: lines.map((l) => l.variantId) }, productId: d.productId } });
    if (variants !== lines.length) return { ok: false, error: "A size doesn't belong to this product." };
    id = await db.$transaction(async (tx) => {
      const o = await tx.productionOrder.create({
        data: { productId: d.productId, workshopId: d.workshopId, storeId: d.storeId, labourPerPiece: paisa(d.labourPerPiece), dueDate: d.dueDate ? new Date(`${d.dueDate}T12:00:00+05:45`) : null, note: d.note || null, createdById: me.id, lines: { create: lines } },
        include: { product: { select: { name: true } } },
      });
      const pieces = lines.reduce((s, l) => s + l.planned, 0);
      await audit(tx, me, { action: "production.create", entity: ["ProductionOrder", o.id], summary: `${prdNo(o.number)} planned: ${pieces} × ${o.product.name}` });
      return o.id;
    });
  } catch (e) {
    return failure(e, "createProductionOrder");
  }
  redirect(`/admin/production/${id}`);
}

/** Materials needed vs on hand, for the new-order form. */
export async function previewProduction(productId: string, pieces: number, storeId: string) {
  await requirePermission("production");
  if (!productId || !storeId || !(pieces > 0)) return [];
  return requirements(db, productId, Math.min(100_000, Math.floor(pieces)), storeId);
}

export async function issueProductionOrder(id: string): Promise<R> {
  const me = await requirePermission("production");
  try {
    await requireStoreAccess(me, await orderLocation(id));
    await db.$transaction((tx) => issueMaterials(tx, me, id), { timeout: 30_000 });
  } catch (e) {
    return failure(e, "issueProductionOrder");
  }
  refresh();
  return { ok: true };
}

const receiveLinesSchema = z.array(z.object({ variantId: z.string().min(1), good: z.coerce.number().int().min(0).max(100_000), rejected: z.coerce.number().int().min(0).max(100_000) })).max(200);

export async function receiveProductionOrder(id: string, input: z.input<typeof receiveLinesSchema>): Promise<R<{ message: string }>> {
  const me = await requirePermission("production");
  const p = receiveLinesSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Counts are whole pieces." };
  try {
    await requireStoreAccess(me, await orderLocation(id));
    const r = await db.$transaction((tx) => receiveProduction(tx, me, id, p.data), { timeout: 30_000 });
    refresh();
    return { ok: true, message: `PR-${r.receiptNumber}: ${r.good} good${r.rejected ? `, ${r.rejected} rejected` : ""}${r.completed ? ". Order complete." : "."}` };
  } catch (e) {
    return failure(e, "receiveProductionOrder");
  }
}

export async function stopProductionOrder(id: string, reason: string): Promise<R> {
  const me = await requirePermission("production");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) return { ok: false, error: "Say why, for the record." };
  try {
    await requireStoreAccess(me, await orderLocation(id));
    await db.$transaction((tx) => stopProduction(tx, me, id, why));
  } catch (e) {
    return failure(e, "stopProductionOrder");
  }
  refresh();
  return { ok: true };
}
