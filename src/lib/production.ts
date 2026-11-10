import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { audit, type AuditActor } from "./audit";
import { store } from "./config";
import { weightedAverageCost } from "./costing";
import { recordBill } from "./payables";
import { ktmDate } from "./pos";
import { moveStock } from "./stock";
import { queueBackInStock } from "./stock-alerts";
import { formatPrice } from "./utils";

// Own production: fabric and trims in, finished pieces out.
//   1. Materials are received into a location at a cost (weighted average per material, like goods).
//   2. A product's bill of materials (BomLine) says what one piece uses; its labourCost is the workshop's
//      stitching charge per piece.
//   3. A production order (DRAFT) plans pieces per size at one location for one workshop.
//   4. Issuing takes the materials for the whole order (plus a cutting allowance) out of that location's
//      stock in one go; any shortage stops it with the list of what's missing.
//   5. Each delivery from the workshop is counted (good / rejected). Good pieces go into stock at
//      cost = materials per planned piece + labour, blended into the size's weighted-average cost; the
//      workshop's charge for the good pieces becomes a supplier bill automatically.
// Quantities of material are milli-units (1 m = 1000) so fractions of a metre are exact.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class ProductionError extends Error {}

export const prdNo = (n: number) => `PRD-${String(n).padStart(5, "0")}`;
export const MILLI = 1000;
/** 12.5 → 12500; rounds to the nearest milli-unit */
export const toMilli = (units: number) => Math.round(units * MILLI);
/** 12500, "m" → "12.5 m" */
export const fmtQty = (milli: number, unit: string) => `${(milli / MILLI).toLocaleString("en-IN", { maximumFractionDigits: 3 })} ${unit}`;
/** cost of `milli` milli-units at `perUnit` paisa per whole unit */
export const costOf = (milli: number, perUnit: number | null | undefined) => Math.round((milli * (perUnit ?? 0)) / MILLI);

export type MaterialMove = { materialId: string; storeId: string; delta: number; reason: "RECEIVED" | "ISSUED" | "RETURNED" | "ADJUST"; unitCost?: number | null; note?: string | null; supplierId?: string | null; productionOrderId?: string | null; actorId?: string | null };

/** Change material stock at one location and log it. Removals are conditional; false when there isn't enough. */
export async function moveMaterial(tx: Tx, m: MaterialMove): Promise<boolean> {
  if (!Number.isInteger(m.delta)) throw new ProductionError("Material moves are in whole milli-units.");
  if (m.delta > 0) {
    await tx.materialStock.upsert({
      where: { storeId_materialId: { storeId: m.storeId, materialId: m.materialId } },
      create: { storeId: m.storeId, materialId: m.materialId, quantity: m.delta },
      update: { quantity: { increment: m.delta } },
    });
  } else if (m.delta < 0) {
    const res = await tx.materialStock.updateMany({ where: { storeId: m.storeId, materialId: m.materialId, quantity: { gte: -m.delta } }, data: { quantity: { increment: m.delta } } });
    if (!res.count) return false;
  }
  await tx.materialLog.create({
    data: { materialId: m.materialId, storeId: m.storeId, delta: m.delta, reason: m.reason, unitCost: m.unitCost ?? null, note: m.note?.slice(0, 200) || null, supplierId: m.supplierId ?? null, productionOrderId: m.productionOrderId ?? null, actorId: m.actorId ?? null },
  });
  return true;
}

export type MaterialReceipt = { materialId: string; storeId: string; quantity: number; unitCost: number; supplierId?: string | null; bill?: { reference: string; vatAmount: number } | null; note?: string };

