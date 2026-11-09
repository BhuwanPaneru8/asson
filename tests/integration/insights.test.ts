import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { deadStock, marginPct, reorderPlan, salesVelocity, searchInsights, sizeColourMix } from "@/lib/insights";
import { isPlainSearch, normaliseTerm, recordSearch } from "@/lib/search-stats";
import { getReorderSuggestions } from "@/actions/admin/purchasing";
import { parseFilters } from "@/components/catalog/parse";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";

const DAY = 86_400_000;
type P = Awaited<ReturnType<typeof makeProduct>>;

/** A past order for some variants (insights only read orders; stock is set by makeProduct). */
async function sold(p: P, lines: { size: string; qty: number }[], opts: { daysAgo: number; status?: "DELIVERED" | "CANCELLED"; discount?: number } = { daysAgo: 1 }) {
  const items = lines.map((l) => {
    const v = p.variants.find((x) => x.size === l.size)!;
    return { variantId: v.id, productId: p.id, name: p.name, slug: p.slug, sku: v.sku, color: v.color, size: v.size, image: "", unitPrice: p.price, quantity: l.qty, unitCost: v.costPrice };
  });
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const at = new Date(Date.now() - opts.daysAgo * DAY);
  await db.order.create({
    data: { email: "x@test.local", phone: "9841234567", status: opts.status ?? "DELIVERED", paymentMethod: "COD", subtotal, discount: opts.discount ?? 0, total: subtotal - (opts.discount ?? 0), shippingMethod: "standard", shippingAddress: {}, createdAt: at, items: { create: items } },
  });
}

