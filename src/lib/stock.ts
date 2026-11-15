import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { store as storeConfig } from "./config";
import { distanceTier } from "./geo";

// Multi-location stock. Every unit lives at a location (`StoreStock`); `Variant.stock` is the total,
// kept equal to the sum by a database trigger that also rejects direct writes to it. So the only way
// to change stock is `moveStock` (or the helpers below that call it), which also writes the ledger.

type Tx = Prisma.TransactionClient;
type Reader = Tx | PrismaClient;

export class StockError extends Error {
  constructor(message: string, readonly variantId?: string) {
    super(message);
  }
}

export type StockReason =
  | "SALE" | "CANCEL_RESTOCK" | "RETURN_RESTOCK" | "MANUAL_ADJUST" | "RECEIVED" | "DAMAGED"
  | "TRANSFER_OUT" | "TRANSFER_IN" | "TRANSFER_LOSS" | "COUNT" | "PRODUCED";

export type StockMove = {
  variantId: string;
  storeId: string;
  delta: number;
  reason: StockReason;
  note?: string | null;
  orderId?: string | null;
  actorId?: string | null;
};

/**
 * Change stock at one location and log it. Removals are conditional (`quantity >= n`), so two
 * sales can never take the same last unit; returns false when the location doesn't have enough.
 * A zero delta only writes the ledger (e.g. damaged units quarantined, never back on sale).
 */
export async function moveStock(tx: Tx, m: StockMove): Promise<boolean> {
  if (!Number.isInteger(m.delta)) throw new StockError("Stock moves are whole units.");
  if (m.delta > 0) {
    await tx.storeStock.upsert({
      where: { storeId_variantId: { storeId: m.storeId, variantId: m.variantId } },
      create: { storeId: m.storeId, variantId: m.variantId, quantity: m.delta },
      update: { quantity: { increment: m.delta } },
    });
  } else if (m.delta < 0) {
    const res = await tx.storeStock.updateMany({
      where: { storeId: m.storeId, variantId: m.variantId, quantity: { gte: -m.delta } },
      data: { quantity: { increment: m.delta } },
    });
    if (!res.count) return false;
  }
  await tx.inventoryLog.create({
    data: { variantId: m.variantId, storeId: m.storeId, delta: m.delta, reason: m.reason, note: m.note?.slice(0, 200) || null, orderId: m.orderId ?? null, actorId: m.actorId ?? null },
  });
  return true;
}

/** Like moveStock, but a shortfall aborts the transaction with a readable message. */
export async function moveStockOrThrow(tx: Tx, m: StockMove, message: string) {
  if (!(await moveStock(tx, m))) throw new StockError(message, m.variantId);
}

// ---------- Locations ----------

const locationSelect = { id: true, code: true, name: true, kind: true, district: true, shipsOnline: true, address: true, phone: true, hours: true, priority: true, pickup: true, active: true } as const;
export type Location = Prisma.StoreGetPayload<{ select: typeof locationSelect }>;

/** Active locations, in fulfilment order. */
export async function getLocations(opts: { includeInactive?: boolean; reader?: Reader } = {}): Promise<Location[]> {
  return (opts.reader ?? db).store.findMany({
    where: opts.includeInactive ? {} : { active: true },
    select: locationSelect,
    orderBy: [{ active: "desc" }, { priority: "asc" }, { name: "asc" }],
  });
}

/** The flagship shop, created on first use so a fresh install always has somewhere to hold stock. */
export async function ensureFlagship(reader: Reader = db) {
  return reader.store.upsert({
    where: { code: "FLAGSHIP" },
    update: {},
    create: { code: "FLAGSHIP", name: `${storeConfig.name} Flagship`, address: storeConfig.storeAddress, priority: 10 },
    select: locationSelect,
  });
}

