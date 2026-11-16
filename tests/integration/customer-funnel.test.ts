import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { customerInsights, funnelInsights, segmentOf } from "@/lib/customer-insights";
import { isBot, recordFunnel } from "@/lib/funnel";
import { makeProduct, makeUser, resetDb } from "../support/db";

const DAY = 86_400_000;
const NOW = new Date("2026-11-15T06:00:00Z");

async function order(o: { daysAgo: number; total: number; shipping?: number; userId?: string; phone?: string; channel?: "ONLINE" | "STORE"; status?: "DELIVERED" | "CANCELLED" | "RETURNED"; name?: string; /** counted from this time instead of NOW */ from?: Date }) {
  return db.order.create({
    data: {
      email: "x@test.local", phone: o.phone ?? "", userId: o.userId, status: o.status ?? "DELIVERED", paymentMethod: "COD", channel: o.channel ?? "ONLINE",
      subtotal: o.total - (o.shipping ?? 0), shippingFee: o.shipping ?? 0, total: o.total, shippingMethod: "standard", shippingAddress: { fullName: o.name ?? "Guest" },
      createdAt: new Date((o.from ?? NOW).getTime() - o.daysAgo * DAY),
    },
  });
}

describe("customer insights", () => {
  beforeEach(resetDb);

  it("segments by how recently and how often people buy", () => {
    expect(segmentOf(3, 10)).toBe("champion");
    expect(segmentOf(2, 100)).toBe("loyal");
    expect(segmentOf(5, 200)).toBe("at_risk");
    expect(segmentOf(1, 20)).toBe("new");
    expect(segmentOf(1, 90)).toBe("one_time");
    expect(segmentOf(9, 400)).toBe("lost");
  });

  it("repeat rate, lifetime value, segments and masked top customers; ignores cancelled orders and anonymous walk-ins", async () => {
    const aarav = await makeUser("CUSTOMER", { name: "Aarav Shrestha" });
    for (const d of [5, 35, 70]) await order({ daysAgo: d, total: 210_000, shipping: 10_000, userId: aarav.id });
    await order({ daysAgo: 1, total: 999_000, userId: aarav.id, status: "CANCELLED" });
    await order({ daysAgo: 200, total: 100_000, phone: "9841234567", name: "Sita Rai" });
    await order({ daysAgo: 230, total: 100_000, phone: "+977-984-1234567", channel: "STORE", name: "Walk-in customer" }); // same person at the till, earlier
    await order({ daysAgo: 10, total: 50_000, phone: "9812345678" });
    await order({ daysAgo: 3, total: 70_000, channel: "STORE" }); // walk-in, no phone: can't be followed

    const c = await customerInsights(NOW);
    expect(c.customers).toBe(3);
    expect(c.repeatRate).toBeCloseTo(66.7, 1);
    expect(c.ordersPerCustomer).toBe(2);
    expect(c.lifetimeValue).toBe(Math.round((600_000 + 200_000 + 50_000) / 3)); // goods value, delivery excluded
    expect(c.omnichannel).toBe(1);
    expect(Object.fromEntries(c.segments.map((s) => [s.key, s.customers]))).toMatchObject({ champion: 1, at_risk: 1, new: 1, loyal: 0, lost: 0 });
    expect(c.top[0]).toMatchObject({ name: "Aarav Shrestha", orders: 3, revenue: 600_000 });
    expect(c.top.find((t) => t.name === "Sita Rai")!.phone).toBe("98••••4567"); // never the full number
  });

  it("cohorts: share of a month's new customers who bought again k months later", async () => {
    // two customers start in September 2026; one comes back in October, none in November
    await order({ daysAgo: 70, total: 100_000, phone: "9800000001" }); // 2026-09-06
    await order({ daysAgo: 66, total: 100_000, phone: "9800000002" }); // 2026-09-10
    await order({ daysAgo: 40, total: 100_000, phone: "9800000001" }); // 2026-10-06
    const sep = (await customerInsights(NOW)).cohorts.find((r) => r.month === "2026-09")!;
    expect(sep).toEqual({ month: "2026-09", size: 2, retention: [50, 0, null, null, null, null] });
  });
});

describe("shop funnel", () => {
  beforeEach(resetDb);

  it("knows bots from shoppers", () => {
    expect(isBot("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36")).toBe(false);
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("WhatsApp/2.24")).toBe(true);
    expect(isBot(null)).toBe(true);
  });

  it("counts steps per day and per product, flags well-viewed products few people bag", async () => {
    const a = await makeProduct({ name: "Linen Shirt" });
    const b = await makeProduct({ name: "Wool Coat" });
    for (let i = 0; i < 60; i++) await recordFunnel("view", a.id);
    for (let i = 0; i < 12; i++) await recordFunnel("add", a.id);
    for (let i = 0; i < 60; i++) await recordFunnel("view", b.id);
    await recordFunnel("add", b.id); // 1 in 60: weak
    for (let i = 0; i < 6; i++) await recordFunnel("checkout");
    // the funnel counts on the real clock (recordFunnel stamps today), so these orders do too
    const today = new Date();
    await order({ daysAgo: 0, total: 100_000, phone: "9800000009", from: today });
    const f = await funnelInsights(30, today);
    expect(f).toMatchObject({ views: 120, adds: 13, checkouts: 6, orders: 1 });
    // orders from before counting began aren't compared with views
    await order({ daysAgo: 20, total: 100_000, phone: "9800000010", from: today });
    expect((await funnelInsights(30, today)).orders).toBe(1);
    expect(f.rates).toMatchObject({ viewToAdd: 10.8, addToCheckout: 46.2, checkoutToOrder: 16.7 });
    expect(f.products.map((p) => [p.name, p.addRate, p.weak])).toEqual(expect.arrayContaining([["Linen Shirt", 20, false], ["Wool Coat", 1.7, true]]));
    expect(await db.productStat.count()).toBe(2); // one row per product per day, not per view
  });
});
