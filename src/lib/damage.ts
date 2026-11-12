import "server-only";
import { Prisma, type DamageKind } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { moveStock } from "./stock";
import { queueBackInStock } from "./stock-alerts";
import { requireStoreAccess, type Scope } from "./scope";
import { formatPrice } from "./utils";

// The damaged stock register. Units that come back damaged (store returns, exchanges, parcels back from couriers,
// or found by staff) are off sale: the stock ledger records them at zero, and this register counts them per
// location and size so they don't vanish into a back room. Each one leaves the register one way: repaired (back
// on sale), written off, or sent back to the supplier, where the credit we expect is tracked until finance sees
// it arrive. Entries are append-only (a database trigger); only the credit is filled in later.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class DamageError extends Error {}

export const KIND_LABEL: Record<DamageKind, string> = { IN: "Came in damaged", REPAIRED: "Repaired: back on sale", WRITTEN_OFF: "Written off", TO_SUPPLIER: "Back to the supplier" };

/** Damaged units come in: zero on the stock ledger (off sale), counted here. Call in the transaction that took them. */
export async function quarantine(tx: Tx, d: { storeId: string; variantId: string; quantity: number; source: string; unitCost?: number | null; actorId?: string | null; note?: string; orderId?: string | null; ledger?: boolean }) {
  if (!Number.isInteger(d.quantity) || d.quantity <= 0) return;
  if (d.ledger !== false) await moveStock(tx, { variantId: d.variantId, storeId: d.storeId, delta: 0, reason: "DAMAGED", orderId: d.orderId ?? null, actorId: d.actorId ?? null, note: `${d.source}: ${d.quantity} damaged, quarantined${d.note ? ` (${d.note})` : ""}` });
  const cost = d.unitCost !== undefined ? d.unitCost : (await tx.variant.findUnique({ where: { id: d.variantId }, select: { costPrice: true } }))?.costPrice ?? null;
  await tx.damageEntry.create({ data: { storeId: d.storeId, variantId: d.variantId, kind: "IN", quantity: d.quantity, unitCost: cost, source: d.source.slice(0, 120), note: d.note?.slice(0, 300) ?? "", createdById: d.actorId ?? null } });
}

async function balanceOf(tx: Tx, storeId: string, variantId: string) {
  const r = await tx.damageEntry.aggregate({ where: { storeId, variantId }, _sum: { quantity: true } });
  return r._sum.quantity ?? 0;
}

