import "server-only";
import type { Prisma } from "@prisma/client";
import { audit, type AuditActor } from "./audit";
import { moveStock } from "./stock";
import { queueBackInStock } from "./stock-alerts";
import { formatPrice } from "./utils";

// Stock counts (stocktakes and rolling cycle counts) at one location.
//   COUNTING ──submit──▶ SUBMITTED ──approve──▶ APPROVED (stock adjusted, reason COUNT)
//        └──────────────── cancel ──────────────▶ CANCELLED (nothing changes)
// Counting is blind: counters never see the system figure. Each line remembers the system figure at
// the moment it was counted (`systemAt`), and the adjustment is counted − systemAt, applied relative to
// whatever the shelf holds at approval. So a sale in between counting and approving can't be undone
// by the count, and the shop doesn't have to close while counting.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class CountError extends Error {}

export const countNo = (n: number) => `SC-${String(n).padStart(5, "0")}`;

async function systemQty(tx: Tx, storeId: string, variantId: string) {
  return (await tx.storeStock.findUnique({ where: { storeId_variantId: { storeId, variantId } }, select: { quantity: true } }))?.quantity ?? 0;
}

/** Start a count. The list holds every active variant in scope that this location has had stock of, or that is still on sale. */
export async function startCount(tx: Tx, actor: Actor, d: { storeId: string; categoryId?: string | null; note?: string }) {
  const store = await tx.store.findFirst({ where: { id: d.storeId, active: true }, select: { id: true, name: true } });
  if (!store) throw new CountError("That location isn't active.");
  // a whole-location count overlaps every count there; a category count overlaps a whole one or the same category
  const open = await tx.stockCount.findFirst({
    where: { storeId: d.storeId, status: { in: ["COUNTING", "SUBMITTED"] }, ...(d.categoryId ? { OR: [{ categoryId: null }, { categoryId: d.categoryId }] } : {}) },
    select: { number: true },
  });
  if (open) throw new CountError(`${countNo(open.number)} is still open at ${store.name}. Finish or cancel it first.`);
  let scopeLabel = "Whole location";
  let categoryIds: string[] | null = null;
  if (d.categoryId) {
    const c = await tx.category.findUnique({ where: { id: d.categoryId }, select: { id: true, name: true, parent: { select: { name: true } }, children: { select: { id: true } } } });
    if (!c) throw new CountError("That category no longer exists.");
    scopeLabel = c.parent ? `${c.parent.name} / ${c.name}` : c.name;
    categoryIds = [c.id, ...c.children.map((x) => x.id)];
  }
  const variants = await tx.variant.findMany({
    where: {
      product: { status: { not: "ARCHIVED" }, ...(categoryIds ? { categoryId: { in: categoryIds } } : {}) },
      OR: [{ storeStock: { some: { storeId: d.storeId, quantity: { gt: 0 } } } }, { product: { status: "ACTIVE" } }],
    },
    select: { id: true },
  });
  if (!variants.length) throw new CountError("Nothing to count in that scope.");
  const c = await tx.stockCount.create({
    data: { storeId: d.storeId, categoryId: d.categoryId ?? null, scopeLabel, note: d.note || null, createdById: actor.id, lines: { create: variants.map((v) => ({ variantId: v.id })) } },
    select: { id: true, number: true },
  });
  await audit(tx, actor, { action: "count.start", entity: ["StockCount", c.id], summary: `${countNo(c.number)} started at ${store.name}: ${scopeLabel} (${variants.length} sizes)` });
  return c;
}

async function openCount(tx: Tx, countId: string) {
  const c = await tx.stockCount.findUnique({ where: { id: countId }, select: { id: true, number: true, storeId: true, status: true } });
  if (!c) throw new CountError("Count not found.");
  if (c.status !== "COUNTING") throw new CountError("This count has been submitted; it can't be changed.");
  return c;
}

/**
 * Record what's on the shelf for one variant: `add` units (a scan is +1) or `set` an exact number.
 * A variant not on the list is added (found stock). Returns the new counted figure only (blind).
 */
export async function recordCount(tx: Tx, actor: Actor, countId: string, variantId: string, change: { add: number } | { set: number }) {
  const c = await openCount(tx, countId);
  const variant = await tx.variant.findUnique({ where: { id: variantId }, select: { id: true } });
  if (!variant) throw new CountError("Unknown item.");
  // lock the line so two counters scanning the same SKU add up correctly
  await tx.stockCountLine.upsert({ where: { countId_variantId: { countId, variantId } }, create: { countId, variantId, added: true }, update: {} });
  const [line] = await tx.$queryRaw<{ counted: number | null }[]>`SELECT "counted" FROM "StockCountLine" WHERE "countId" = ${countId} AND "variantId" = ${variantId} FOR UPDATE`;
  const next = "set" in change ? change.set : (line.counted ?? 0) + change.add;
  if (!Number.isInteger(next) || next < 0 || next > 100_000) throw new CountError("Enter a whole number of units.");
  await tx.stockCountLine.update({
    where: { countId_variantId: { countId, variantId } },
    data: { counted: next, systemAt: await systemQty(tx, c.storeId, variantId), countedAt: new Date(), countedById: actor.id },
  });
  return next;
}

