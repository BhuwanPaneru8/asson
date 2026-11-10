import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { provinceOf } from "./config";
import { ktmDate } from "./pos";
import type { Scope } from "./scope";

// HQ view of the whole network. Sales are credited to the location the goods came from (OrderAllocation),
// so till sales and online orders shipped from a shop or warehouse are counted the same way. Revenue is
// after the order's discounts; orders cancelled or returned are left out. Raw SQL compares stored UTC
// timestamps with `AT TIME ZONE 'UTC'` (the database session runs in Asia/Kathmandu: gotcha 30b).

const DAY = 86_400_000;
export type Period = { start: Date; end: Date };
export type Grouping = "location" | "district" | "province";

type SalesRow = { storeId: string; units: number; orders: number; revenue: number; cost: number; uncosted: number };

export async function salesByLocation(p: Period): Promise<Map<string, SalesRow>> {
  const rows = await db.$queryRaw<{ storeId: string; units: bigint; orders: bigint; revenue: Prisma.Decimal | null; cost: bigint | null; uncosted: bigint }[]>`
    SELECT a."storeId",
      SUM(a."quantity") AS "units",
      COUNT(DISTINCT a."orderId") AS "orders",
      SUM(a."quantity" * oi."unitPrice" * CASE WHEN o."subtotal" > 0 THEN (o."subtotal" - o."discount" - o."pointsDiscount")::numeric / o."subtotal" ELSE 1 END) AS "revenue",
      SUM(a."quantity" * COALESCE(oi."unitCost", 0)) AS "cost",
      SUM(CASE WHEN oi."unitCost" IS NULL THEN a."quantity" ELSE 0 END) AS "uncosted"
    FROM "OrderAllocation" a
    JOIN "OrderItem" oi ON oi."id" = a."orderItemId"
    JOIN "Order" o ON o."id" = a."orderId"
    WHERE o."status" NOT IN ('CANCELLED', 'RETURNED')
      AND o."createdAt" >= (${p.start}::timestamptz AT TIME ZONE 'UTC')
      AND o."createdAt" < (${p.end}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY a."storeId"`;
  return new Map(rows.map((r) => [r.storeId, { storeId: r.storeId, units: Number(r.units), orders: Number(r.orders), revenue: Math.round(Number(r.revenue ?? 0)), cost: Number(r.cost ?? 0), uncosted: Number(r.uncosted) }]));
}

export type NetworkRow = {
  key: string; label: string; sub: string; locations: number;
  revenue: number; previous: number; growth: number | null; units: number; orders: number;
  margin: number | null; stockUnits: number; stockValue: number; coverDays: number | null; sellThrough: number | null;
};

