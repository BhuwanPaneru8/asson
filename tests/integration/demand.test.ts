import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { demandPicture, demandRadar } from "@/lib/demand";
import { makeProduct, resetDb } from "../support/db";

type P = Awaited<ReturnType<typeof makeProduct>>;
const DAY = 86_400_000;
const TODAY = "2026-11-12"; // a Thursday

/** `qty` units of the product's first size, `weeksAgo` weeks before this week. */
async function sold(p: P, weeksAgo: number, qty: number, size = 0) {
  if (!qty) return;
  const v = p.variants[size];
  const at = new Date(Date.parse(`${TODAY}T06:00:00Z`) - (weeksAgo * 7 + 4) * DAY);
  await db.order.create({ data: { email: "x@test.local", phone: "9841234567", status: "DELIVERED", paymentMethod: "COD", subtotal: p.price * qty, total: p.price * qty, shippingMethod: "standard", shippingAddress: {}, createdAt: at,
    items: { create: [{ variantId: v.id, productId: p.id, name: p.name, slug: p.slug, sku: v.sku, color: v.color, size: v.size, image: "", unitPrice: p.price, quantity: qty }] } } });
}

describe("demand", () => {
  let hot: P, cooling: P, steady: P;
  beforeEach(async () => {
    await resetDb();
    hot = await makeProduct({ name: "Hot Hoodie", stock: { M: 10, L: 10 } });
    cooling = await makeProduct({ name: "Cooling Tee", stock: { M: 50 } });
    steady = await makeProduct({ name: "Steady Shirt", stock: { M: 200 } });
    for (let w = 12; w >= 1; w--) {
      await sold(hot, w, 13 - w); // 1 … 12 a week: rising
      await sold(cooling, w, w > 4 ? 10 : 4); // 10 a week, then 4
      await sold(steady, w, 5);
    }
    await sold(hot, 2, 6, 1); // L sells too, lately
  });

  it("forecasts each product, reads the trend, and plans stock and reorders by size", async () => {
    const { rows } = await demandPicture(TODAY);
    const by = (p: P) => rows.find((r) => r.productId === p.id)!;
    expect(by(hot).f.trend).toBe("rising");
    expect(by(cooling).f.trend).toBe("falling");
    expect(by(steady).f).toMatchObject({ trend: "steady", method: "holt" });
    expect(by(steady).f.total).toBeCloseTo(40, 0); // 5 a week for 8 weeks
    expect(by(steady).plan.daysLeft).toBe(280); // 200 units at 5 a week
    expect(by(hot).plan.urgent).toBe(true); // 20 in stock against ~12+ a week and a 14-day lead time
    expect(by(hot).plan.reorder).toBeGreaterThan(0);
    const sizes = by(hot).sizes;
    expect(sizes.map((s) => s.size)).toEqual(["M", "L"]);
    expect(sizes[0].share).toBeGreaterThan(sizes[1].share); // M sold more lately
    expect(sizes.reduce((s, x) => s + x.forecast, 0)).toBeCloseTo(by(hot).f.total, 0);
  });

  it("units on open purchase orders aren't ordered twice", async () => {
    const before = (await demandPicture(TODAY)).rows.find((r) => r.productId === hot.id)!.plan.reorder;
    const supplier = await db.supplier.create({ data: { name: "Mill" } });
    await db.purchaseOrder.create({ data: { supplierId: supplier.id, status: "ORDERED", createdById: "test", items: { create: [{ variantId: hot.variants[0].id, quantityOrdered: 30, unitCost: 100 }] } } });
    const after = (await demandPicture("2026-11-13")).rows.find((r) => r.productId === hot.id)!; // a new day: a fresh cache entry
    expect(after.onOrder).toBe(30);
    expect(after.plan.reorder).toBe(Math.max(0, before - 30));
  });

  it("the radar lists what's rising, falling and running out, and the demand we're not serving", async () => {
    await db.stockAlert.create({ data: { variantId: hot.variants[0].id, phone: "9800000001" } });
    await db.stockAlert.create({ data: { variantId: hot.variants[0].id, phone: "9800000002" } });
    await db.searchStat.create({ data: { day: "2026-11-10", term: "puffer jacket", searches: 9, zeroResults: 9, lastResults: 0 } });
    const r = await demandRadar(TODAY);
    expect(r.rising.map((x) => x.name)).toContain("Hot Hoodie");
    expect(r.falling.map((x) => x.name)).toContain("Cooling Tee");
    expect(r.runningOut[0].name).toBe("Hot Hoodie");
    expect(r.waiting[0]).toMatchObject({ product: "Hot Hoodie", size: "M", people: 2 });
    expect(r.searches[0]).toEqual({ term: "puffer jacket", times: 9 });
  });

  it("festival weeks lift the forecast (from the owner's public holidays)", async () => {
    const plain = (await demandPicture(TODAY)).rows.find((r) => r.productId === steady.id)!.f.total;
    await db.holiday.create({ data: { date: "2026-11-25", name: "Tihar (Laxmi Puja)" } });
    const festive = await demandPicture("2026-11-14"); // a fresh cache entry
    expect(festive.festivalAhead).toBe(true);
    expect(festive.rows.find((r) => r.productId === steady.id)!.f.total).toBeGreaterThan(plain);
  });
});
