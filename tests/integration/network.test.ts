import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cashierReport, networkAlerts, networkReport } from "@/lib/network";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

const DAY = 86_400_000;
type Loc = Awaited<ReturnType<typeof makeLocation>>;
type P = Awaited<ReturnType<typeof makeProduct>>;

/** An order whose units came from the given locations (sales are credited by allocation). */
async function sale(p: P, from: { at: Loc; qty: number }[], o: { daysAgo: number; discount?: number; status?: "DELIVERED" | "CANCELLED"; channel?: "ONLINE" | "STORE"; cashierId?: string; shiftId?: string }) {
  const qty = from.reduce((s, f) => s + f.qty, 0);
  const subtotal = p.price * qty;
  const order = await db.order.create({
    data: {
      email: "x@test.local", phone: "9800000000", status: o.status ?? "DELIVERED", paymentMethod: o.channel === "STORE" ? "IN_STORE" : "COD", channel: o.channel ?? "ONLINE",
      subtotal, discount: o.discount ?? 0, total: subtotal - (o.discount ?? 0), shippingMethod: "standard", shippingAddress: {}, cashierId: o.cashierId, shiftId: o.shiftId,
      createdAt: new Date(Date.now() - o.daysAgo * DAY),
      items: { create: { variantId: p.variants[0].id, productId: p.id, name: p.name, slug: p.slug, sku: p.variants[0].sku, color: "White", size: "M", image: "", unitPrice: p.price, quantity: qty, unitCost: 40_000 } },
    },
    include: { items: true },
  });
  for (const f of from) await db.orderAllocation.create({ data: { orderId: order.id, orderItemId: order.items[0].id, variantId: p.variants[0].id, storeId: f.at.id, quantity: f.qty } });
  return order;
}

describe("HQ network dashboard", () => {
  let wh: Loc, ktm: Loc, pkr: Loc, p: P;
  beforeEach(async () => {
    await resetDb();
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    for (const [l, d] of [[wh, "Kathmandu"], [ktm, "Lalitpur"], [pkr, "Kaski"]] as const) await db.store.update({ where: { id: l.id }, data: { district: d } });
    p = await makeProduct({ price: 1000, stock: { M: 30 }, at: pkr.id });
  });

  it("credits revenue to where the goods came from, after discounts, with growth vs the previous period", async () => {
    await sale(p, [{ at: pkr, qty: 2 }], { daysAgo: 3 }); // Rs 2,000
    await sale(p, [{ at: wh, qty: 1 }, { at: ktm, qty: 1 }], { daysAgo: 5, discount: 20_000 }); // Rs 1,800 split 900/900
    await sale(p, [{ at: pkr, qty: 5 }], { daysAgo: 4, status: "CANCELLED" }); // not a sale
    await sale(p, [{ at: pkr, qty: 1 }], { daysAgo: 40 }); // previous 30 days: Rs 1,000
    const r = await networkReport({ days: 30, scope: { all: true }, group: "location" });
    expect(r.rows.map((x) => [x.label, x.revenue, x.units, x.orders])).toEqual([["Pokhara shop", 200_000, 2, 1], ["Warehouse", 90_000, 1, 1], ["Kathmandu shop", 90_000, 1, 1]]);
    expect(r.rows[0]).toMatchObject({ previous: 100_000, growth: 100, margin: 60, stockUnits: 30, coverDays: 450, sellThrough: 6.3 });
    expect(r.total).toMatchObject({ revenue: 380_000, units: 4, locations: 3 });
  });

  it("rolls up by province, and scoped managers see only their locations", async () => {
    await sale(p, [{ at: wh, qty: 1 }], { daysAgo: 2 });
    await sale(p, [{ at: ktm, qty: 2 }], { daysAgo: 2 });
    await sale(p, [{ at: pkr, qty: 1 }], { daysAgo: 2 });
    const byProvince = await networkReport({ days: 30, scope: { all: true }, group: "province" });
    expect(byProvince.rows.map((x) => [x.label, x.revenue, x.locations])).toEqual([["Bagmati", 300_000, 2], ["Gandaki", 100_000, 1]]);
    const mine = await networkReport({ days: 30, scope: { all: false, storeIds: [pkr.id] }, group: "location" });
    expect(mine.rows.map((x) => x.label)).toEqual(["Pokhara shop"]);
    expect(mine.total.revenue).toBe(100_000);
  });

  it("till league: sales, revenue, basket and discount rate per cashier", async () => {
    const ram = await makeUser("CASHIER", { name: "Ram" });
    const shift = await db.shift.create({ data: { storeId: ktm.id, cashierId: ram.id, openingFloat: 0 } });
    await sale(p, [{ at: ktm, qty: 2 }], { daysAgo: 1, channel: "STORE", cashierId: ram.id, shiftId: shift.id, discount: 10_000 });
    await sale(p, [{ at: ktm, qty: 1 }], { daysAgo: 1, channel: "STORE", cashierId: ram.id, shiftId: shift.id });
    expect(await cashierReport({ days: 7, scope: { all: true } })).toEqual([{ name: "Ram", sales: 2, revenue: 290_000, basket: 145_000, discountPct: 3.3 }]);
    expect(await cashierReport({ days: 7, scope: { all: false, storeIds: [pkr.id] } })).toEqual([]);
  });

  it("raises the things HQ should chase", async () => {
    await db.store.updateMany({ data: { createdAt: new Date(Date.now() - 30 * DAY) } });
    await sale(p, [{ at: ktm, qty: 1 }], { daysAgo: 1 }); // Kathmandu is selling; Pokhara is quiet
    await db.orderAllocation.updateMany({ data: { createdAt: new Date(Date.now() - DAY) } });
    await db.stockTransfer.create({ data: { fromId: wh.id, toId: pkr.id, status: "SENT", sentAt: new Date(Date.now() - 6 * DAY), createdById: "x", items: { create: { variantId: p.variants[0].id, quantity: 2 } } } });
    await db.stockCount.create({ data: { storeId: ktm.id, scopeLabel: "Whole location", status: "SUBMITTED", submittedAt: new Date(Date.now() - 3 * DAY), createdById: "x" } });
    const cashier = await makeUser("CASHIER");
    await db.shift.create({ data: { storeId: ktm.id, cashierId: cashier.id, openingFloat: 0, status: "CLOSED", openedAt: new Date(Date.now() - 2 * DAY), closedAt: new Date(Date.now() - 2 * DAY), difference: -80_000 } });
    const texts = (await networkAlerts({ all: true })).map((a) => a.text);
    expect(texts[0]).toMatch(/Kathmandu shop: cash short Rs\. 800 this week/); // most serious first
    expect(texts).toEqual(expect.arrayContaining([
      "Pokhara shop: no sales in 3 days",
      expect.stringMatching(/TR-\d+ Warehouse → Pokhara shop in transit for 5\+ days/),
      expect.stringMatching(/SC-\d+ at Kathmandu shop waiting for approval/),
      expect.stringMatching(/Kathmandu shop: 1 day not closed/),
    ]));
    expect(texts.some((t) => t.startsWith("Kathmandu shop: no sales"))).toBe(false);
    expect((await networkAlerts({ all: false, storeIds: [pkr.id] })).map((a) => a.text)).toEqual(["Pokhara shop: no sales in 3 days", expect.stringMatching(/in transit/)]);
  });
});