export async function networkReport(opts: { days: number; scope: Scope; group: Grouping; now?: Date }) {
  const now = opts.now ?? new Date();
  const cur: Period = { start: new Date(now.getTime() - opts.days * DAY), end: now };
  const prev: Period = { start: new Date(cur.start.getTime() - opts.days * DAY), end: cur.start };
  const where: Prisma.StoreWhereInput = { active: true, ...(opts.scope.all ? {} : { id: { in: opts.scope.storeIds } }) };
  const [locations, sales, before, stock] = await Promise.all([
    db.store.findMany({ where, select: { id: true, name: true, code: true, kind: true, district: true } }),
    salesByLocation(cur),
    salesByLocation(prev),
    db.$queryRaw<{ storeId: string; units: bigint; value: bigint }[]>`
      SELECT s."storeId", SUM(s."quantity") AS "units", SUM(s."quantity"::bigint * COALESCE(v."costPrice", 0)) AS "value"
      FROM "StoreStock" s JOIN "Variant" v ON v."id" = s."variantId" GROUP BY s."storeId"`,
  ]);
  const groupKey = (l: (typeof locations)[number]) =>
    opts.group === "location" ? l.id : opts.group === "district" ? l.district ?? "—" : (l.district && provinceOf(l.district)) || "—";
  const groups = new Map<string, NetworkRow & { cost: number }>();
  for (const l of locations) {
    const key = groupKey(l);
    const label = opts.group === "location" ? l.name : key === "—" ? "District not set" : key;
    const sub = opts.group === "location" ? [l.kind === "SHOP" ? "Shop" : "Warehouse", l.district].filter(Boolean).join(" · ") : "";
    const g = groups.get(key) ?? { key, label, sub, locations: 0, revenue: 0, previous: 0, growth: null, units: 0, orders: 0, margin: null, stockUnits: 0, stockValue: 0, coverDays: null, sellThrough: null, cost: 0 };
    const s = sales.get(l.id), b = before.get(l.id), st = stock.find((x) => x.storeId === l.id);
    g.locations++;
    g.revenue += s?.revenue ?? 0; g.previous += b?.revenue ?? 0; g.units += s?.units ?? 0; g.orders += s?.orders ?? 0; g.cost += s?.cost ?? 0;
    g.stockUnits += Number(st?.units ?? 0); g.stockValue += Number(st?.value ?? 0);
    groups.set(key, g);
  }
  const rows: NetworkRow[] = [...groups.values()].map(({ cost, ...g }) => ({
    ...g,
    growth: g.previous ? Math.round(((g.revenue - g.previous) / g.previous) * 1000) / 10 : null,
    margin: g.revenue ? Math.round(((g.revenue - cost) / g.revenue) * 1000) / 10 : null,
    coverDays: g.units ? Math.round(g.stockUnits / (g.units / opts.days)) : null,
    sellThrough: g.units + g.stockUnits ? Math.round((g.units / (g.units + g.stockUnits)) * 1000) / 10 : null,
  })).sort((a, b) => b.revenue - a.revenue);
  const total = rows.reduce((t, r) => ({ revenue: t.revenue + r.revenue, previous: t.previous + r.previous, units: t.units + r.units, orders: t.orders + r.orders, stockValue: t.stockValue + r.stockValue }), { revenue: 0, previous: 0, units: 0, orders: 0, stockValue: 0 });
  const cost = [...sales.values()].filter((s) => locations.some((l) => l.id === s.storeId)).reduce((t, s) => t + s.cost, 0);
  return {
    rows,
    total: { ...total, growth: total.previous ? Math.round(((total.revenue - total.previous) / total.previous) * 1000) / 10 : null, margin: total.revenue ? Math.round(((total.revenue - cost) / total.revenue) * 1000) / 10 : null, locations: locations.length },
  };
}

/** Till performance per cashier over the period (in-store sales only). */
export async function cashierReport(opts: { days: number; scope: Scope; now?: Date }) {
  const since = new Date((opts.now ?? new Date()).getTime() - opts.days * DAY);
  const shopFilter = opts.scope.all ? {} : { shift: { storeId: { in: opts.scope.storeIds } } };
  const rows = await db.order.groupBy({
    by: ["cashierId"],
    where: { channel: "STORE", createdAt: { gte: since }, status: { notIn: ["CANCELLED", "RETURNED"] }, cashierId: { not: null }, ...shopFilter },
    _sum: { total: true, subtotal: true, discount: true }, _count: { _all: true },
  });
  const people = await db.user.findMany({ where: { id: { in: rows.map((r) => r.cashierId!) } }, select: { id: true, name: true } });
  return rows.map((r) => ({
    name: people.find((p) => p.id === r.cashierId)?.name ?? "—",
    sales: r._count._all, revenue: r._sum.total ?? 0,
    basket: r._count._all ? Math.round((r._sum.total ?? 0) / r._count._all) : 0,
    discountPct: r._sum.subtotal ? Math.round(((r._sum.discount ?? 0) / r._sum.subtotal) * 1000) / 10 : 0,
  })).sort((a, b) => b.revenue - a.revenue);
}

export type Alert = { tone: "danger" | "warn"; text: string; href: string };