/** Where new stock lands by default (goods receipts, imports, new variants): the first active warehouse, else the first shop. */
export async function defaultReceivingLocation(reader: Reader = db): Promise<Location> {
  const found = await reader.store.findFirst({
    where: { active: true },
    select: locationSelect,
    // StoreKind is declared SHOP, WAREHOUSE — descending puts warehouses first
    orderBy: [{ kind: "desc" }, { priority: "asc" }, { createdAt: "asc" }],
  });
  return found ?? ensureFlagship(reader);
}

/** An active location by id, or a StockError. Use when staff pick a location in a form. */
export async function activeLocation(reader: Reader, id: string | null | undefined): Promise<Location> {
  if (!id) return defaultReceivingLocation(reader);
  const s = await reader.store.findFirst({ where: { id, active: true }, select: locationSelect });
  if (!s) throw new StockError("That location isn't active. Pick another one.");
  return s;
}

/** quantity per location for some variants: Map<variantId, Map<storeId, qty>> */
export async function stockByLocation(variantIds: string[], reader: Reader = db) {
  const rows = variantIds.length ? await reader.storeStock.findMany({ where: { variantId: { in: variantIds }, quantity: { gt: 0 } }, select: { variantId: true, storeId: true, quantity: true } }) : [];
  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!map.has(r.variantId)) map.set(r.variantId, new Map());
    map.get(r.variantId)!.set(r.storeId, r.quantity);
  }
  return map;
}

// ---------- Allocation (which location each sold unit comes from) ----------

export type AllocLine = { orderItemId: string; variantId: string; quantity: number; label: string };

/**
 * Pure planning step, exported for tests. Picks the order in which locations are tried for every
 * line: the preferred location (pickup shop / till) first, then the location that can fill the most
 * lines completely (fewer parcels to consolidate), then by priority.
 */
export function rankLocations(
  lines: { variantId: string; quantity: number }[],
  locations: { id: string; priority: number; district?: string | null }[],
  available: Map<string, Map<string, number>>,
  prefer?: string,
  toDistrict?: string | null,
) {
  const fills = (storeId: string) => lines.filter((l) => (available.get(l.variantId)?.get(storeId) ?? 0) >= l.quantity).length;
  const all = (storeId: string) => (fills(storeId) === lines.length ? 1 : 0);
  // one parcel beats two; then the nearest to the customer; then the most lines on hand; then the owner's priority
  const ranked = [...locations].sort((a, b) =>
    all(b.id) - all(a.id) ||
    distanceTier(a.district, toDistrict) - distanceTier(b.district, toDistrict) ||
    fills(b.id) - fills(a.id) ||
    a.priority - b.priority);
  if (prefer) {
    const i = ranked.findIndex((l) => l.id === prefer);
    if (i > 0) ranked.unshift(...ranked.splice(i, 1));
  }
  return ranked.map((l) => l.id);
}

/**
 * Take stock for an order's lines and record where it came from (OrderAllocation + SALE ledger rows).
 * `only` restricts to one location (the till's shop); otherwise any active location may supply,
 * splitting a line across locations when no single one has enough.
 */