describe("insights", () => {
  beforeEach(resetDb);

  it("sales speed leans on the last 30 days but is steadied by 90", () => {
    expect(salesVelocity(0, 0)).toBe(0);
    expect(salesVelocity(30, 30)).toBeCloseTo(0.6 + 0.4 / 3); // a burst this month
    expect(salesVelocity(0, 90)).toBeCloseTo(0.4); // sold earlier, not lately
  });

  it("reorders what runs out within lead time, sized by sales speed and what's already on order", async () => {
    const fast = await makeProduct({ name: "Fast Tee", cost: 400, stock: { M: 6, L: 200 } });
    for (let d = 1; d <= 28; d += 3) await sold(fast, [{ size: "M", qty: 3 }, { size: "L", qty: 1 }], { daysAgo: d }); // M: 30 in 30 days
    await sold(fast, [{ size: "M", qty: 50 }], { daysAgo: 2, status: "CANCELLED" }); // cancelled demand doesn't count
    const plan = await reorderPlan({ leadTimeDays: 14, coverDays: 45 });
    const m = plan.find((r) => r.size === "M")!;
    // 30 in 30 days and 30 in 90 → 0.6·1 + 0.4·(1/3) ≈ 0.733/day; 6 units last 8 days < 14 lead → order now
    expect(m).toMatchObject({ urgency: "now", stock: 6, sold30: 30, daysLeft: 8 });
    // ceil(0.733 × 59) = 44, + threshold 5 − 6 in stock = 43
    expect(m.suggested).toBe(43);
    expect(plan.find((r) => r.size === "L")).toBeUndefined(); // 200 units: years of cover

    // an open PO counts as coming
    const sup = await db.supplier.create({ data: { name: "Mill" } });
    await db.purchaseOrder.create({ data: { supplierId: sup.id, status: "ORDERED", createdById: "x", items: { create: { variantId: m.variantId, quantityOrdered: 10, unitCost: 40000 } } } });
    expect((await reorderPlan({ leadTimeDays: 14, coverDays: 45 })).find((r) => r.size === "M")).toMatchObject({ incoming: 10, suggested: 33, urgency: "soon", daysLeft: 21 }); // 16 units ≈ 21 days

    // purchasing shows the same rule (and needs the purchasing permission)
    actAs(await makeUser("MANAGER"));
    expect((await getReorderSuggestions()).map((s) => [s.sku, s.suggested])).toEqual([[m.sku, 33]]);
    actAs(await makeUser("STAFF"));
    await expect(getReorderSuggestions()).rejects.toThrow();
  });

  it("dead stock: in stock, in the range 90+ days, and not sold since", async () => {
    const p = await makeProduct({ cost: 500, stock: { S: 4, M: 3, L: 2 } });
    await db.variant.updateMany({ where: { productId: p.id }, data: { createdAt: new Date(Date.now() - 200 * DAY) } });
    await sold(p, [{ size: "S", qty: 1 }], { daysAgo: 120 }); // sold, but long ago
    await sold(p, [{ size: "M", qty: 1 }], { daysAgo: 10 }); // recent: not dead
    const d = await deadStock(90);
    expect(d.rows.map((r) => [r.size, r.stock, r.value, r.lastSold ? r.days : "never"])).toEqual([["S", 4, 200_000, 120], ["L", 2, 100_000, "never"]]);
    expect(d).toMatchObject({ units: 6, value: 300_000 });
    expect(d.rows[0].where).toEqual([{ code: "FLAGSHIP", quantity: 4 }]);
    // new arrivals aren't "dead" just because they haven't sold yet
    await makeProduct({ stock: { M: 5 } });
    expect((await deadStock(90)).rows).toHaveLength(2);
  });

  it("size & colour mix: units, sell-through, revenue after discounts and margin", async () => {
    const p = await makeProduct({ price: 1000, cost: 400, stock: { S: 10, M: 0, L: 30 } });
    await sold(p, [{ size: "M", qty: 10 }, { size: "S", qty: 10 }], { daysAgo: 5, discount: 200_000 }); // 10% off the order
    await sold(p, [{ size: "L", qty: 5 }], { daysAgo: 400 }); // outside the window
    const mix = await sizeColourMix({ days: 90 });
    expect(mix.sizes.map((s) => s.key)).toEqual(["S", "M", "L"]); // size order, not alphabetical
    const [s, m, l] = mix.sizes;
    expect(s).toMatchObject({ units: 10, stock: 10, sellThrough: 50, revenue: 900_000, share: 50 });
    expect(m).toMatchObject({ units: 10, stock: 0, sellThrough: 100 });
    expect(l).toMatchObject({ units: 0, stock: 30, sellThrough: 0 });
    expect(marginPct(s)).toBeCloseTo(((900_000 - 400_000) / 900_000) * 100, 0);
    expect(mix.colours).toMatchObject([{ key: "White", units: 20 }]);
  });

  it("search stats: plain searches only, grouped per day and term, with terms that still find nothing", async () => {
    expect(normaliseTerm("  Linen   SHIRT!! ")).toBe("linen shirt");
    expect(isPlainSearch({ q: "linen" })).toBe(true);
    expect(isPlainSearch({ q: "linen", sizes: ["M"] })).toBe(false);
    expect(isPlainSearch({ q: "linen", page: 2 })).toBe(false);
    // what the shop page really passes (the parser defaults searches to relevance order)
    expect(isPlainSearch(parseFilters({ q: "linen" }))).toBe(true);
    expect(isPlainSearch(parseFilters({ q: "linen", sort: "price-asc" }))).toBe(false);
    await recordSearch("Linen shirt", 4);
    await recordSearch("linen  SHIRT", 3);
    await recordSearch("daura suruwal", 0);
    await recordSearch("Daura Suruwal", 0);
    await recordSearch("kurta", 0);
    await recordSearch("kurta", 2); // now stocked
    await recordSearch("9841234567", 0); // phone-number-like input isn't stored
    const s = await searchInsights(30);
    expect(s).toMatchObject({ searches: 6, zeroResults: 3 });
    expect(s.top.find((t) => t.term === "linen shirt")).toEqual({ term: "linen shirt", searches: 2, zero: 0 });
    expect(s.top.map((t) => t.term)).toEqual(["daura suruwal", "kurta", "linen shirt"]); // ties: alphabetical
    expect(s.zero).toEqual([
      { term: "daura suruwal", searches: 2, zero: 2, stillZero: true },
      { term: "kurta", searches: 2, zero: 1, stillZero: false },
    ]);
  });
});
