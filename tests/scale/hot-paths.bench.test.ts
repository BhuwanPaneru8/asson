import { afterAll, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getFacets, getProduct, getProductRail, getRelated, listProducts, searchProductIds } from "@/lib/catalog";
import { allocateOrder } from "@/lib/stock";
import { getPickList, pickCounts } from "@/lib/picking";
import { stockAudit } from "@/lib/job-handlers";
import { cashierReport, networkAlerts, networkReport } from "@/lib/network";
import { deadStock, reorderPlan, sizeColourMix } from "@/lib/insights";
import { customerInsights } from "@/lib/customer-insights";
import { profitAndLoss, stockValuation } from "@/lib/finance";
import { replenishmentPlan } from "@/lib/replenishment";
import { openingAssortment } from "@/lib/rollout";

/**
 * Times every hot path against the national-scale dataset (tests/scale/load.ts) and fails if one goes over
 * its budget. Shoppers' paths must stay fast (they run on every page view); HQ reports can take longer.
 */
const SHOPPER = 300, CHECKOUT = 500, STAFF = 1500, REPORT = 5000; // ms, median of 3 runs
const results: [string, number, number][] = [];

async function time(label: string, budget: number, fn: () => Promise<unknown>) {
  const runs: number[] = [];
  for (let i = 0; i < 3; i++) { const t = performance.now(); await fn(); runs.push(performance.now() - t); }
  const median = runs.sort((a, b) => a - b)[1];
  results.push([label, Math.round(median), budget]);
  return median;
}

class Rollback extends Error {}

it("hot paths stay within budget at national scale", async () => {
  expect(await db.storeStock.count()).toBeGreaterThan(500_000); // the dataset is loaded

  // shoppers
  await time("catalogue: shop all, page 1", SHOPPER, () => listProducts({ sort: "featured" }));
  await time("catalogue: category + size filter", SHOPPER, () => listProducts({ category: "category-3", sizes: ["M"], sort: "new" }));
  await time("catalogue: filters panel", SHOPPER, () => getFacets({ category: "category-3" }));
  await time("search: 'linen shirt'", SHOPPER, () => searchProductIds("linen shirt"));
  await time("home: best sellers rail", SHOPPER, () => getProductRail("best", 8));
  await time("product page", SHOPPER, () => getProduct("product-42"));
  await time("product page: related", SHOPPER, () => getRelated("p42", "cat7", "WOMEN"));

  // checkout: take stock for a 2-line order across 82 locations, then roll back
  await time("checkout: allocate 2 lines", CHECKOUT, async () => {
    await db.$transaction(async (tx) => {
      const o = await tx.order.create({ data: { email: "b@scale.local", phone: "9800000000", paymentMethod: "COD", subtotal: 0, total: 0, shippingMethod: "standard", shippingAddress: {}, items: { create: [{ productId: "p10", variantId: "v10-1-1", name: "x", slug: "x", sku: "x", color: "Black", size: "S", image: "", unitPrice: 1, quantity: 1 }, { productId: "p11", variantId: "v11-2-2", name: "y", slug: "y", sku: "y", color: "White", size: "M", image: "", unitPrice: 1, quantity: 1 }] } }, include: { items: true } });
      await allocateOrder(tx, { orderId: o.id, toDistrict: "Kaski", lines: o.items.map((i) => ({ orderItemId: i.id, variantId: i.variantId!, quantity: 1, label: i.name })) });
      throw new Rollback();
    }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
  });

  // staff
  await time("warehouse pick list", STAFF, () => getPickList("wh0"));
  await time("pick counts (sidebar badge)", STAFF, () => pickCounts());

  // HQ and nightly
  await time("network: by location, 30 days", REPORT, () => networkReport({ days: 30, scope: { all: true }, group: "location" }));
  await time("network: by province, 90 days", REPORT, () => networkReport({ days: 90, scope: { all: true }, group: "province" }));
  await time("network: till league", REPORT, () => cashierReport({ days: 30, scope: { all: true } }));
  await time("network: alerts", REPORT, () => networkAlerts({ all: true }));
  await time("insights: reorder plan", REPORT, () => reorderPlan());
  await time("insights: dead stock", REPORT, () => deadStock());
  await time("insights: size/colour mix", REPORT, () => sizeColourMix({ days: 90 }));
  await time("insights: customers", REPORT, () => customerInsights());
  await time("finance: month P&L", REPORT, () => { const end = new Date(); const start = new Date(end.getTime() - 30 * 86_400_000); return profitAndLoss(start, end, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)); });
  await time("finance: stock valuation", REPORT, () => stockValuation());
  await time("replenishment plan (all shops)", REPORT, () => replenishmentPlan());
  await time("rollout: best-seller starter", REPORT, () => openingAssortment(db, "wh0", { mode: "bestsellers", products: 200, perSize: 2 }));
  await time("nightly: stock audit", REPORT, () => stockAudit());

  const over = results.filter(([, ms, budget]) => ms > budget);
  expect(over.map(([l, ms, b]) => `${l}: ${ms}ms > ${b}ms`)).toEqual([]);
});

afterAll(async () => {
  console.log("\n" + results.map(([l, ms, b]) => `${ms > b ? "✗" : "✓"} ${String(ms).padStart(6)} ms  (budget ${b})  ${l}`).join("\n"));
  await db.$disconnect();
});
