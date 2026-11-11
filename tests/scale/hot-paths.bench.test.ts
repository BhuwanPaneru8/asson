import { afterAll, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getFacets, getProduct, getProductRail, getRelated, listProducts, searchProductIds } from "@/lib/catalog";
import { allocateOrder } from "@/lib/stock";
import { getPickList, pickCounts } from "@/lib/picking";
import { stockAudit } from "@/lib/job-handlers";
import { cashierReport, networkAlerts, networkReport } from "@/lib/network";
import { scorecard } from "@/lib/scorecard";
import { shopPl } from "@/lib/shop-pl";
import { budgetReport, targetProgress } from "@/lib/budgets";
import { cashPosition } from "@/lib/cash";
import { importStatement, reconciliation } from "@/lib/bank-statements";
import { closeChecklist } from "@/lib/month-close";
import { computeVat } from "@/lib/vat";
import { yearPack } from "@/lib/fiscal-year";
import { binOverview } from "@/lib/bins";
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
  {
    // the busiest warehouse gets a bin for every size it stocks (scratch DB): ~36k bins and assignments
    const [w] = await db.$queryRaw<{ id: string }[]>`SELECT s."id" FROM "Store" s JOIN "StoreStock" ss ON ss."storeId" = s."id" WHERE s."kind" = 'WAREHOUSE' GROUP BY s."id" ORDER BY COUNT(*) DESC LIMIT 1`;
    if (!(await db.binAssignment.count({ where: { storeId: w.id } }))) {
      await db.$executeRawUnsafe(`INSERT INTO "Bin" ("id", "storeId", "code", "sortKey", "zone") SELECT 'bn_' || ss."variantId", ss."storeId", 'Z-' || row_number() OVER (), 'Z-' || lpad((row_number() OVER ())::text, 6, '0'), 'Z' FROM "StoreStock" ss WHERE ss."storeId" = '${w.id}' ON CONFLICT DO NOTHING`);
      await db.$executeRawUnsafe(`INSERT INTO "BinAssignment" ("storeId", "variantId", "binId", "assignedById", "updatedAt") SELECT ss."storeId", ss."variantId", 'bn_' || ss."variantId", 'scale-bench', NOW() FROM "StoreStock" ss WHERE ss."storeId" = '${w.id}' AND ss."variantId" NOT IN (SELECT "variantId" FROM "StoreStock" WHERE "storeId" = '${w.id}' ORDER BY "variantId" LIMIT 500) ON CONFLICT DO NOTHING`);
    }
    await time("bins: overview of the busiest warehouse", REPORT, () => binOverview(w.id));
  }
  await time("warehouse pick list", STAFF, () => getPickList("wh0"));
  await time("pick counts (sidebar badge)", STAFF, () => pickCounts());

  // HQ and nightly
  await time("network: by location, 30 days", REPORT, () => networkReport({ days: 30, scope: { all: true }, group: "location" }));
  await time("finance: profit by shop, last full month", REPORT, () => shopPl(new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 7)));
  await time("finance: budgets vs actual, this month", REPORT, () => budgetReport(new Date().toISOString().slice(0, 7)));
  {
    // the busiest shop gets a plan for this month (scratch DB), so the real query is timed
    const [busy] = await db.$queryRaw<{ storeId: string }[]>`SELECT a."storeId" FROM "OrderAllocation" a JOIN "Store" s ON s."id" = a."storeId" WHERE s."kind" = 'SHOP' GROUP BY a."storeId" ORDER BY COUNT(*) DESC LIMIT 1`;
    const month = new Date().toISOString().slice(0, 7);
    await db.shopBudget.upsert({ where: { storeId_month: { storeId: busy.storeId, month } }, create: { storeId: busy.storeId, month, sales: 500_000_00, costs: 0, updatedById: "scale-bench" }, update: {} });
    await time("today: busiest shop's target progress", 300, async () => { if (!(await targetProgress(busy.storeId))) throw new Error("no plan"); });
  }
  {
    // two years of cash book per location (scratch DB): ~2,000 entries and ~240 deposits each, one open shift
    if (!(await db.cashEntry.count())) {
      await db.$executeRawUnsafe(`INSERT INTO "CashEntry" ("id", "storeId", "kind", "amount", "note", "byId", "byName", "createdAt")
        SELECT 'ce_' || s."id" || '_' || g, s."id", (CASE WHEN g % 3 = 0 THEN 'DEPOSIT' WHEN g % 3 = 1 THEN 'SHIFT_IN' ELSE 'FLOAT_OUT' END)::"CashKind",
          CASE WHEN g % 3 = 0 THEN -2500000 WHEN g % 3 = 1 THEN 3000000 ELSE -500000 END, '', 'bench', 'Bench', NOW() - (g || ' hours')::interval * 8
        FROM "Store" s CROSS JOIN generate_series(1, 2000) g`);
      await db.$executeRawUnsafe(`INSERT INTO "BankDeposit" ("id", "storeId", "amount", "bank", "slipNo", "depositedOn", "status", "byId", "byName", "checkedAt")
        SELECT 'bd_' || s."id" || '_' || g, s."id", 2500000, 'Bench Bank', s."id" || '-' || g, to_char(NOW() - (g * 3 || ' days')::interval, 'YYYY-MM-DD'),
          (CASE WHEN g > 2 THEN 'VERIFIED' ELSE 'RECORDED' END)::"DepositStatus", 'bench', 'Bench', CASE WHEN g > 2 THEN NOW() END
        FROM "Store" s CROSS JOIN generate_series(1, 240) g`);
    }
    if (!(await db.shift.count({ where: { status: "OPEN" } }))) await db.$executeRawUnsafe(`INSERT INTO "Shift" ("id", "storeId", "cashierId", "status", "openingFloat") SELECT 'sh_' || s."id", s."id", 'bench', 'OPEN', 500000 FROM "Store" s`);
    await time("cash: position of every location", REPORT, () => cashPosition({ all: true }));
    // a month's statement of 3,000 credits against ~20k recorded/verified deposits (a fresh account name each run)
    const acct = `Bench Bank ${Date.now()}`;
    const lines = Array.from({ length: 3000 }, (_, i) => ({ date: new Date(Date.now() - (i % 30) * 86_400_000).toISOString().slice(0, 10), amount: 2_500_000 + (i % 7), description: `CASH DEP ${i}`, reference: "", row: i + 2 }));
    const finance = { id: "bench-finance", name: "Bench", role: "ADMIN" };
    await time("bank: import and match a 3,000-line statement", REPORT, () => db.$transaction((tx) => importStatement(tx, finance, acct, lines), { timeout: 60_000 }));
    await time("bank: reconciliation view", REPORT, () => reconciliation());
    await time("finance: VAT return for a month (sales, returns, purchases)", REPORT, () => { const to = new Date(Date.now() - 86_400_000); const from = new Date(to.getTime() - 29 * 86_400_000); return computeVat(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)); });
    {
      // the year to date as a fiscal year (scratch DB): P&L by month for 12+ months, VAT, TDS, balances
      const ad = new Date().getUTCFullYear() - 1;
      const label = `${ad + 57}/${String((ad + 58) % 100).padStart(2, "0")}`;
      await db.fiscalYearClose.upsert({ where: { label }, create: { label, from: `${ad}-07-17`, to: `${ad + 1}-07-16`, createdById: "scale-bench" }, update: {} });
      await time("finance: fiscal-year pack (13 months of P&L)", REPORT, () => yearPack(label));
    }
    await time("finance: month-end close checklist (last full month)", REPORT, () => closeChecklist(new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 7)));
  }
  await time("shop scorecard: every shop, 30 days", REPORT, () => scorecard({ scope: { all: true }, days: 30 }));
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
