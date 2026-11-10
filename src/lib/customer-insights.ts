import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { ktmDate } from "./pos";

// Who buys again, and where shoppers drop off. A "customer" is a registered account, or a phone
// number for guests and till sales (walk-ins without a phone can't be followed and are left out).
// Revenue here is goods value (order total minus delivery), on orders that weren't cancelled or returned.

const DAY = 86_400_000;
const month = (d: Date) => ktmDate(d).slice(0, 7);
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5)) - Number(a.slice(5));

export type Segment = "champion" | "loyal" | "new" | "at_risk" | "one_time" | "lost";
export const SEGMENTS: { key: Segment; label: string; hint: string }[] = [
  { key: "champion", label: "Champions", hint: "3+ orders, bought in the last 60 days: thank them, early access" },
  { key: "loyal", label: "Loyal", hint: "2+ orders, bought in the last 4 months" },
  { key: "new", label: "New", hint: "first order in the last 60 days: make the second one easy" },
  { key: "at_risk", label: "At risk", hint: "repeat buyers quiet for 4–12 months: win them back" },
  { key: "one_time", label: "One-time, lapsed", hint: "one order, 2–12 months ago" },
  { key: "lost", label: "Lost", hint: "nothing for over a year" },
];

/** Recency/frequency rules, in order. */
export function segmentOf(orders: number, daysSinceLast: number): Segment {
  if (daysSinceLast > 365) return "lost";
  if (orders >= 3 && daysSinceLast <= 60) return "champion";
  if (orders >= 2 && daysSinceLast <= 120) return "loyal";
  if (orders >= 2) return "at_risk";
  if (daysSinceLast <= 60) return "new";
  return "one_time";
}

const maskPhone = (p: string) => (p.length >= 10 ? `${p.slice(0, 2)}••••${p.slice(-4)}` : "");

/** One row per customer (account, or phone for guests and till sales), built in the database. */
const CUSTOMERS = Prisma.sql`
  WITH o AS (
    SELECT o."createdAt", o."total" - o."shippingFee" AS "goods", o."channel",
      right(regexp_replace(o."phone", '[^0-9]', '', 'g'), 10) AS "phone", o."userId",
      COALESCE(NULLIF(u."name", ''), o."shippingAddress"->>'fullName', '') AS "name",
      to_char((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM') AS "month"
    FROM "Order" o LEFT JOIN "User" u ON u."id" = o."userId"
    WHERE o."status" NOT IN ('CANCELLED', 'RETURNED')
  ), k AS (
    SELECT *, COALESCE("userId", CASE WHEN length("phone") = 10 THEN 'p:' || "phone" END) AS "key" FROM o
  ), c AS (
    SELECT "key",
      (array_agg("name" ORDER BY "createdAt" DESC) FILTER (WHERE "name" <> '' AND "name" <> 'Walk-in customer'))[1] AS "name",
      (array_agg("phone" ORDER BY "createdAt"))[1] AS "phone",
      MIN("createdAt") AS "first", MAX("createdAt") AS "last", COUNT(*)::int AS "orders", SUM("goods")::bigint AS "revenue",
      MIN("month") AS "firstMonth", array_agg(DISTINCT "month") AS "months", COUNT(DISTINCT "channel")::int AS "channels"
    FROM k WHERE "key" IS NOT NULL GROUP BY "key"
  )`;

/**
 * Repeat buying, value, segments and cohorts. Everything is summed in the database: a national chain has
 * hundreds of thousands of customers, and shipping one row each to the app was the slow part (13 s at
 * 300k orders); the old version also capped at 200k orders and silently dropped the newest.
 */
