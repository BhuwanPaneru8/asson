import "server-only";
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

export async function customerInsights(now = new Date()) {
  const orders = await db.order.findMany({
    where: { status: { notIn: ["CANCELLED", "RETURNED"] } },
    select: { createdAt: true, total: true, shippingFee: true, userId: true, phone: true, channel: true, shippingAddress: true, user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 200_000,
  });
  type C = { key: string; name: string; phone: string; first: Date; last: Date; orders: number; revenue: number; months: Set<string>; firstMonth: string; channels: Set<string> };
  const customers = new Map<string, C>();
  for (const o of orders) {
    const phone = o.phone.replace(/\D/g, "").slice(-10);
    const key = o.userId ?? (phone.length === 10 ? `p:${phone}` : null);
    if (!key) continue;
    const c = customers.get(key) ?? { key, name: "", phone, first: o.createdAt, last: o.createdAt, orders: 0, revenue: 0, months: new Set<string>(), firstMonth: month(o.createdAt), channels: new Set<string>() };
    // the latest real name wins (till sales are recorded as "Walk-in customer")
    const name = o.user?.name || (o.shippingAddress as { fullName?: string } | null)?.fullName || "";
    if (name && name !== "Walk-in customer") c.name = name;
    c.orders++;
    c.revenue += o.total - o.shippingFee;
    c.last = o.createdAt;
    c.months.add(month(o.createdAt));
    c.channels.add(o.channel);
    customers.set(key, c);
  }
  const all = [...customers.values()];
  const repeaters = all.filter((c) => c.orders >= 2);
  const gaps = repeaters.map((c) => (c.last.getTime() - c.first.getTime()) / DAY / (c.orders - 1));

  // cohorts: customers by first-order month (last 12), and the share who ordered again in each later month
  const thisMonth = month(now);
  const cohortMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${thisMonth}-15T12:00:00+05:45`);
    d.setMonth(d.getMonth() - (11 - i));
    return month(d);
  });
  const cohorts = cohortMonths.map((m) => {
    const members = all.filter((c) => c.firstMonth === m);
    const maxOffset = monthsBetween(m, thisMonth);
    return {
      month: m,
      size: members.length,
      // offset k = still buying k months after their first month (null = that month hasn't happened yet)
      retention: [1, 2, 3, 4, 5, 6].map((k) => (k > maxOffset || !members.length ? null : Math.round((members.filter((c) => [...c.months].some((x) => monthsBetween(m, x) === k)).length / members.length) * 1000) / 10)),
    };
  });

  const bySegment = new Map<Segment, { customers: number; revenue: number }>();
  for (const c of all) {
    const s = segmentOf(c.orders, Math.floor((now.getTime() - c.last.getTime()) / DAY));
    const row = bySegment.get(s) ?? { customers: 0, revenue: 0 };
    row.customers++; row.revenue += c.revenue;
    bySegment.set(s, row);
  }
  const revenue = all.reduce((s, c) => s + c.revenue, 0);
  const repeatRevenue = repeaters.reduce((s, c) => s + c.revenue, 0);

  return {
    customers: all.length,
    repeatRate: all.length ? Math.round((repeaters.length / all.length) * 1000) / 10 : 0,
    repeatRevenueShare: revenue ? Math.round((repeatRevenue / revenue) * 1000) / 10 : 0,
    ordersPerCustomer: all.length ? Math.round((all.reduce((s, c) => s + c.orders, 0) / all.length) * 100) / 100 : 0,
    lifetimeValue: all.length ? Math.round(revenue / all.length) : 0,
    daysBetweenOrders: gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null,
    omnichannel: all.filter((c) => c.channels.size > 1).length,
    segments: SEGMENTS.map((s) => ({ ...s, customers: bySegment.get(s.key)?.customers ?? 0, revenue: bySegment.get(s.key)?.revenue ?? 0 })),
    cohorts,
    top: all.sort((a, b) => b.revenue - a.revenue).slice(0, 15).map((c) => ({ name: c.name || "Customer", phone: maskPhone(c.phone), orders: c.orders, revenue: c.revenue, last: c.last, segment: segmentOf(c.orders, Math.floor((now.getTime() - c.last.getTime()) / DAY)) })),
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
