import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { store as storeConfig } from "./config";
import { audit, type AuditActor } from "./audit";
import { formatOrderNumber } from "./utils";

// Offline till, server side. While the shop's internet is down the till sells from a price list it saved
// earlier (IndexedDB). Every price in that list is signed here, so when the sale reaches the server we can
// tell a price we issued from one typed into the browser. The sale itself goes through createPosSale with
// its client id (exactly once), dated when it really happened, on the cashier's own shift.

const H = 3_600_000;
const secret = () => process.env.AUTH_SECRET ?? "dev-secret";

/** Signature for "this variant cost this much at this shop when the price list was issued". */
export function priceSig(storeId: string, variantId: string, price: number, issuedAt: string) {
  return createHmac("sha256", secret()).update(`till-price:${storeId}:${variantId}:${price}:${issuedAt}`).digest("base64url").slice(0, 22);
}

/**
 * True when the till's price is one we issued for this shop, and the price list was fresh enough for this
 * shift (issued at most `snapshotMaxAgeHours` before the shift opened, and not in the future).
 */
export function priceIsGenuine(p: { storeId: string; variantId: string; price: number; issuedAt: string; sig: string }, shiftOpenedAt: Date, now = new Date()) {
  const at = Date.parse(p.issuedAt);
  if (!Number.isFinite(at)) return false;
  if (at > now.getTime() + storeConfig.posOffline.clockSkewMinutes * 60_000) return false;
  if (at < shiftOpenedAt.getTime() - storeConfig.posOffline.snapshotMaxAgeHours * H) return false;
  const want = Buffer.from(priceSig(p.storeId, p.variantId, p.price, p.issuedAt));
  const got = Buffer.from(p.sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/**
 * When an offline sale really happened. A device clock that is clearly wrong (in the future, or before the
 * shift opened) is replaced by the time the sale reached us, and the caller notes that on the sale.
 */
export function offlineSaleTime(soldAt: string, shiftOpenedAt: Date, now = new Date()): { at: Date; clockWasOff: boolean } {
  const t = Date.parse(soldAt);
  const skew = storeConfig.posOffline.clockSkewMinutes * 60_000;
  if (!Number.isFinite(t) || t > now.getTime() + skew || t < shiftOpenedAt.getTime() - skew) return { at: now, clockWasOff: true };
  return { at: new Date(Math.min(Math.max(t, shiftOpenedAt.getTime()), now.getTime())), clockWasOff: false };
}

export type TillRow = { variantId: string; sku: string; name: string; color: string; size: string; price: number; stock: number; issuedAt: string; sig: string };

/**
 * One page of the shop's price list for the till to keep offline: every size of every product on sale, with
 * this shop's count and a signed price. Never the purchase cost. Paged by variant id.
 */
export async function tillSnapshotPage(storeId: string, cursor: string | null, take = 500): Promise<{ rows: TillRow[]; next: string | null }> {
  const variants = await db.variant.findMany({
    where: { product: { status: "ACTIVE" } },
    select: { id: true, sku: true, color: true, size: true, product: { select: { name: true, price: true } }, storeStock: { where: { storeId }, select: { quantity: true } } },
    orderBy: { id: "asc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = variants.slice(0, take);
  const issuedAt = new Date().toISOString();
  return {
    rows: page.map((v) => ({
      variantId: v.id, sku: v.sku, name: v.product.name, color: v.color, size: v.size, price: v.product.price,
      stock: v.storeStock[0]?.quantity ?? 0, issuedAt, sig: priceSig(storeId, v.id, v.product.price, issuedAt),
    })),
    next: variants.length > take ? page[page.length - 1].id : null,
  };
}

/** Sales that tills at this shop (or on this shift) hold and haven't sent yet, as they last reported. */
export async function unsyncedOffline(where: { storeId?: string; shiftId?: string; before?: Date }, reader: Prisma.TransactionClient | typeof db = db) {
  const r = await reader.posDevice.aggregate({
    where: { pending: { gt: 0 }, ...(where.storeId ? { storeId: where.storeId } : {}), ...(where.shiftId ? { shiftId: where.shiftId } : {}), ...(where.before ? { oldestPendingAt: { lt: where.before } } : {}) },
    _sum: { pending: true },
    _count: { _all: true },
  });
  return { sales: r._sum.pending ?? 0, tills: r._count._all };
}

const nepalDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: storeConfig.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/**
 * Inside the sale's transaction: record what a manager must check about an offline sale that just synced:
 * units the shop didn't have on the system, a shift already closed or a day already locked, a price we
 * couldn't verify. Each is one row on the closing page and counts on Needs attention.
 */
export async function flagOfflineSale(tx: Prisma.TransactionClient, me: AuditActor, s: {
  orderId: string; number: number; storeId: string;
  shift: { id: string; status: string };
  soldAt: Date;
  short: { variantId: string; quantity: number }[];
  unverified: string[];
  variants: { id: string; sku: string; color: string; size: string; product: { name: string } }[];
}) {
  const label = (id: string) => { const v = s.variants.find((x) => x.id === id); return v ? `${v.product.name} (${v.color} ${v.size}, ${v.sku})` : id; };
  const day = nepalDay(s.soldAt);
  const locked = await tx.dayClose.findUnique({ where: { storeId_date: { storeId: s.storeId, date: day } }, select: { id: true } });
  const rows: Omit<Prisma.PosExceptionCreateManyInput, "orderId" | "storeId">[] = [
    ...s.short.map((x) => ({ kind: "STOCK_SHORT" as const, variantId: x.variantId, quantity: x.quantity, detail: `${x.quantity} × ${label(x.variantId)} sold offline that the system didn't have at this shop. Count the shelf; an online order may be waiting for units that have gone.` })),
    ...(s.shift.status === "CLOSED" ? [{ kind: "SHIFT_CLOSED" as const, detail: "Reached the server after its shift was closed: the drawer count didn't include it." }] : []),
    ...(locked ? [{ kind: "DAY_LOCKED" as const, detail: `Reached the server after ${day} was locked: the closing snapshot doesn't include it.` }] : []),
    ...s.unverified.map((id) => ({ kind: "PRICE_UNVERIFIED" as const, variantId: id, detail: `${label(id)}: the till's price isn't one the server issued for this shop. Check what the customer paid.` })),
  ];
  if (!rows.length) return 0;
  await tx.posException.createMany({ data: rows.map((r) => ({ ...r, orderId: s.orderId, storeId: s.storeId })) });
  await audit(tx, me, { action: "pos.offline_exception", entity: ["Order", s.orderId], summary: `${formatOrderNumber(s.number)} synced from offline with ${rows.length} thing${rows.length > 1 ? "s" : ""} to check: ${[...new Set(rows.map((r) => r.kind))].join(", ")}`, changes: { kinds: rows.map((r) => r.kind) } });
  return rows.length;
}

export const POS_EXCEPTION_LABEL = {
  STOCK_SHORT: "Sold more than the system had",
  SHIFT_CLOSED: "Arrived after the shift was closed",
  DAY_LOCKED: "Arrived after the day was locked",
  PRICE_UNVERIFIED: "Price couldn't be checked",
} as const;

/** Offline-sale exceptions a manager hasn't checked yet, at one shop (newest first). */
export async function openPosExceptions(storeId: string, take = 100) {
  return db.posException.findMany({
    where: { storeId, resolvedAt: null },
    select: { id: true, kind: true, detail: true, quantity: true, createdAt: true, order: { select: { id: true, number: true, createdAt: true, total: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}