export async function allocateOrder(tx: Tx, opts: {
  orderId: string;
  lines: AllocLine[];
  prefer?: string;
  only?: string;
  /** delivery district: nearer locations are tried first */
  toDistrict?: string | null;
  actorId?: string | null;
  note?: string;
  picked?: boolean;
  /**
   * Offline till sales only: the goods have already left the shop, so take what the location has and
   * return the rest as shortfalls (for the manager) instead of refusing. Stock never goes below zero.
   */
  allowShort?: boolean;
}): Promise<{ variantId: string; orderItemId: string; quantity: number }[]> {
  const select = { id: true, priority: true, district: true } as const;
  const locations = opts.only
    ? await tx.store.findMany({ where: { id: opts.only, active: true }, select })
    // online orders: locations that ship, plus the chosen pickup shop even if it doesn't ship
    : await tx.store.findMany({ where: { active: true, OR: [{ shipsOnline: true }, ...(opts.prefer ? [{ id: opts.prefer }] : [])] }, select });
  if (!locations.length) throw new StockError("No location can send this order right now.");
  const available = await stockByLocation([...new Set(opts.lines.map((l) => l.variantId))], tx);
  const order = rankLocations(opts.lines, locations, available, opts.prefer ?? opts.only, opts.toDistrict);
  const now = new Date();
  const short: { variantId: string; orderItemId: string; quantity: number }[] = [];

  for (const line of opts.lines) {
    let remaining = line.quantity;
    for (const storeId of order) {
      let have = available.get(line.variantId)?.get(storeId) ?? 0;
      // conditional decrement; if someone else just took units here, re-read and try what's left
      for (let attempt = 0; remaining > 0 && have > 0 && attempt < 3; attempt++) {
        const take = Math.min(remaining, have);
        if (await moveStock(tx, { variantId: line.variantId, storeId, delta: -take, reason: "SALE", note: opts.note, orderId: opts.orderId, actorId: opts.actorId })) {
          await tx.orderAllocation.create({
            data: { orderId: opts.orderId, orderItemId: line.orderItemId, variantId: line.variantId, storeId, quantity: take, ...(opts.picked ? { pickedAt: now, pickedById: opts.actorId ?? null } : {}) },
          });
          remaining -= take;
          have -= take;
        } else {
          have = (await tx.storeStock.findUnique({ where: { storeId_variantId: { storeId, variantId: line.variantId } }, select: { quantity: true } }))?.quantity ?? 0;
        }
      }
      available.get(line.variantId)?.set(storeId, have);
    }
    if (remaining && opts.allowShort) short.push({ variantId: line.variantId, orderItemId: line.orderItemId, quantity: remaining });
    else if (remaining) throw new StockError(`${line.label} just sold out. Please update your bag.`, line.variantId);
  }
  return short;
}

/**
 * Put an order's units back (cancel or courier return), at the locations they were taken from,
 * newest allocation first. `qtyByItem` is how many units of each item come back. Units with no
 * allocation (orders from before locations existed) go to the default receiving location.
 */
export async function restockOrder(tx: Tx, opts: {
  orderId: string;
  items: { id: string; variantId: string | null; quantity: number }[];
  reason: "CANCEL_RESTOCK" | "RETURN_RESTOCK";
  actorId?: string | null;
  note?: string;
  /** put everything here instead (e.g. a pickup order already moved to the pickup shop) */
  to?: string;
}) {
  const allocations = await tx.orderAllocation.findMany({ where: { orderId: opts.orderId }, orderBy: { createdAt: "desc" }, select: { orderItemId: true, storeId: true, quantity: true } });
  let fallback: string | undefined;
  for (const it of opts.items) {
    if (!it.variantId || it.quantity <= 0) continue;
    let remaining = it.quantity;
    const back = new Map<string, number>();
    for (const a of opts.to ? [] : allocations.filter((x) => x.orderItemId === it.id)) {
      const n = Math.min(remaining, a.quantity);
      if (n > 0) back.set(a.storeId, (back.get(a.storeId) ?? 0) + n);
      remaining -= n;
    }
    if (remaining > 0) {
      fallback ??= opts.to ?? (await defaultReceivingLocation(tx)).id;
      back.set(fallback, (back.get(fallback) ?? 0) + remaining);
    }
    for (const [storeId, n] of back) await moveStock(tx, { variantId: it.variantId, storeId, delta: n, reason: opts.reason, orderId: opts.orderId, actorId: opts.actorId, note: opts.note });
  }
}

/** Remove every unit of a variant from every location (variant retired from the catalogue). */
export async function zeroVariant(tx: Tx, variantId: string, actorId: string, note: string) {
  const rows = await tx.storeStock.findMany({ where: { variantId, quantity: { gt: 0 } }, select: { storeId: true, quantity: true } });
  for (const r of rows) await moveStockOrThrow(tx, { variantId, storeId: r.storeId, delta: -r.quantity, reason: "MANUAL_ADJUST", note, actorId }, "Stock changed while removing this size. Try again.");
}
