import "server-only";
import type { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store as storeCfg } from "./config";
import { deadStock } from "./insights";
import { queuePriceDrops } from "./stock-alerts";
import { can, type Role } from "./permissions";
import { formatPrice } from "./utils";

// Markdowns and price events. HQ plans a sale (Dashain, end of season, clearance): which products, at what
// price, from when to when. The preview shows each price against its cost (the highest cost among its sizes),
// stock, and what's at stake; a price under cost + `minMarginPct` needs the owner to tick "below margin". At the
// start (by itself, through the job, or "start now") each product's shelf price is taken and the sale price set,
// with the old price shown struck through; at the end the old price goes back, unless someone changed the price
// during the sale (then it's left alone and flagged). The till and the shop use Product.price, so a sale is live
// everywhere at once. A product is in one live or scheduled event at a time.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class MarkdownError extends Error {}

const DAY = 86_400_000;
export const eventRef = (n: number) => `SALE-${n}`;
const cfg = () => storeCfg.markdown;
/** Sale prices round down to `roundTo` (Rs 10), never below it. */
export const roundPrice = (p: number) => Math.max(cfg().roundTo, Math.floor(p / cfg().roundTo) * cfg().roundTo);
export const marginPct = (price: number, cost: number | null) => (cost == null || price <= 0 ? null : Math.round(((price - cost) / price) * 1000) / 10);
const refreshShop = () => { try { revalidateTag("products", { expire: 0 }); } catch { /* outside a request (tests, scripts) */ } };

