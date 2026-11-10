import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { budgetReport, monthProgress, saveBudgets, shiftMonth, suggestBudgets, targetProgress } from "@/lib/budgets";
import { scorecard } from "@/lib/scorecard";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

type Loc = Awaited<ReturnType<typeof makeLocation>>;
type P = Awaited<ReturnType<typeof makeProduct>>;
const at = (d: string) => new Date(`${d}T12:00:00+05:45`);

async function sale(p: P, store: Loc, qty: number, on: string) {
  const subtotal = p.price * qty;
  const o = await db.order.create({
    data: { email: "x@test.local", phone: "9800000000", status: "DELIVERED", paymentMethod: "COD", subtotal, total: subtotal, shippingMethod: "standard", shippingAddress: {}, createdAt: at(on),
      items: { create: { variantId: p.variants[0].id, productId: p.id, name: p.name, slug: p.slug, sku: p.variants[0].sku, color: "White", size: "M", image: "", unitPrice: p.price, quantity: qty, unitCost: 40_000 } } },
    include: { items: true },
  });
  await db.orderAllocation.create({ data: { orderId: o.id, orderItemId: o.items[0].id, variantId: p.variants[0].id, storeId: store.id, quantity: qty } });
}

describe("shop budgets", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>, ktm: Loc, pkr: Loc, p: P;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN");
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    p = await makeProduct({ price: 1000, at: ktm.id });
  });

  it("months and progress", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", -12)).toBe("2025-11");
    expect(monthProgress("2026-11", at("2026-10-20"))).toBe(0);
    expect(monthProgress("2026-11", new Date("2026-11-15T18:15:00Z"))).toBeCloseTo(0.5, 2); // 16 Nov 00:00 Nepal = halfway through 30 days
    expect(monthProgress("2026-10", at("2026-11-02"))).toBe(1);
  });

  it("saves a plan for many shops (and replaces it), refuses bad numbers", async () => {
    await expect(db.$transaction((tx) => saveBudgets(tx, owner, "2026-13", []))).rejects.toThrow(/YYYY-MM/);
    await expect(db.$transaction((tx) => saveBudgets(tx, owner, "2026-11", [{ storeId: ktm.id, sales: -1, marginPm: null, costs: 0 }]))).rejects.toThrow(/negative/);
    await expect(db.$transaction((tx) => saveBudgets(tx, owner, "2026-11", [{ storeId: ktm.id, sales: 1, marginPm: 1200, costs: 0 }]))).rejects.toThrow(/0–100%/);
    await expect(db.$transaction((tx) => saveBudgets(tx, owner, "2026-11", [{ storeId: ktm.id, sales: 1, marginPm: null, costs: 0 }, { storeId: ktm.id, sales: 2, marginPm: null, costs: 0 }]))).rejects.toThrow(/once/);
    await db.$transaction((tx) => saveBudgets(tx, owner, "2026-11", [{ storeId: ktm.id, sales: 500_000, marginPm: 550, costs: 100_000 }, { storeId: pkr.id, sales: 300_000, marginPm: null, costs: 50_000 }]));
    await db.$transaction((tx) => saveBudgets(tx, owner, "2026-11", [{ storeId: ktm.id, sales: 600_000, marginPm: 500, costs: 100_000 }]));
    expect((await db.shopBudget.findMany({ orderBy: { sales: "desc" } })).map((b) => [b.storeId, b.sales])).toEqual([[ktm.id, 600_000], [pkr.id, 300_000]]);
    // two saves at once never duplicate a row
    await Promise.all([1, 2].map((i) => db.$transaction((tx) => saveBudgets(tx, owner, "2026-12", [{ storeId: ktm.id, sales: i, marginPm: null, costs: 0 }]))));
    expect(await db.shopBudget.count({ where: { month: "2026-12" } })).toBe(1);
  });

  it("suggests from the same month last year plus an uplift", async () => {
    await sale(p, ktm, 10, "2025-11-10");
    await db.expense.create({ data: { date: "2025-11-01", category: "RENT", amount: 2_000_000, storeId: ktm.id, description: "rent", createdById: owner.id } });
    const s = await suggestBudgets("2026-11", "lastYear", 10);
    expect(s.base).toBe("2025-11");
    expect(s.rows.find((r) => r.storeId === ktm.id)).toMatchObject({ basis: 1_000_000, sales: 1_100_000, marginPm: 600, costs: 2_000_000 });
  });

  it("plan vs actual: achieved, pace and forecast mid-month, costs and profit against plan", async () => {
    await db.$transaction((tx) => saveBudgets(tx, owner, "2026-11", [{ storeId: ktm.id, sales: 2_000_000, marginPm: 600, costs: 500_000 }, { storeId: pkr.id, sales: 2_000_000, marginPm: null, costs: 0 }]));
    await sale(p, ktm, 12, "2026-11-05"); // Rs 12,000 by mid-month: on course for 24,000 vs 20,000
    await sale(p, pkr, 4, "2026-11-06"); // Rs 4,000: heading for 8,000 vs 20,000
    await db.expense.create({ data: { date: "2026-11-01", category: "RENT", amount: 600_000, storeId: ktm.id, description: "rent", createdById: owner.id } });
    const mid = new Date("2026-11-15T18:15:00Z");
    const r = await budgetReport("2026-11", { now: mid });
    const k = r.rows.find((x) => x.storeId === ktm.id)!, pk = r.rows.find((x) => x.storeId === pkr.id)!;
    expect(k).toMatchObject({ netSales: 1_200_000, target: 2_000_000, achieved: 60, expectedByNow: 1_000_000, forecast: 2_400_000, pace: "ahead", marginTarget: 60, costBudget: 500_000, costVariance: -100_000 });
    expect(k.profitPlan).toBe(2_000_000 * 0.6 - 500_000);
    expect(k.profitVariance).toBe(k.profit - k.profitPlan!);
    expect(pk).toMatchObject({ achieved: 20, forecast: 800_000, pace: "behind", profitPlan: null });
    expect(r.total).toMatchObject({ target: 4_000_000, actual: 1_600_000, behind: 1 });

    expect(await targetProgress(ktm.id, mid, "2026-11")).toMatchObject({ target: 2_000_000, actual: 1_200_000, achieved: 60, pace: "ahead" });
    expect(await targetProgress(ktm.id, mid, "2026-12")).toBeNull(); // no plan
    expect((await budgetReport("2026-11", { now: mid, storeIds: [pkr.id] })).rows.map((x) => x.name)).toEqual(["Pokhara shop"]);
    // the scorecard shows the same progress and flags the shop that's behind
    const sc = await scorecard({ scope: { all: true }, now: mid });
    expect(sc.find((x) => x.storeId === ktm.id)).toMatchObject({ targetPct: 60, targetPace: "ahead" });
    expect(sc.find((x) => x.storeId === pkr.id)!.flags).toContain("behind this month's sales target (20%)");
  });
});
