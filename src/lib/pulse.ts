import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { ktmDate } from "./pos";
import { change, monthEnd, unusual, type Verdict } from "./kpi-core";

// KPI pulse: the business's vital signs, each read against its own usual level (maths in kpi-core.ts). Days are
// Nepal calendar days. "Yesterday" is the last full day; today is still running. Revenue is what customers paid
// for orders that weren't cancelled (online and till, VAT included); margin needs the cost on each order line.

const DAY = 86_400_000, BACK = 63; // nine weeks: eight of history for every weekday, plus this one

type DayRow = { day: string; orders: number; revenue: number; units: number; cost: number; costed: number; online: number; newCustomers: number; cancelled: number; returns: number; views: number; adds: number };

async function daily(from: string) {
  const start = new Date(`${from}T00:00:00+05:45`);
  const [sales, funnel] = await Promise.all([
    db.$queryRaw<Omit<DayRow, "views" | "adds">[]>`
      SELECT to_char((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD') AS "day",
        COUNT(*) FILTER (WHERE o."status" <> 'CANCELLED')::int AS "orders",
        COALESCE(SUM(o."total") FILTER (WHERE o."status" <> 'CANCELLED'), 0)::bigint AS "revenue",
        COALESCE(SUM(i."units") FILTER (WHERE o."status" <> 'CANCELLED'), 0)::int AS "units",
        COALESCE(SUM(i."cost") FILTER (WHERE o."status" <> 'CANCELLED'), 0)::bigint AS "cost",
        COALESCE(SUM(i."costedSales") FILTER (WHERE o."status" <> 'CANCELLED'), 0)::bigint AS "costed",
        COUNT(*) FILTER (WHERE o."status" <> 'CANCELLED' AND o."channel" = 'ONLINE')::int AS "online",
        COUNT(*) FILTER (WHERE o."status" <> 'CANCELLED' AND NOT EXISTS (SELECT 1 FROM "Order" p WHERE p."phone" = o."phone" AND p."createdAt" < o."createdAt" AND p."status" <> 'CANCELLED'))::int AS "newCustomers",
        COUNT(*) FILTER (WHERE o."status" = 'CANCELLED')::int AS "cancelled",
        COUNT(*) FILTER (WHERE o."status" IN ('RETURN_REQUESTED', 'RETURNED'))::int AS "returns"
      FROM "Order" o
      LEFT JOIN LATERAL (
        SELECT SUM(x."quantity") AS "units",
          SUM(x."unitCost" * x."quantity") FILTER (WHERE x."unitCost" IS NOT NULL) AS "cost",
          SUM(x."unitPrice" * x."quantity") FILTER (WHERE x."unitCost" IS NOT NULL) AS "costedSales"
        FROM "OrderItem" x WHERE x."orderId" = o."id"
      ) i ON true
      WHERE o."createdAt" >= (${start}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY 1`,
    db.funnelStat.findMany({ where: { day: { gte: from } } }),
  ]);
  const by = new Map<string, DayRow>();
  for (const r of sales) by.set(r.day, { ...r, revenue: Number(r.revenue), cost: Number(r.cost), costed: Number(r.costed), views: 0, adds: 0 });
  for (const f of funnel) {
    const r = by.get(f.day) ?? { day: f.day, orders: 0, revenue: 0, units: 0, cost: 0, costed: 0, online: 0, newCustomers: 0, cancelled: 0, returns: 0, views: 0, adds: 0 };
    if (f.step === "view") r.views = f.count;
    if (f.step === "add") r.adds = f.count;
    by.set(f.day, r);
  }
  return by;
}

export type Kpi = {
  key: string; label: string; format: "money" | "count" | "pct";
  /** null: a rate on a day with nothing to divide by (no orders, no visits) */
  yesterday: number | null; verdict: Verdict; last7: number; prev7: number; change: number | null; spark: number[];
  /** higher is better (revenue) or worse (cancellations): colours the verdict */
  goodWhen: "high" | "low"; ownerOnly?: boolean;
};