async function lockEvent(tx: Tx, id: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "PriceEvent" WHERE "id" = ${id} FOR UPDATE`;
  if (!row) throw new MarkdownError("Sale not found.");
  return tx.priceEvent.findUniqueOrThrow({ where: { id }, include: { items: true } });
}
const editable = (e: { status: string }) => { if (e.status !== "DRAFT" && e.status !== "SCHEDULED") throw new MarkdownError("Only a draft or scheduled sale can be changed."); };

export async function createEvent(tx: Tx, user: Actor, d: { name: string; startsAt: Date; endsAt: Date | null }) {
  const name = d.name.trim().slice(0, 80);
  if (name.length < 2) throw new MarkdownError("Name the sale (e.g. Dashain sale 2083).");
  if (Number.isNaN(+d.startsAt)) throw new MarkdownError("Choose when it starts.");
  if (d.endsAt && d.endsAt <= d.startsAt) throw new MarkdownError("The sale ends before it starts.");
  const e = await tx.priceEvent.create({ data: { name, startsAt: d.startsAt, endsAt: d.endsAt, createdById: user.id } });
  await audit(tx, user, { action: "markdown.create", entity: ["PriceEvent", e.id], summary: `${eventRef(e.number)} "${name}" drafted` });
  return e;
}

/** Add products at a % off their current price (or a fixed price). Already-added products get the new price. */
export async function addItems(tx: Tx, user: Actor, eventId: string, d: { productIds: string[]; percentOff?: number | null; price?: number | null }) {
  const e = await lockEvent(tx, eventId);
  editable(e);
  if (!d.productIds.length) throw new MarkdownError("Choose some products.");
  if (d.productIds.length > 2000) throw new MarkdownError("Up to 2,000 products in one go.");
  if (d.percentOff != null && (!Number.isFinite(d.percentOff) || d.percentOff <= 0 || d.percentOff >= 90)) throw new MarkdownError("A markdown is 1 to 89% off.");
  if (d.percentOff == null && (d.price == null || !Number.isInteger(d.price) || d.price <= 0)) throw new MarkdownError("Give a % off or a sale price.");
  const products = await tx.product.findMany({ where: { id: { in: d.productIds }, status: { not: "ARCHIVED" } }, select: { id: true, price: true } });
  for (const p of products) {
    const newPrice = d.percentOff != null ? roundPrice(p.price * (1 - d.percentOff / 100)) : d.price!;
    await tx.$executeRaw`INSERT INTO "PriceEventItem" ("id", "eventId", "productId", "newPrice") VALUES (${`pei_${eventId}_${p.id}`}, ${eventId}, ${p.id}, ${newPrice})
      ON CONFLICT ("eventId", "productId") DO UPDATE SET "newPrice" = EXCLUDED."newPrice"`;
  }
  await audit(tx, user, { action: "markdown.items", entity: ["PriceEvent", eventId], summary: `${eventRef(e.number)}: ${products.length} product(s) at ${d.percentOff != null ? `${d.percentOff}% off` : formatPrice(d.price!)}` });
  return { added: products.length };
}

export async function setItemPrice(tx: Tx, eventId: string, productId: string, price: number) {
  editable(await lockEvent(tx, eventId));
  if (!Number.isInteger(price) || price <= 0) throw new MarkdownError("Enter the sale price.");
  await tx.priceEventItem.update({ where: { eventId_productId: { eventId, productId } }, data: { newPrice: price } });
}
export async function removeItem(tx: Tx, eventId: string, productId: string) {
  editable(await lockEvent(tx, eventId));
  await tx.priceEventItem.deleteMany({ where: { eventId, productId } });
}

/** Each product's sale price against its shelf price, cost (highest size cost), margin, stock and recent sales. */
export async function preview(eventId: string, reader: Tx | typeof db = db, now = new Date()) {
  const e = await reader.priceEvent.findUnique({ where: { id: eventId }, include: { items: { include: { product: { select: { id: true, name: true, slug: true, price: true, compareAtPrice: true, variants: { select: { costPrice: true, stock: true } } } } } } } });
  if (!e) return null;
  const ids = e.items.map((i) => i.productId);
  const [sold, others, watching] = await Promise.all([
    ids.length ? reader.orderItem.groupBy({ by: ["productId"], where: { productId: { in: ids }, order: { createdAt: { gte: new Date(now.getTime() - 30 * DAY) }, status: { not: "CANCELLED" } } }, _sum: { quantity: true } }) : Promise.resolve([]),
    // the same product in another live or scheduled sale whose dates overlap
    ids.length ? reader.priceEventItem.findMany({ where: { productId: { in: ids }, eventId: { not: eventId }, event: { status: { in: ["SCHEDULED", "LIVE"] }, ...(e.endsAt ? { startsAt: { lt: e.endsAt } } : {}), OR: [{ endsAt: null }, { endsAt: { gt: e.startsAt } }] } }, select: { productId: true, event: { select: { number: true } } } }) : Promise.resolve([]),
    // people waiting for a price drop on it: a sign the markdown will sell
    ids.length ? reader.priceAlert.groupBy({ by: ["productId"], where: { productId: { in: ids }, notifiedAt: null }, _count: { _all: true } }) : Promise.resolve([]),
  ]);
  const rows = e.items.map((i) => {
    const costs = i.product.variants.map((v) => v.costPrice).filter((c): c is number => c != null);
    const cost = costs.length ? Math.max(...costs) : null;
    const shelf = e.status === "LIVE" || e.status === "ENDED" ? i.originalPrice ?? i.product.price : i.product.price;
    const stock = i.product.variants.reduce((s, v) => s + v.stock, 0);
    const margin = marginPct(i.newPrice, cost);
    const clash = others.find((o) => o.productId === i.productId);
    return {
      productId: i.productId, name: i.product.name, slug: i.product.slug, shelf, newPrice: i.newPrice, off: shelf ? Math.round((1 - i.newPrice / shelf) * 100) : 0,
      cost, margin, stock, sold30: sold.find((s) => s.productId === i.productId)?._sum.quantity ?? 0, watching: watching.find((w) => w.productId === i.productId)?._count._all ?? 0, restoreSkipped: i.restoreSkipped,
      belowCost: cost != null && i.newPrice < cost, belowMin: margin != null && margin < cfg().minMarginPct, noCost: cost == null, notLower: i.newPrice >= shelf,
      clash: clash ? eventRef(clash.event.number) : null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const totals = { products: rows.length, units: rows.reduce((s, r) => s + r.stock, 0), retailBefore: rows.reduce((s, r) => s + r.shelf * r.stock, 0), retailAfter: rows.reduce((s, r) => s + r.newPrice * r.stock, 0), belowMin: rows.filter((r) => r.belowMin).length, belowCost: rows.filter((r) => r.belowCost).length };
  return { event: e, rows, totals };
}

/** Ready the sale: checked, then scheduled (or started now if its start time has come). */
export async function scheduleEvent(tx: Tx, user: Actor, eventId: string, d: { allowBelowMargin: boolean }, now = new Date()) {
  const e = await lockEvent(tx, eventId);
  if (e.status !== "DRAFT") throw new MarkdownError("Only a draft can be scheduled.");
  const p = (await preview(eventId, tx, now))!;
  if (!p.rows.length) throw new MarkdownError("Add products first.");
  const clash = p.rows.filter((r) => r.clash);
  if (clash.length) throw new MarkdownError(`Already in another sale at the same time: ${clash.slice(0, 5).map((r) => `${r.name} (${r.clash})`).join(", ")}.`);
  const notLower = p.rows.filter((r) => r.notLower);
  if (notLower.length) throw new MarkdownError(`Not a markdown (sale price isn't lower): ${notLower.slice(0, 5).map((r) => r.name).join(", ")}.`);
  if (p.totals.belowMin) {
    if (!can(user, "finance")) throw new MarkdownError(`${p.totals.belowMin} product(s) would sell under cost + ${cfg().minMarginPct}%: only the owner can approve that.`);
    if (!d.allowBelowMargin) throw new MarkdownError(`${p.totals.belowMin} product(s) would sell under cost + ${cfg().minMarginPct}% (${p.totals.belowCost} under cost). Tick "below margin" to go ahead.`);
  }
  if (e.endsAt && e.endsAt <= now) throw new MarkdownError("This sale's end time has already passed.");
  await tx.priceEvent.update({ where: { id: eventId }, data: { status: "SCHEDULED" } });
  await audit(tx, user, { action: "markdown.schedule", entity: ["PriceEvent", eventId], summary: `${eventRef(e.number)} scheduled: ${p.rows.length} product(s)${p.totals.belowMin ? `, ${p.totals.belowMin} under the margin floor (approved)` : ""}` });
  if (e.startsAt <= now) await startEvent(tx, eventId, user, now);
}

export async function startEvent(tx: Tx, eventId: string, actor: Actor | null, now = new Date()) {
  const e = await lockEvent(tx, eventId);
  if (e.status !== "SCHEDULED") throw new MarkdownError("Only a scheduled sale can start.");
  const products = await tx.product.findMany({ where: { id: { in: e.items.map((i) => i.productId) } }, select: { id: true, price: true, compareAtPrice: true } });
  for (const i of e.items) {
    const p = products.find((x) => x.id === i.productId);
    if (!p) continue;
    await tx.priceEventItem.update({ where: { id: i.id }, data: { originalPrice: p.price, originalCompareAt: p.compareAtPrice } });
    // the old price shows struck through (an MRP above it stays)
    await tx.product.update({ where: { id: p.id }, data: { price: i.newPrice, compareAtPrice: Math.max(p.compareAtPrice ?? 0, p.price) } });
  }
  await tx.priceEvent.update({ where: { id: eventId }, data: { status: "LIVE", startedAt: now } });
  await queuePriceDrops(tx, e.items.map((i) => i.productId));
  await audit(tx, actor, { action: "markdown.start", entity: ["PriceEvent", eventId], summary: `${eventRef(e.number)} "${e.name}" started: ${e.items.length} product(s) marked down` });
  refreshShop();
}

/** Put prices back. A price someone changed during the sale is left as it is (and flagged). */
export async function endEvent(tx: Tx, eventId: string, actor: Actor | null, now = new Date()) {
  const e = await lockEvent(tx, eventId);
  if (e.status !== "LIVE") throw new MarkdownError("Only a live sale can end.");
  const products = await tx.product.findMany({ where: { id: { in: e.items.map((i) => i.productId) } }, select: { id: true, price: true } });
  let restored = 0, skipped = 0;
  for (const i of e.items) {
    const p = products.find((x) => x.id === i.productId);
    if (!p || i.originalPrice == null) continue;
    if (p.price !== i.newPrice) { skipped++; await tx.priceEventItem.update({ where: { id: i.id }, data: { restoreSkipped: true } }); continue; }
    await tx.product.update({ where: { id: p.id }, data: { price: i.originalPrice, compareAtPrice: i.originalCompareAt } });
    restored++;
  }
  await tx.priceEvent.update({ where: { id: eventId }, data: { status: "ENDED", endedAt: now, ...(e.endsAt && e.endsAt <= now ? {} : { endsAt: now }) } });
  await audit(tx, actor, { action: "markdown.end", entity: ["PriceEvent", eventId], summary: `${eventRef(e.number)} ended: ${restored} price(s) put back${skipped ? `, ${skipped} left as changed during the sale` : ""}` });
  refreshShop();
  return { restored, skipped };
}

export async function cancelEvent(tx: Tx, user: Actor, eventId: string) {
  const e = await lockEvent(tx, eventId);
  if (e.status !== "DRAFT" && e.status !== "SCHEDULED") throw new MarkdownError(e.status === "LIVE" ? "End the sale instead: that puts the prices back." : "This sale is already over.");
  await tx.priceEvent.update({ where: { id: eventId }, data: { status: "CANCELLED" } });
  await audit(tx, user, { action: "markdown.cancel", entity: ["PriceEvent", eventId], summary: `${eventRef(e.number)} cancelled` });
}

/** Job: start sales whose time has come and end those that are over. One sale failing doesn't stop the rest. */
export async function runPriceEvents(now = new Date()) {
  const [due, over] = await Promise.all([
    db.priceEvent.findMany({ where: { status: "SCHEDULED", startsAt: { lte: now } }, select: { id: true }, orderBy: { startsAt: "asc" } }),
    db.priceEvent.findMany({ where: { status: "LIVE", endsAt: { lte: now } }, select: { id: true }, orderBy: { endsAt: "asc" } }),
  ]);
  const failed: string[] = [];
  let started = 0, ended = 0;
  // end first, so a product moving from one sale straight into the next is put back before it's marked down again
  for (const e of over) { try { await db.$transaction((tx) => endEvent(tx, e.id, null, now), { timeout: 60_000 }); ended++; } catch (err) { failed.push(`${e.id}: ${(err as Error).message}`); } }
  for (const e of due) { try { await db.$transaction((tx) => startEvent(tx, e.id, null, now), { timeout: 60_000 }); started++; } catch (err) { failed.push(`${e.id}: ${(err as Error).message}`); } }
  if (failed.length) throw new Error(`Price events: ${failed.join("; ")}`);
  return { started, ended };
}

// ---------- reading ----------

/** How the sale is doing: units and takings while live vs the same length of time just before it started. */
export async function eventResults(eventId: string, now = new Date()) {
  const e = await db.priceEvent.findUnique({ where: { id: eventId }, select: { startedAt: true, endedAt: true, items: { select: { productId: true } } } });
  if (!e?.startedAt) return null;
  const end = e.endedAt ?? now, len = end.getTime() - e.startedAt.getTime();
  const ids = e.items.map((i) => i.productId);
  const sum = async (from: Date, to: Date) => {
    const rows = await db.orderItem.findMany({ where: { productId: { in: ids }, order: { createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" } } }, select: { quantity: true, unitPrice: true, unitCost: true } });
    return { units: rows.reduce((s, r) => s + r.quantity, 0), sales: rows.reduce((s, r) => s + r.unitPrice * r.quantity, 0), cost: rows.reduce((s, r) => s + (r.unitCost ?? 0) * r.quantity, 0) };
  };
  const [during, before] = await Promise.all([sum(e.startedAt, end), sum(new Date(e.startedAt.getTime() - len), e.startedAt)]);
  return { days: Math.max(1, Math.round(len / DAY)), during, before, margin: marginPct(during.sales, during.cost) };
}

/** Slow sellers worth marking down: products with stock that hasn't sold, with a % by how long it has sat. */
export async function suggestions() {
  const dead = await deadStock();
  const by = new Map<string, { productId: string; name: string; units: number; atCost: number; days: number }>();
  for (const r of dead.rows) {
    const p = by.get(r.productId) ?? { productId: r.productId, name: r.name, units: 0, atCost: 0, days: 0 };
    p.units += r.stock; p.atCost += r.value ?? 0; p.days = Math.max(p.days, r.days);
    by.set(r.productId, p);
  }
  return [...by.values()].map((p) => ({ ...p, suggestOff: p.days >= 180 ? 40 : p.days >= 120 ? 30 : 20 })).sort((a, b) => b.atCost - a.atCost).slice(0, 50);
}

export async function eventsList() {
  return db.priceEvent.findMany({ orderBy: [{ startsAt: "desc" }], take: 50, include: { _count: { select: { items: true } } } });
}
