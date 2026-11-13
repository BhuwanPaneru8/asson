import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { store, sortSizes } from "./config";
import { ktmDate } from "./pos";
import { forecast, stockPlan, type Forecast } from "./forecast-core";

// Demand prediction for buying and merchandising (the maths is in forecast-core.ts). Per product: a year of weekly
// sales (online and till, not cancelled or returned), an 8-week forecast with an 80% range, the trend, how long
// stock lasts, when it runs out and what to reorder, split across sizes by how they've sold. Festival weeks come
// from the public holidays the owner keeps (Rosters → Public holidays): a week counts if a festival falls in it
// or in the two weeks after it, because Nepal shops for Dashain and Tihar ahead of the day.

const DAY = 86_400_000, WEEK = 7 * DAY;
const WEEKS = 52, HORIZON = 8;
const FESTIVAL = /dashain|dashami|tihar|deepawali|diwali|laxmi|bhai\s*tika|chhath|teej|lhosar|losar|holi|new\s*year|nawa\s*barsha|eid|christmas/i;

const weekStart = (t: number) => t - (((new Date(t).getUTCDay() + 7) % 7) * DAY); // Sundays, like the roster
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

export type DemandRow = {
  productId: string; name: string; slug: string; category: string; price: number;
  sold4: number; sold52: number; history: number[]; f: Forecast;
  stock: number; onOrder: number; plan: ReturnType<typeof stockPlan>;
  sizes: { size: string; stock: number; share: number; forecast: number; reorder: number }[];
};