/** Fabric/trims arrive: stock up, blend the cost, and (optionally) record the supplier's invoice. */
export async function receiveMaterial(tx: Tx, actor: Actor, d: MaterialReceipt) {
  if (d.quantity <= 0) throw new ProductionError("Enter how much arrived.");
  const mat = await tx.material.findUnique({ where: { id: d.materialId }, select: { id: true, code: true, name: true, unit: true, costPerUnit: true } });
  if (!mat) throw new ProductionError("Material not found.");
  const onHand = (await tx.materialStock.aggregate({ where: { materialId: mat.id }, _sum: { quantity: true } }))._sum.quantity ?? 0;
  await tx.material.update({ where: { id: mat.id }, data: { costPerUnit: weightedAverageCost(onHand, mat.costPerUnit, d.quantity, d.unitCost) } });
  await moveMaterial(tx, { materialId: mat.id, storeId: d.storeId, delta: d.quantity, reason: "RECEIVED", unitCost: d.unitCost, supplierId: d.supplierId, note: d.note || d.bill?.reference, actorId: actor.id });
  const goods = costOf(d.quantity, d.unitCost);
  const bill = d.bill && d.supplierId
    ? await recordBill(tx, actor, { supplierId: d.supplierId, reference: d.bill.reference, billDate: ktmDate(), amount: goods + d.bill.vatAmount, vatAmount: d.bill.vatAmount, note: `${mat.code} ${fmtQty(d.quantity, mat.unit)}` })
    : null;
  await audit(tx, actor, { action: "material.receive", entity: ["Material", mat.id], summary: `${fmtQty(d.quantity, mat.unit)} of ${mat.name} (${mat.code}) received at ${formatPrice(d.unitCost)}/${mat.unit}${bill ? `, invoice ${d.bill!.reference} recorded` : ""}`, changes: { storeId: d.storeId, quantity: d.quantity, unitCost: d.unitCost } });
  return { goods, billId: bill?.id ?? null };
}

/** Materials one order needs: BOM × planned pieces, plus the cutting allowance; and what the location has. */
export async function requirements(tx: Tx | PrismaClient, productId: string, pieces: number, storeId: string) {
  const bom = await tx.bomLine.findMany({ where: { productId }, include: { material: { select: { id: true, code: true, name: true, unit: true, costPerUnit: true } } } });
  const stock = await tx.materialStock.findMany({ where: { storeId, materialId: { in: bom.map((b) => b.materialId) } }, select: { materialId: true, quantity: true } });
  const allowance = 1 + store.production.wastagePercent / 100;
  return bom.map((b) => {
    const need = Math.ceil(b.quantity * pieces * allowance);
    const have = stock.find((s) => s.materialId === b.materialId)?.quantity ?? 0;
    return { materialId: b.materialId, code: b.material.code, name: b.material.name, unit: b.material.unit, perPiece: b.quantity, need, have, short: Math.max(0, need - have), cost: costOf(need, b.material.costPerUnit) };
  });
}

/** Send the materials for the whole order to the workshop. All or nothing. */
export async function issueMaterials(tx: Tx, actor: Actor, orderId: string) {
  const o = await tx.productionOrder.findUnique({ where: { id: orderId }, include: { lines: true, product: { select: { name: true } }, workshop: { select: { name: true } } } });
  if (!o) throw new ProductionError("Production order not found.");
  if (o.status !== "DRAFT") throw new ProductionError(`${prdNo(o.number)} has already been issued.`);
  const pieces = o.lines.reduce((s, l) => s + l.planned, 0);
  const req = await requirements(tx, o.productId, pieces, o.storeId);
  const short = req.filter((r) => r.short > 0);
  if (short.length) throw new ProductionError(`Not enough at this location: ${short.map((r) => `${r.name} short by ${fmtQty(r.short, r.unit)}`).join("; ")}.`);
  let cost = 0;
  for (const r of req) {
    const unitCost = (await tx.material.findUniqueOrThrow({ where: { id: r.materialId }, select: { costPerUnit: true } })).costPerUnit;
    if (!(await moveMaterial(tx, { materialId: r.materialId, storeId: o.storeId, delta: -r.need, reason: "ISSUED", unitCost, productionOrderId: o.id, note: `${prdNo(o.number)} to ${o.workshop.name}`, actorId: actor.id })))
      throw new ProductionError(`${r.name} was just used elsewhere. Refresh and try again.`);
    cost += costOf(r.need, unitCost);
  }
  const upd = await tx.productionOrder.updateMany({ where: { id: o.id, status: "DRAFT" }, data: { status: "ISSUED", materialsCost: cost, issuedAt: new Date() } });
  if (!upd.count) throw new ProductionError("Someone else is issuing this order. Refresh and try again.");
  await audit(tx, actor, { action: "production.issue", entity: ["ProductionOrder", o.id], summary: `${prdNo(o.number)}: materials for ${pieces} × ${o.product.name} issued to ${o.workshop.name} (${req.length} material${req.length === 1 ? "" : "s"})`, changes: { materialsCost: cost } });
  return { materialsCost: cost };
}