export async function customerInsights(now = new Date()) {
  const n = (v: bigint | number | null) => Number(v ?? 0);
  const [[sum], recency, cohortCells, topRows] = await Promise.all([
    db.$queryRaw<{ customers: bigint; repeaters: bigint; orders: bigint; revenue: bigint | null; repeatRevenue: bigint | null; gap: number | null; omni: bigint }[]>`
      ${CUSTOMERS}
      SELECT COUNT(*) AS "customers", COUNT(*) FILTER (WHERE "orders" >= 2) AS "repeaters", SUM("orders") AS "orders", SUM("revenue") AS "revenue",
        SUM("revenue") FILTER (WHERE "orders" >= 2) AS "repeatRevenue",
        AVG(EXTRACT(EPOCH FROM ("last" - "first")) / 86400 / ("orders" - 1)) FILTER (WHERE "orders" >= 2) AS "gap",
        COUNT(*) FILTER (WHERE "channels" > 1) AS "omni"
      FROM c`,
    // recency × frequency buckets; the segment rules themselves stay in segmentOf()
    db.$queryRaw<{ orders: number; days: number; customers: bigint; revenue: bigint }[]>`
      ${CUSTOMERS}
      SELECT LEAST("orders", 3) AS "orders", FLOOR(EXTRACT(EPOCH FROM (${now}::timestamptz - ("last" AT TIME ZONE 'UTC'))) / 86400)::int AS "days",
        COUNT(*) AS "customers", SUM("revenue") AS "revenue"
      FROM c GROUP BY 1, 2`,
    // how many of each first-month cohort bought in each later month
    db.$queryRaw<{ firstMonth: string; month: string; customers: bigint; size: bigint }[]>`
      ${CUSTOMERS}
      SELECT c."firstMonth", m AS "month", COUNT(*) AS "customers", MAX(s."size") AS "size"
      FROM c CROSS JOIN LATERAL unnest(c."months") AS m
      JOIN (SELECT "firstMonth", COUNT(*) AS "size" FROM c GROUP BY 1) s ON s."firstMonth" = c."firstMonth"
      WHERE c."firstMonth" >= to_char((${now}::timestamptz AT TIME ZONE 'Asia/Kathmandu') - interval '12 months', 'YYYY-MM')
      GROUP BY 1, 2`,
    db.$queryRaw<{ name: string | null; phone: string; orders: number; revenue: bigint; last: Date }[]>`
      ${CUSTOMERS}
      SELECT "name", "phone", "orders", "revenue", "last" FROM c ORDER BY "revenue" DESC, "last" DESC LIMIT 15`,
  ]);
  const customers = n(sum?.customers ?? 0), revenue = n(sum?.revenue ?? 0);

  // cohorts: customers by first-order month (last 12), and the share who ordered again in each later month
  const thisMonth = month(now);
  const cohortMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${thisMonth}-15T12:00:00+05:45`);
    d.setMonth(d.getMonth() - (11 - i));
    return month(d);
  });
  const cohorts = cohortMonths.map((m) => {
    const cells = cohortCells.filter((x) => x.firstMonth === m);
    const size = n(cells[0]?.size ?? 0);
    const maxOffset = monthsBetween(m, thisMonth);
    return {
      month: m,
      size,
      // offset k = still buying k months after their first month (null = that month hasn't happened yet)
      retention: [1, 2, 3, 4, 5, 6].map((k) => (k > maxOffset || !size ? null : Math.round((n(cells.find((x) => monthsBetween(m, x.month) === k)?.customers ?? 0) / size) * 1000) / 10)),
    };
  });

  const bySegment = new Map<Segment, { customers: number; revenue: number }>();
  for (const r of recency) {
    const s = segmentOf(r.orders, r.days);
    const row = bySegment.get(s) ?? { customers: 0, revenue: 0 };
    row.customers += n(r.customers); row.revenue += n(r.revenue);
    bySegment.set(s, row);
  }

  return {
    customers,
    repeatRate: customers ? Math.round((n(sum.repeaters) / customers) * 1000) / 10 : 0,
    repeatRevenueShare: revenue ? Math.round((n(sum.repeatRevenue) / revenue) * 1000) / 10 : 0,
    ordersPerCustomer: customers ? Math.round((n(sum.orders) / customers) * 100) / 100 : 0,
    lifetimeValue: customers ? Math.round(revenue / customers) : 0,
    daysBetweenOrders: sum?.gap != null ? Math.round(Number(sum.gap)) : null,
    omnichannel: n(sum?.omni ?? 0),
    segments: SEGMENTS.map((s) => ({ ...s, customers: bySegment.get(s.key)?.customers ?? 0, revenue: bySegment.get(s.key)?.revenue ?? 0 })),
    cohorts,
    top: topRows.map((c) => {
      const days = Math.floor((now.getTime() - c.last.getTime()) / DAY);
      return { name: c.name || "Customer", phone: maskPhone(c.phone), orders: c.orders, revenue: n(c.revenue), last: c.last, segment: segmentOf(c.orders, days) };
    }),
  };
}

/** Funnel over the last `days` Nepal days: totals, step rates, and per-product view → bag → order. */
export async function funnelInsights(days = 30, now = new Date()) {
  // compare like with like: orders only from the day view/bag counting began (it didn't exist before)
  const first = (await db.funnelStat.aggregate({ _min: { day: true } }))._min.day;
  const window = ktmDate(new Date(now.getTime() - (days - 1) * DAY));
  const since = first && first > window ? first : window;
  const sinceDate = new Date(`${since}T00:00:00+05:45`);
  const [steps, products, orders, units] = await Promise.all([
    db.funnelStat.groupBy({ by: ["step"], where: { day: { gte: since } }, _sum: { count: true } }),
    db.productStat.groupBy({ by: ["productId"], where: { day: { gte: since } }, _sum: { views: true, adds: true }, orderBy: { _sum: { views: "desc" } }, take: 60 }),
    db.order.count({ where: { channel: "ONLINE", createdAt: { gte: sinceDate } } }),
    db.orderItem.groupBy({ by: ["productId"], where: { order: { channel: "ONLINE", createdAt: { gte: sinceDate }, status: { not: "CANCELLED" } } }, _sum: { quantity: true } }),
  ]);
  const step = (s: string) => steps.find((x) => x.step === s)?._sum.count ?? 0;
  const views = step("view"), adds = step("add"), checkouts = step("checkout");
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const names = products.length ? await db.product.findMany({ where: { id: { in: products.map((p) => p.productId) } }, select: { id: true, name: true, slug: true } }) : [];
  const rows = products.map((p) => {
    const v = p._sum.views ?? 0, a = p._sum.adds ?? 0, sold = units.find((u) => u.productId === p.productId)?._sum.quantity ?? 0;
    const n = names.find((x) => x.id === p.productId);
    return { productId: p.productId, name: n?.name ?? "—", slug: n?.slug ?? "", views: v, adds: a, sold, addRate: pct(a, v), orderRate: pct(sold, v) };
  });
  const avgAdd = pct(adds, views);
  return {
    since, countingStarted: first,
    views, adds, checkouts, orders,
    rates: { viewToAdd: avgAdd, addToCheckout: pct(checkouts, adds), checkoutToOrder: pct(orders, checkouts), viewToOrder: pct(orders, views) },
    // well-visited products that rarely make it into a bag: photos, price, sizes or description to fix
    products: rows.map((r) => ({ ...r, weak: r.views >= 50 && avgAdd != null && r.addRate != null && r.addRate < avgAdd / 2 })),
  };
}