async function compute(today: string) {
  const end = weekStart(dayMs(today)); // the current (unfinished) week isn't history
  const start = end - WEEKS * WEEK;
  const [items, products, holidays, onOrder] = await Promise.all([
    db.orderItem.findMany({ where: { order: { createdAt: { gte: new Date(start), lt: new Date(end) }, status: { notIn: ["CANCELLED", "RETURNED"] } } }, select: { productId: true, variantId: true, quantity: true, order: { select: { createdAt: true } } } }),
    db.product.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, slug: true, price: true, category: { select: { name: true } }, variants: { select: { id: true, size: true, stock: true } } } }),
    db.holiday.findMany({ where: { date: { gte: new Date(start).toISOString().slice(0, 10) } }, select: { date: true, name: true } }),
    db.purchaseOrderItem.findMany({ where: { purchaseOrder: { status: { in: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"] } } }, select: { variantId: true, quantityOrdered: true, quantityReceived: true, quantityDamaged: true } }),
  ]);
  const fest = holidays.filter((h) => FESTIVAL.test(h.name)).map((h) => dayMs(h.date));
  const isFestival = (wStart: number) => fest.some((f) => f >= wStart && f < wStart + 3 * WEEK);
  const pastFestival = Array.from({ length: WEEKS }, (_, i) => isFestival(start + i * WEEK));
  const festival = Array.from({ length: HORIZON }, (_, i) => isFestival(end + i * WEEK));

  const series = new Map<string, number[]>(), bySize = new Map<string, number>();
  const recent = end - 13 * WEEK; // the size curve comes from the last quarter
  for (const it of items) {
    const w = Math.floor((weekStart(it.order.createdAt.getTime()) - start) / WEEK);
    if (w < 0 || w >= WEEKS) continue;
    const s = series.get(it.productId) ?? Array(WEEKS).fill(0);
    s[w] += it.quantity;
    series.set(it.productId, s);
    if (it.variantId && it.order.createdAt.getTime() >= recent) bySize.set(it.variantId, (bySize.get(it.variantId) ?? 0) + it.quantity);
  }
  const incoming = new Map<string, number>();
  for (const o of onOrder) if (o.variantId) incoming.set(o.variantId, (incoming.get(o.variantId) ?? 0) + Math.max(0, o.quantityOrdered - o.quantityReceived - o.quantityDamaged));

  const rows: DemandRow[] = [];
  for (const p of products) {
    const history = series.get(p.id) ?? Array(WEEKS).fill(0);
    // only the weeks since it first sold: a product launched in May has no "zero" weeks before May
    const first = history.findIndex((v) => v > 0);
    const h = first < 0 ? history.slice(-8) : history.slice(first);
    const f = forecast(h, { horizon: HORIZON, festival, pastFestival: pastFestival.slice(first < 0 ? -8 : first), defaultUplift: store.insights.festivalUplift });
    const stock = p.variants.reduce((s, v) => s + Math.max(0, v.stock), 0);
    const inc = p.variants.reduce((s, v) => s + (incoming.get(v.id) ?? 0), 0);
    const plan = stockPlan(f, stock, inc, { leadDays: store.insights.leadTimeDays, coverDays: store.insights.coverDays, today });
    // sizes: the product's forecast split by how its sizes sold lately (evenly if they haven't)
    const sold = p.variants.map((v) => bySize.get(v.id) ?? 0), soldAll = sold.reduce((a, b) => a + b, 0);
    const sizes = sortSizes([...new Set(p.variants.map((v) => v.size))]).map((size) => {
      const vs = p.variants.filter((v) => v.size === size);
      const share = soldAll ? vs.reduce((s, v) => s + (bySize.get(v.id) ?? 0), 0) / soldAll : 1 / p.variants.length * vs.length;
      const sizeStock = vs.reduce((s, v) => s + Math.max(0, v.stock), 0) + vs.reduce((s, v) => s + (incoming.get(v.id) ?? 0), 0);
      const fc = Math.round(f.total * share * 10) / 10;
      return { size, stock: vs.reduce((s, v) => s + Math.max(0, v.stock), 0), share: Math.round(share * 100) / 100, forecast: fc, reorder: Math.max(0, Math.ceil(plan.daily * share * (store.insights.leadTimeDays + store.insights.coverDays)) - sizeStock) };
    });
    rows.push({ productId: p.id, name: p.name, slug: p.slug, category: p.category.name, price: p.price, sold4: history.slice(-4).reduce((a, b) => a + b, 0), sold52: history.reduce((a, b) => a + b, 0), history, f, stock, onOrder: inc, plan, sizes });
  }
  return { rows, festivalAhead: festival.some(Boolean), weeks: WEEKS, horizon: HORIZON };
}

/** The whole demand picture, recomputed at most hourly (it reads a year of order lines). */
export const demandPicture = unstable_cache(async (today: string) => compute(today), ["demand-picture"], { revalidate: 3600, tags: ["demand"] });

/**
 * Demand radar: what's moving, before it shows in the stockroom.
 *  rising / falling: the forecast trend (last 4 weeks vs the 4 before, ±25%, with enough units to mean it)
 *  runningOut:       stock gone before a reorder could arrive (lead time), or within it plus two weeks
 *  unmet:            demand we're not serving: searches that find nothing, people waiting for a size to come
 *                    back, people watching for a price drop, and products looked at a lot but rarely bought
 */
export async function demandRadar(today = ktmDate()) {
  const { rows, festivalAhead } = await demandPicture(today);
  const since = new Date(dayMs(today) - 30 * DAY).toISOString().slice(0, 10);
  const [zero, waiting, watching, interest] = await Promise.all([
    db.searchStat.groupBy({ by: ["term"], where: { day: { gte: since }, zeroResults: { gt: 0 } }, _sum: { zeroResults: true }, orderBy: { _sum: { zeroResults: "desc" } }, take: 10 }),
    db.stockAlert.groupBy({ by: ["variantId"], where: { notifiedAt: null }, _count: { _all: true } }),
    db.priceAlert.groupBy({ by: ["productId"], where: { notifiedAt: null }, _count: { _all: true } }),
    db.productStat.groupBy({ by: ["productId"], where: { day: { gte: since } }, _sum: { views: true, adds: true } }),
  ]);
  const variants = waiting.length ? await db.variant.findMany({ where: { id: { in: waiting.map((w) => w.variantId) } }, select: { id: true, size: true, color: true, productId: true } }) : [];
  const byId = new Map(rows.map((r) => [r.productId, r]));
  const sold30 = (r: DemandRow) => r.history.slice(-4).reduce((a, b) => a + b, 0);
  const lead = store.insights.leadTimeDays;
  return {
    festivalAhead,
    rising: rows.filter((r) => r.f.trend === "rising").sort((a, b) => (b.f.change ?? 0) - (a.f.change ?? 0)).slice(0, 8),
    falling: rows.filter((r) => r.f.trend === "falling").sort((a, b) => (a.f.change ?? 0) - (b.f.change ?? 0)).slice(0, 8),
    runningOut: rows.filter((r) => r.plan.daysLeft != null && r.plan.daysLeft <= lead + 14).sort((a, b) => a.plan.daysLeft! - b.plan.daysLeft!).slice(0, 10),
    searches: zero.map((z) => ({ term: z.term, times: z._sum.zeroResults ?? 0 })),
    waiting: variants.map((v) => ({ product: byId.get(v.productId)?.name ?? "?", slug: byId.get(v.productId)?.slug ?? "", size: v.size, color: v.color, people: waiting.find((w) => w.variantId === v.id)!._count._all })).sort((a, b) => b.people - a.people).slice(0, 10),
    watching: watching.map((w) => ({ product: byId.get(w.productId)?.name ?? "?", slug: byId.get(w.productId)?.slug ?? "", people: w._count._all })).sort((a, b) => b.people - a.people).slice(0, 8),
    // looked at, added, rarely bought: price, photos, sizes or description may be in the way
    browsedNotBought: interest
      .map((i) => ({ r: byId.get(i.productId), views: i._sum.views ?? 0, adds: i._sum.adds ?? 0 }))
      .filter((x): x is { r: DemandRow; views: number; adds: number } => !!x.r && x.views >= 30)
      .map((x) => ({ product: x.r.name, slug: x.r.slug, views: x.views, adds: x.adds, sold: sold30(x.r), conversion: x.views ? sold30(x.r) / x.views : 0 }))
      .sort((a, b) => a.conversion - b.conversion || b.views - a.views)
      .slice(0, 8),
  };
}