/** Cost of one good piece: the materials issued spread over the planned pieces, plus the stitching charge. */
export const pieceCost = (o: { materialsCost: number; labourPerPiece: number }, planned: number) => (planned ? Math.round(o.materialsCost / planned) : 0) + o.labourPerPiece;

export type ReceiptLine = { variantId: string; good: number; rejected: number };

/** A delivery from the workshop: good pieces into stock (costed), rejects recorded, the workshop billed. */
export async function receiveProduction(tx: Tx, actor: Actor, orderId: string, lines: ReceiptLine[]) {
  const o = await tx.productionOrder.findUnique({ where: { id: orderId }, include: { lines: true, product: { select: { name: true } }, workshop: { select: { id: true, name: true } }, store: { select: { name: true } } } });
  if (!o) throw new ProductionError("Production order not found.");
  if (o.status !== "ISSUED" && o.status !== "PARTIAL") throw new ProductionError(o.status === "DRAFT" ? "Issue the materials before receiving pieces." : `${prdNo(o.number)} is ${o.status.toLowerCase()}.`);
  const todo = lines.filter((l) => l.good > 0 || l.rejected > 0);
  if (!todo.length) throw new ProductionError("Enter at least one counted piece.");
  if (todo.some((l) => l.good < 0 || l.rejected < 0 || !Number.isInteger(l.good) || !Number.isInteger(l.rejected))) throw new ProductionError("Counts are whole pieces.");

  const planned = o.lines.reduce((s, l) => s + l.planned, 0);
  const unitCost = pieceCost(o, planned);
  const receipt = await tx.productionReceipt.create({ data: { orderId: o.id, good: 0, rejected: 0, unitCost, labourAmount: 0, createdById: actor.id }, select: { id: true, number: true } });
  let good = 0, rejected = 0;
  for (const l of todo) {
    const line = o.lines.find((x) => x.variantId === l.variantId);
    if (!line) throw new ProductionError("A size doesn't belong to this order.");
    // a workshop may deliver a few extra; more than 10% over plan is a typo
    if (line.received + line.rejected + l.good + l.rejected > Math.ceil(line.planned * 1.1)) throw new ProductionError(`That's more pieces than were ordered for one size (${line.planned} planned, ${line.received + line.rejected} already counted).`);
    const upd = await tx.productionLine.updateMany({ where: { id: line.id, received: line.received, rejected: line.rejected }, data: { received: { increment: l.good }, rejected: { increment: l.rejected } } });
    if (!upd.count) throw new ProductionError("Someone else is receiving this order. Refresh and try again.");
    if (l.good > 0) {
      const v = await tx.variant.findUniqueOrThrow({ where: { id: l.variantId }, select: { stock: true, costPrice: true } });
      await tx.variant.update({ where: { id: l.variantId }, data: { costPrice: weightedAverageCost(v.stock, v.costPrice, l.good, unitCost) } });
      await moveStock(tx, { variantId: l.variantId, storeId: o.storeId, delta: l.good, reason: "PRODUCED", note: `${prdNo(o.number)} · PR-${receipt.number}`, actorId: actor.id });
    }
    good += l.good; rejected += l.rejected;
  }
  const labourAmount = good * o.labourPerPiece;
  const bill = labourAmount > 0
    ? await recordBill(tx, actor, { supplierId: o.workshop.id, reference: `${prdNo(o.number)}/PR-${receipt.number}`, billDate: ktmDate(), amount: labourAmount, vatAmount: 0, note: `Stitching ${good} × ${o.product.name} at ${formatPrice(o.labourPerPiece)}` })
    : null;
  await tx.productionReceipt.update({ where: { id: receipt.id }, data: { good, rejected, labourAmount, billId: bill?.id ?? null } });

  const fresh = await tx.productionLine.findMany({ where: { orderId: o.id } });
  const done = fresh.every((l) => l.received + l.rejected >= l.planned);
  await tx.productionOrder.update({ where: { id: o.id }, data: { status: done ? "COMPLETED" : "PARTIAL", ...(done ? { completedAt: new Date() } : {}) } });
  await queueBackInStock(tx, todo.filter((l) => l.good > 0).map((l) => l.variantId));
  await audit(tx, actor, { action: "production.receive", entity: ["ProductionOrder", o.id], summary: `PR-${receipt.number} on ${prdNo(o.number)}: ${good} good × ${o.product.name} into ${o.store.name}${rejected ? `, ${rejected} rejected` : ""}${bill ? `, ${o.workshop.name} billed ${formatPrice(labourAmount)}` : ""}${done ? " — order complete" : ""}`, changes: { good, rejected, unitCost, labourAmount } });
  return { receiptNumber: receipt.number, good, rejected, unitCost, labourAmount, completed: done };
}