/** Things someone at HQ should chase today. */
export async function networkAlerts(scope: Scope, now = new Date()): Promise<Alert[]> {
  const mine: Prisma.StoreWhereInput = { active: true, ...(scope.all ? {} : { id: { in: scope.storeIds } }) };
  const ids = scope.all ? undefined : { in: scope.storeIds };
  const [shops, lateTransfers, waitingCounts, shifts, closes, short] = await Promise.all([
    db.store.findMany({ where: { ...mine, kind: "SHOP", createdAt: { lt: new Date(now.getTime() - 7 * DAY) } }, select: { id: true, name: true, allocations: { where: { createdAt: { gte: new Date(now.getTime() - 3 * DAY) } }, select: { id: true }, take: 1 } } }),
    db.stockTransfer.findMany({ where: { status: "SENT", sentAt: { lt: new Date(now.getTime() - 5 * DAY) }, ...(ids ? { OR: [{ fromId: ids }, { toId: ids }] } : {}) }, select: { id: true, number: true, from: { select: { name: true } }, to: { select: { name: true } } } }),
    db.stockCount.findMany({ where: { status: "SUBMITTED", submittedAt: { lt: new Date(now.getTime() - 2 * DAY) }, ...(ids ? { storeId: ids } : {}) }, select: { id: true, number: true, store: { select: { name: true } } } }),
    db.shift.findMany({ where: { openedAt: { gte: new Date(now.getTime() - 8 * DAY) }, ...(ids ? { storeId: ids } : {}) }, select: { storeId: true, openedAt: true, store: { select: { name: true } } } }),
    db.dayClose.findMany({ where: { date: { gte: ktmDate(new Date(now.getTime() - 8 * DAY)) }, ...(ids ? { storeId: ids } : {}) }, select: { storeId: true, date: true } }),
    db.shift.groupBy({ by: ["storeId"], where: { status: "CLOSED", closedAt: { gte: new Date(now.getTime() - 7 * DAY) }, ...(ids ? { storeId: ids } : {}) }, _sum: { difference: true } }),
  ]);
  const alerts: Alert[] = [];
  for (const s of shops) if (!s.allocations.length) alerts.push({ tone: "warn", text: `${s.name}: no sales in 3 days`, href: `/admin/network?group=location` });
  for (const t of lateTransfers) alerts.push({ tone: "warn", text: `TR-${String(t.number).padStart(5, "0")} ${t.from.name} → ${t.to.name} in transit for 5+ days`, href: `/admin/transfers/${t.id}` });
  for (const c of waitingCounts) alerts.push({ tone: "warn", text: `Stock count SC-${String(c.number).padStart(5, "0")} at ${c.store.name} waiting for approval`, href: `/admin/counts/${c.id}` });
  const today = ktmDate(now);
  const unlocked = new Map<string, { name: string; days: Set<string> }>();
  for (const sh of shifts) {
    const d = ktmDate(sh.openedAt);
    if (d >= today || closes.some((c) => c.storeId === sh.storeId && c.date === d)) continue;
    const u = unlocked.get(sh.storeId) ?? { name: sh.store.name, days: new Set<string>() };
    u.days.add(d);
    unlocked.set(sh.storeId, u);
  }
  for (const [storeId, u] of unlocked) alerts.push({ tone: "warn", text: `${u.name}: ${u.days.size} day${u.days.size > 1 ? "s" : ""} not closed (${[...u.days].sort().join(", ")})`, href: `/admin/closing?store=${storeId}` });
  const names = short.length ? await db.store.findMany({ where: { id: { in: short.map((s) => s.storeId) } }, select: { id: true, name: true } }) : [];
  for (const s of short) if ((s._sum.difference ?? 0) <= -50_000) alerts.push({ tone: "danger", text: `${names.find((n) => n.id === s.storeId)?.name}: cash short Rs. ${(-(s._sum.difference ?? 0) / 100).toLocaleString("en-IN")} this week`, href: `/admin/closing?store=${s.storeId}` });
  return alerts.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "danger" ? -1 : 1));
}