async function compute(today: string) {
  const days = Array.from({ length: BACK }, (_, i) => ktmDate(new Date(Date.parse(`${today}T12:00:00+05:45`) - (BACK - i) * DAY))); // oldest … yesterday
  const by = await daily(days[0]);
  const get = (d: string) => by.get(d);
  const metric = (f: (r: DayRow | undefined) => number | null) => days.map((d) => f(get(d)));
  // a rate on a day with no orders (or visits) is unknown, not zero: it's never flagged or counted as history
  const ratio = (num: (r: DayRow) => number, den: (r: DayRow) => number) => (r: DayRow | undefined) => (r && den(r) ? num(r) / den(r) : null);

  const defs: Omit<Kpi, "yesterday" | "verdict" | "last7" | "prev7" | "change" | "spark">[] = [
    { key: "revenue", label: "Sales", format: "money", goodWhen: "high" },
    { key: "orders", label: "Orders", format: "count", goodWhen: "high" },
    { key: "aov", label: "Average order", format: "money", goodWhen: "high" },
    { key: "units", label: "Units sold", format: "count", goodWhen: "high" },
    { key: "newCustomers", label: "New customers", format: "count", goodWhen: "high" },
    { key: "conversion", label: "Online conversion", format: "pct", goodWhen: "high" },
    { key: "addRate", label: "Add-to-bag rate", format: "pct", goodWhen: "high" },
    { key: "cancelRate", label: "Cancelled", format: "pct", goodWhen: "low" },
    { key: "margin", label: "Gross margin", format: "pct", goodWhen: "high", ownerOnly: true },
  ];
  const series: Record<string, (number | null)[]> = {
    revenue: metric((r) => r?.revenue ?? 0),
    orders: metric((r) => r?.orders ?? 0),
    aov: metric(ratio((r) => r.revenue, (r) => r.orders)),
    units: metric((r) => r?.units ?? 0),
    newCustomers: metric((r) => r?.newCustomers ?? 0),
    conversion: metric(ratio((r) => r.online, (r) => r.views)),
    addRate: metric(ratio((r) => r.adds, (r) => r.views)),
    cancelRate: metric(ratio((r) => r.cancelled, (r) => r.orders + r.cancelled)),
    margin: metric(ratio((r) => r.costed - r.cost, (r) => r.costed)),
  };
  const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
  const rates = new Set(["aov", "conversion", "addRate", "cancelRate", "margin"]);
  const kpis: Kpi[] = defs.map((d) => {
    const s = series[d.key];
    const y = s[s.length - 1];
    const known = (a: (number | null)[]) => a.filter((x): x is number => x != null);
    const sameWeekday = known(s.filter((_, i) => (s.length - 1 - i) % 7 === 0 && i !== s.length - 1)).slice(-8);
    const last7 = known(s.slice(-7)), prev7 = known(s.slice(-14, -7));
    const agg = (a: number[]) => (rates.has(d.key) ? (a.length ? sum(a) / a.length : 0) : sum(a));
    const verdict = y == null ? { usual: sameWeekday.length ? [...sameWeekday].sort((p, q) => p - q)[Math.floor(sameWeekday.length / 2)] : 0, z: null, level: "normal" as const, strength: null } : unusual(y, sameWeekday, { minSpread: d.format === "count" ? 1 : d.format === "money" ? 500_00 : 0.02 /* small floors: the 10%-of-usual floor in kpi-core scales with the shop */ });
    return { ...d, yesterday: y, verdict, last7: agg(last7), prev7: agg(prev7), change: change(agg(last7), agg(prev7)), spark: s.slice(-28).map((x) => x ?? 0) };
  });

  // month end, for sales and orders
  const month = today.slice(0, 7);
  const monthDays = days.filter((d) => d.startsWith(month));
  const byWeekday = (s: (number | null)[]) => Array.from({ length: 7 }, (_, w) => s.map((x) => x ?? 0).filter((_, i) => new Date(`${days[i]}T00:00:00Z`).getUTCDay() === w).slice(-8));
  const remaining: number[] = [];
  for (let t = Date.parse(`${today}T00:00:00Z`); new Date(t).toISOString().slice(0, 7) === month; t += DAY) remaining.push(new Date(t).getUTCDay());
  const sofar = (key: string) => sum(series[key].filter((_, i) => monthDays.includes(days[i])).map((x) => x ?? 0));
  const forecast = {
    revenue: { soFar: sofar("revenue"), ...monthEnd(sofar("revenue"), byWeekday(series.revenue), remaining) },
    orders: { soFar: sofar("orders"), ...monthEnd(sofar("orders"), byWeekday(series.orders), remaining) },
    daysLeft: remaining.length,
  };
  return { kpis, forecast, yesterday: days[days.length - 1] };
}

/** The pulse, recomputed at most every 15 minutes. */
export const pulse = unstable_cache(async (today: string) => compute(today), ["kpi-pulse"], { revalidate: 900, tags: ["pulse"] });
export const pulseToday = () => pulse(ktmDate());