/** Take damaged units out of the register: repaired (back on sale), written off, or sent to the supplier. */
export async function takeOut(tx: Tx, user: Actor, d: { storeId: string; variantId: string; quantity: number; kind: Exclude<DamageKind, "IN">; note?: string; supplierId?: string | null; creditExpected?: number | null }) {
  await requireStoreAccess(user, d.storeId, tx);
  if (!Number.isInteger(d.quantity) || d.quantity <= 0) throw new DamageError("Enter how many.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`damage:${d.storeId}:${d.variantId}`}))`;
  const have = await balanceOf(tx, d.storeId, d.variantId);
  if (d.quantity > have) throw new DamageError(`Only ${have} damaged here.`);
  const v = await tx.variant.findUniqueOrThrow({ where: { id: d.variantId }, select: { sku: true, costPrice: true, product: { select: { name: true } } } });
  const note = d.note?.trim().slice(0, 300) ?? "";
  if (d.kind === "WRITTEN_OFF" && note.length < 3) throw new DamageError("Say what happened to them (thrown away, donated…).");
  let supplier: { id: string; name: string } | null = null;
  if (d.kind === "TO_SUPPLIER") {
    supplier = d.supplierId ? await tx.supplier.findUnique({ where: { id: d.supplierId }, select: { id: true, name: true } }) : null;
    if (!supplier) throw new DamageError("Choose the supplier.");
    if (d.creditExpected != null && (!Number.isInteger(d.creditExpected) || d.creditExpected < 0)) throw new DamageError("Enter the credit you expect (0 if none).");
  }
  const here = await tx.store.findUniqueOrThrow({ where: { id: d.storeId }, select: { name: true } });
  if (d.kind === "REPAIRED") {
    await moveStock(tx, { variantId: d.variantId, storeId: d.storeId, delta: d.quantity, reason: "RETURN_RESTOCK", actorId: user.id, note: `Repaired: ${d.quantity} back on sale from damaged${note ? ` (${note})` : ""}` });
    await queueBackInStock(tx, [d.variantId]);
  }
  const credit = d.kind === "TO_SUPPLIER" ? d.creditExpected ?? (v.costPrice ?? 0) * d.quantity : null;
  const e = await tx.damageEntry.create({ data: { storeId: d.storeId, variantId: d.variantId, kind: d.kind, quantity: -d.quantity, unitCost: v.costPrice, source: supplier ? `To ${supplier.name}` : KIND_LABEL[d.kind], note, supplierId: supplier?.id ?? null, creditExpected: credit, createdById: user.id } });
  await audit(tx, user, { action: `damage.${d.kind.toLowerCase()}`, entity: ["DamageEntry", e.id], summary: `${v.product.name} ${v.sku} ×${d.quantity} at ${here.name}: ${KIND_LABEL[d.kind].toLowerCase()}${supplier ? ` (${supplier.name}, credit expected ${formatPrice(credit ?? 0)})` : ""}${note ? ` — ${note}` : ""}` });
  return e;
}

/** The register: what's damaged where (oldest first), what went out lately, supplier credits still owed. */
export async function damageRegister(scope: Scope, now = new Date()) {
  const where = scope.all ? {} : { storeId: { in: scope.storeIds } };
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const [held, recent, credits, inBy] = await Promise.all([
    db.$queryRaw<{ storeId: string; store: string; variantId: string; sku: string; name: string; color: string; size: string; cost: number | null; units: number; since: Date }[]>`
      SELECT e."storeId", s."name" AS "store", e."variantId", v."sku", p."name", v."color", v."size", v."costPrice" AS "cost", SUM(e."quantity")::int AS "units", MIN(e."createdAt") FILTER (WHERE e."kind" = 'IN') AS "since"
      FROM "DamageEntry" e JOIN "Store" s ON s."id" = e."storeId" JOIN "Variant" v ON v."id" = e."variantId" JOIN "Product" p ON p."id" = v."productId"
      ${scope.all ? Prisma.empty : Prisma.sql`WHERE e."storeId" = ANY(${scope.storeIds})`}
      GROUP BY 1, 2, 3, 4, 5, 6, 7, 8 HAVING SUM(e."quantity") > 0 ORDER BY "since" ASC LIMIT 500`,
    db.damageEntry.findMany({ where, orderBy: { createdAt: "desc" }, take: 40, include: { store: { select: { name: true } }, variant: { select: { sku: true, size: true, color: true, product: { select: { name: true } } } } } }),
    db.damageEntry.findMany({ where: { ...where, kind: "TO_SUPPLIER" }, orderBy: [{ creditAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }], take: 60, include: { supplier: { select: { name: true } }, store: { select: { name: true } }, variant: { select: { sku: true, product: { select: { name: true } } } } } }),
    db.damageEntry.groupBy({ by: ["kind"], where: { ...where, createdAt: { gte: since } }, _sum: { quantity: true } }),
  ]);
  const units = held.reduce((s, h) => s + h.units, 0);
  const value = held.reduce((s, h) => s + h.units * (h.cost ?? 0), 0);
  const flow = Object.fromEntries(inBy.map((g) => [g.kind, Math.abs(g._sum.quantity ?? 0)])) as Partial<Record<DamageKind, number>>;
  return {
    held: held.map((h) => ({ ...h, days: Math.floor((now.getTime() - h.since.getTime()) / 86_400_000) })), units, value, recent, flow,
    owed: credits.filter((c) => !c.creditAt), settled: credits.filter((c) => c.creditAt).slice(0, 20),
    owedTotal: credits.filter((c) => !c.creditAt).reduce((s, c) => s + (c.creditExpected ?? 0), 0),
  };
}
