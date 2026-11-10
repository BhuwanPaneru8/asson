import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { store, sortSizes } from "./config";
import { ktmDate } from "./pos";
import { inChunks } from "./batch";

// Buying and merchandising insights. Demand = units on orders that weren't cancelled or returned,
// online and at the till. Cost and margin numbers are for the owner only (the page strips them).

const DAY = 86_400_000;
const demand = (since: Date) => ({ order: { createdAt: { gte: since }, status: { notIn: ["CANCELLED" as const, "RETURNED" as const] } } });

/** Units per day, leaning on the last 30 days but steadied by 90 (one good week shouldn't triple an order). */
export function salesVelocity(sold30: number, sold90: number) {
  if (!sold30 && !sold90) return 0;
  return 0.6 * (sold30 / 30) + 0.4 * (sold90 / 90);
}

export type ReorderRow = {
  variantId: string; sku: string; name: string; color: string; size: string; stock: number; incoming: number;
  sold30: number; sold90: number; perWeek: number; daysLeft: number | null; suggested: number; urgency: "now" | "soon";
  cost: number | null; supplierId: string | null; supplierName: string | null;
};

/**
 * What to buy, by sales speed: order now if stock (plus what's already on order) runs out before a
 * new order could arrive; order soon if it runs out within two weeks after that. The suggested
 * quantity covers lead time + `coverDays` of selling, plus the safety threshold.
 */