/** Undo counting a line (e.g. counted the wrong shelf): it goes back to "not counted". */
export async function clearLine(tx: Tx, countId: string, variantId: string) {
  await openCount(tx, countId);
  await tx.stockCountLine.updateMany({ where: { countId, variantId }, data: { counted: null, systemAt: null, countedAt: null, countedById: null } });
}

export async function submitCount(tx: Tx, actor: Actor, countId: string) {
  const c = await openCount(tx, countId);
  const counted = await tx.stockCountLine.count({ where: { countId, counted: { not: null } } });
  if (!counted) throw new CountError("Nothing has been counted yet.");
  const res = await tx.stockCount.updateMany({ where: { id: countId, status: "COUNTING" }, data: { status: "SUBMITTED", submittedById: actor.id, submittedAt: new Date() } });
  if (!res.count) throw new CountError("This count was just submitted by someone else.");
  await audit(tx, actor, { action: "count.submit", entity: ["StockCount", countId], summary: `${countNo(c.number)} submitted for approval (${counted} sizes counted)` });
}

/** Variance per counted line: counted − system figure when it was counted. */
export function variance(line: { counted: number | null; systemAt: number | null }) {
  return line.counted == null ? 0 : line.counted - (line.systemAt ?? 0);
}

/**
 * Apply the count. Each counted line moves stock by its variance relative to the shelf now; a loss
 * bigger than what's left (sold since counting) is capped at zero and noted. Uncounted lines don't change.
 */
export async function approveCount(tx: Tx, actor: Actor, countId: string, note?: string) {
  const c = await tx.stockCount.findUnique({ where: { id: countId }, include: { store: { select: { name: true } }, lines: { where: { counted: { not: null } }, include: { variant: { select: { sku: true, costPrice: true } } } } } });
  if (!c) throw new CountError("Count not found.");
  if (c.status !== "SUBMITTED") throw new CountError("Only a submitted count can be approved.");
  const res = await tx.stockCount.updateMany({ where: { id: countId, status: "SUBMITTED" }, data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date(), ...(note ? { note: [c.note, `Approval: ${note}`].filter(Boolean).join("\n").slice(0, 1000) } : {}) } });
  if (!res.count) throw new CountError("This count was just approved or cancelled by someone else.");
  let plus = 0, minus = 0, value = 0, capped = 0;
  const found: string[] = [];
  for (const l of c.lines) {
    let delta = variance(l);
    if (!delta) continue;
    if (delta < 0) {
      const now = await systemQty(tx, c.storeId, l.variantId);
      if (now < -delta) { capped += -delta - now; delta = -now; }
      if (!delta) continue;
    }
    await moveStock(tx, { variantId: l.variantId, storeId: c.storeId, delta, reason: "COUNT", note: `${countNo(c.number)}: counted ${l.counted}, system ${l.systemAt ?? 0}`, actorId: actor.id });
    if (delta > 0) { plus += delta; found.push(l.variantId); } else minus -= delta;
    value += delta * (l.variant.costPrice ?? 0);
  }
  if (found.length) await queueBackInStock(tx, found);
  await audit(tx, actor, {
    action: "count.approve", entity: ["StockCount", countId],
    summary: `${countNo(c.number)} approved at ${c.store.name}: +${plus} / −${minus} units, net ${formatPrice(value)} at cost${capped ? `; ${capped} unit(s) already sold since counting` : ""}`,
    changes: { plus, minus, valueAtCost: value, capped },
  });
  return { plus, minus, value, capped };
}

export async function cancelCount(tx: Tx, actor: Actor, countId: string, reason: string) {
  const c = await tx.stockCount.findUnique({ where: { id: countId }, select: { number: true, status: true } });
  if (!c) throw new CountError("Count not found.");
  const res = await tx.stockCount.updateMany({ where: { id: countId, status: { in: ["COUNTING", "SUBMITTED"] } }, data: { status: "CANCELLED", note: reason.slice(0, 500) } });
  if (!res.count) throw new CountError("This count is already closed.");
  await audit(tx, actor, { action: "count.cancel", entity: ["StockCount", countId], summary: `${countNo(c.number)} cancelled — ${reason.slice(0, 160)}` });
}