/**
 * Stop an order. Before anything is received, issued materials go back on the shelf (same quantities, same
 * cost) and the order is cancelled. After pieces have come in, the remaining sizes are closed short:
 * materials stay consumed (they were cut), and the order is marked complete.
 */
export async function stopProduction(tx: Tx, actor: Actor, orderId: string, reason: string) {
  const o = await tx.productionOrder.findUnique({ where: { id: orderId }, include: { lines: true, receipts: { select: { id: true } } } });
  if (!o) throw new ProductionError("Production order not found.");
  if (o.status === "COMPLETED" || o.status === "CANCELLED") throw new ProductionError(`${prdNo(o.number)} is already ${o.status.toLowerCase()}.`);
  if (o.receipts.length) {
    await tx.productionOrder.update({ where: { id: o.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    const short = o.lines.reduce((s, l) => s + Math.max(0, l.planned - l.received - l.rejected), 0);
    await audit(tx, actor, { action: "production.close", entity: ["ProductionOrder", o.id], summary: `${prdNo(o.number)} closed ${short} piece${short === 1 ? "" : "s"} short: ${reason}` });
    return { returned: 0, closed: true };
  }
  let returned = 0;
  if (o.status === "ISSUED") {
    const issued = await tx.materialLog.findMany({ where: { productionOrderId: o.id, reason: "ISSUED" } });
    for (const l of issued) {
      await moveMaterial(tx, { materialId: l.materialId, storeId: l.storeId, delta: -l.delta, reason: "RETURNED", unitCost: l.unitCost, productionOrderId: o.id, note: `${prdNo(o.number)} cancelled`, actorId: actor.id });
      returned++;
    }
  }
  const upd = await tx.productionOrder.updateMany({ where: { id: o.id, status: o.status }, data: { status: "CANCELLED", materialsCost: 0 } });
  if (!upd.count) throw new ProductionError("This order just changed. Refresh and try again.");
  await audit(tx, actor, { action: "production.cancel", entity: ["ProductionOrder", o.id], summary: `${prdNo(o.number)} cancelled${returned ? `, ${returned} material(s) back on the shelf` : ""}: ${reason}` });
  return { returned, closed: false };
}