export async function reorderPlan(opts: { leadTimeDays?: number; coverDays?: number } = {}): Promise<ReorderRow[]> {
  const lead = opts.leadTimeDays ?? store.insights.leadTimeDays;
  const cover = opts.coverDays ?? store.insights.coverDays;
  const now = Date.now();
  const [s30, s90] = await Promise.all([
    db.orderItem.groupBy({ by: ["variantId"], where: demand(new Date(now - 30 * DAY)), _sum: { quantity: true } }),
    db.orderItem.groupBy({ by: ["variantId"], where: demand(new Date(now - 90 * DAY)), _sum: { quantity: true } }),
  ]);
  const ids = s90.flatMap((s) => (s.variantId ? [s.variantId] : []));
  if (!ids.length) return [];
  // id lists in chunks (bind-value limit at national scale); lookups by Map, not .find() in a loop
  const [variants, onOrder] = await Promise.all([
    inChunks(ids, (chunk) => db.variant.findMany({
      where: { id: { in: chunk }, product: { status: "ACTIVE" } },
      select: {
        id: true, sku: true, color: true, size: true, stock: true, lowStockThreshold: true, costPrice: true, product: { select: { name: true } },
        purchaseItems: { orderBy: { purchaseOrder: { createdAt: "desc" } }, take: 1, select: { purchaseOrder: { select: { supplierId: true, supplier: { select: { name: true } } } } } },
      },
    })),
    // units already on open POs shouldn't be ordered twice
    inChunks(ids, (chunk) => db.purchaseOrderItem.findMany({ where: { variantId: { in: chunk }, purchaseOrder: { status: { in: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"] } } }, select: { variantId: true, quantityOrdered: true, quantityReceived: true, quantityDamaged: true } })),
  ]);
  const soldBy = (rows: typeof s30) => new Map(rows.map((r) => [r.variantId, r._sum.quantity ?? 0]));
  const m30 = soldBy(s30), m90 = soldBy(s90);
  const incomingBy = new Map<string, number>();
  for (const o of onOrder) if (o.variantId) incomingBy.set(o.variantId, (incomingBy.get(o.variantId) ?? 0) + o.quantityOrdered - o.quantityReceived - o.quantityDamaged);
  const rows: ReorderRow[] = [];
  for (const v of variants) {
    const sold30 = m30.get(v.id) ?? 0, sold90 = m90.get(v.id) ?? 0;
    const perDay = salesVelocity(sold30, sold90);
    if (perDay <= 0) continue;
    const incoming = incomingBy.get(v.id) ?? 0;
    const daysLeft = (v.stock + incoming) / perDay;
    const urgency = daysLeft < lead ? "now" : daysLeft < lead + 14 ? "soon" : null;
    if (!urgency) continue;
    const suggested = Math.max(0, Math.ceil(perDay * (lead + cover)) + v.lowStockThreshold - v.stock - incoming);
    if (!suggested) continue;
    const last = v.purchaseItems[0]?.purchaseOrder;
    rows.push({
      variantId: v.id, sku: v.sku, name: v.product.name, color: v.color, size: v.size, stock: v.stock, incoming, sold30, sold90,
      perWeek: Math.round(perDay * 7 * 10) / 10, daysLeft: Math.floor(daysLeft), suggested, urgency,
      cost: v.costPrice, supplierId: last?.supplierId ?? null, supplierName: last?.supplier.name ?? null,
    });
  }
  return rows.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0) || b.sold30 - a.sold30);
}

export type DeadRow = { variantId: string; productId: string; sku: string; name: string; color: string; size: string; stock: number; value: number | null; lastSold: Date | null; days: number; where: { code: string; quantity: number }[] };

/** In stock, on sale, and not sold for `days` days (or never, if it has been in the range that long). */
export async function deadStock(days = store.insights.deadStockDays) {
  const cutoff = new Date(Date.now() - days * DAY);
  const candidates = await db.variant.findMany({
    where: { stock: { gt: 0 }, createdAt: { lt: cutoff }, product: { status: "ACTIVE" } },
    select: { id: true, sku: true, color: true, size: true, stock: true, costPrice: true, createdAt: true, product: { select: { id: true, name: true } }, storeStock: { where: { quantity: { gt: 0 } }, select: { quantity: true, store: { select: { code: true } } } } },
    take: 3000,
  });
  if (!candidates.length) return { rows: [] as DeadRow[], units: 0, value: 0 };
  const recent = await db.orderItem.groupBy({ by: ["variantId"], where: { variantId: { in: candidates.map((c) => c.id) }, ...demand(cutoff) } });
  const sold = new Set(recent.map((r) => r.variantId));
  const dead = candidates.filter((c) => !sold.has(c.id));
  // when each dead variant last sold (MAX only: no time comparison, so the UTC/Kathmandu trap doesn't apply)
  const last = dead.length
    ? await db.$queryRaw<{ variantId: string; at: Date }[]>`
        SELECT oi."variantId", MAX(o."createdAt") AS "at" FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
        WHERE oi."variantId" IN (${Prisma.join(dead.map((d) => d.id))}) AND o."status" NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY oi."variantId"`
    : [];
  const lastBy = new Map(last.map((l) => [l.variantId, l.at]));
  const rows: DeadRow[] = dead.map((d) => {
    const lastSold = lastBy.get(d.id) ?? null;
    return {
      variantId: d.id, productId: d.product.id, sku: d.sku, name: d.product.name, color: d.color, size: d.size, stock: d.stock,
      value: d.costPrice != null ? d.costPrice * d.stock : null, lastSold,
      days: Math.floor((Date.now() - (lastSold ?? d.createdAt).getTime()) / DAY),
      where: d.storeStock.map((s) => ({ code: s.store.code, quantity: s.quantity })),
    };
  });
  rows.sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || b.stock - a.stock);
  return { rows, units: rows.reduce((s, r) => s + r.stock, 0), value: rows.reduce((s, r) => s + (r.value ?? 0), 0) };
}

export type MixRow = { key: string; units: number; revenue: number; cost: number; costed: number; stock: number; sellThrough: number; share: number };

/**
 * Performance by size and by colour over `days`: units, revenue after discounts, margin (where cost is
 * known) and sell-through = sold ÷ (sold + still in stock). Tells you which size curve to buy.
 */
export async function sizeColourMix(opts: { days?: number; categoryId?: string } = {}) {
  const since = new Date(Date.now() - (opts.days ?? 90) * DAY);
  const category = opts.categoryId ? await db.category.findUnique({ where: { id: opts.categoryId }, select: { id: true, children: { select: { id: true } } } }) : null;
  const categoryIds = category ? [category.id, ...category.children.map((c) => c.id)] : null;
  const productWhere = categoryIds ? { categoryId: { in: categoryIds } } : {};
  const [items, stock] = await Promise.all([
    db.orderItem.findMany({
      where: { ...demand(since), ...(categoryIds ? { variant: { product: productWhere } } : {}) },
      select: { size: true, color: true, quantity: true, unitPrice: true, unitCost: true, order: { select: { subtotal: true, discount: true, pointsDiscount: true } } },
      take: 50_000,
    }),
    db.variant.findMany({ where: { stock: { gt: 0 }, product: { status: "ACTIVE", ...productWhere } }, select: { size: true, color: true, stock: true } }),
  ]);
  const build = (pick: (x: { size: string; color: string }) => string) => {
    const m = new Map<string, MixRow>();
    const row = (k: string) => m.get(k) ?? m.set(k, { key: k, units: 0, revenue: 0, cost: 0, costed: 0, stock: 0, sellThrough: 0, share: 0 }).get(k)!;
    for (const i of items) {
      const r = row(pick(i));
      // revenue net of the order's coupon and points discount, spread by line value
      const net = i.order.subtotal ? (i.order.subtotal - i.order.discount - i.order.pointsDiscount) / i.order.subtotal : 1;
      r.units += i.quantity;
      r.revenue += Math.round(i.unitPrice * i.quantity * net);
      if (i.unitCost != null) { r.cost += i.unitCost * i.quantity; r.costed += Math.round(i.unitPrice * i.quantity * net); }
    }
    for (const v of stock) row(pick(v)).stock += v.stock;
    const totalUnits = [...m.values()].reduce((s, r) => s + r.units, 0) || 1;
    for (const r of m.values()) {
      r.sellThrough = r.units + r.stock ? Math.round((r.units / (r.units + r.stock)) * 1000) / 10 : 0;
      r.share = Math.round((r.units / totalUnits) * 1000) / 10;
    }
    return [...m.values()];
  };
  const sizes = build((x) => x.size);
  const order = sortSizes(sizes.map((s) => s.key));
  return {
    sizes: order.map((k) => sizes.find((s) => s.key === k)!),
    colours: build((x) => x.color).sort((a, b) => b.units - a.units),
    units: items.reduce((s, i) => s + i.quantity, 0),
  };
}

/** Margin % on the part of revenue whose cost is known; null when nothing was costed. */
export const marginPct = (r: Pick<MixRow, "cost" | "costed">) => (r.costed ? Math.round(((r.costed - r.cost) / r.costed) * 1000) / 10 : null);

/** Top searches and searches that found nothing, over the last `days` Nepal days. */
export async function searchInsights(days = 30) {
  const since = ktmDate(new Date(Date.now() - (days - 1) * DAY));
  const [top, zero, totals] = await Promise.all([
    db.searchStat.groupBy({ by: ["term"], where: { day: { gte: since } }, _sum: { searches: true, zeroResults: true }, orderBy: [{ _sum: { searches: "desc" } }, { term: "asc" }], take: 25 }),
    db.searchStat.groupBy({ by: ["term"], where: { day: { gte: since }, zeroResults: { gt: 0 } }, _sum: { zeroResults: true, searches: true }, orderBy: [{ _sum: { zeroResults: "desc" } }, { term: "asc" }], take: 25 }),
    db.searchStat.aggregate({ where: { day: { gte: since } }, _sum: { searches: true, zeroResults: true } }),
  ]);
  // does it still find nothing? (the latest day it was searched)
  const latest = zero.length ? await db.searchStat.findMany({ where: { term: { in: zero.map((z) => z.term) } }, orderBy: { day: "desc" }, distinct: ["term"], select: { term: true, lastResults: true } }) : [];
  return {
    searches: totals._sum.searches ?? 0,
    zeroResults: totals._sum.zeroResults ?? 0,
    top: top.map((t) => ({ term: t.term, searches: t._sum.searches ?? 0, zero: t._sum.zeroResults ?? 0 })),
    zero: zero.map((z) => ({ term: z.term, searches: z._sum.searches ?? 0, zero: z._sum.zeroResults ?? 0, stillZero: (latest.find((l) => l.term === z.term)?.lastResults ?? 0) === 0 })),
  };
}
