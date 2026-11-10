import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { postRecurring, saveRecurringCost, shopPl } from "@/lib/shop-pl";
import { approveRun, buildRun, confirmTaxYear, markPaid, saveEmployment, saveTaxYear } from "@/lib/payroll";
import { TEMPLATE_2082 } from "@/lib/payroll-rules";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

type Loc = Awaited<ReturnType<typeof makeLocation>>;
type P = Awaited<ReturnType<typeof makeProduct>>;
type U = Awaited<ReturnType<typeof makeUser>>;
const at = (d: string) => new Date(`${d}T12:00:00+05:45`);
const rs = (n: number) => n * 100;

async function sale(p: P, from: { at: Loc; qty: number }[], o: { on: string; discount?: number; shipping?: number; status?: "DELIVERED" | "CANCELLED" | "RETURNED"; updatedOn?: string; noAllocation?: boolean }) {
  const qty = from.reduce((s, f) => s + f.qty, 0);
  const subtotal = p.price * qty;
  const order = await db.order.create({
    data: {
      email: "x@test.local", phone: "9800000000", status: o.status ?? "DELIVERED", paymentMethod: "COD", channel: "ONLINE",
      subtotal, discount: o.discount ?? 0, shippingFee: o.shipping ?? 0, total: subtotal - (o.discount ?? 0) + (o.shipping ?? 0), shippingMethod: "standard", shippingAddress: {},
      createdAt: at(o.on), updatedAt: at(o.updatedOn ?? o.on),
      items: { create: { variantId: p.variants[0].id, productId: p.id, name: p.name, slug: p.slug, sku: p.variants[0].sku, color: "White", size: "M", image: "", unitPrice: p.price, quantity: qty, unitCost: rs(400) } },
    },
    include: { items: true },
  });
  if (!o.noAllocation) for (const f of from) await db.orderAllocation.create({ data: { orderId: order.id, orderItemId: order.items[0].id, variantId: p.variants[0].id, storeId: f.at.id, quantity: f.qty } });
  return order;
}

describe("shop profit and loss", () => {
  let owner: U, ktm: Loc, pkr: Loc, wh: Loc, p: P;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    p = await makeProduct({ price: 1000, at: wh.id }); // price in rupees (the helper stores paisa)
  });

  it("splits sales, cost, refunds and costs by location, and adds up to the company P&L exactly", async () => {
    // Kathmandu 3 units, Pokhara 1, one order split across both, a 10% discount, delivery fee
    await sale(p, [{ at: ktm, qty: 3 }], { on: "2026-11-05" });
    await sale(p, [{ at: pkr, qty: 1 }], { on: "2026-11-06", shipping: rs(150) });
    const split = await sale(p, [{ at: ktm, qty: 1 }, { at: pkr, qty: 2 }], { on: "2026-11-07", discount: rs(300) });
    await sale(p, [{ at: wh, qty: 2 }], { on: "2026-11-08" }); // online order shipped from the warehouse
    await sale(p, [{ at: ktm, qty: 5 }], { on: "2026-11-08", status: "CANCELLED" }); // never counts
    await sale(p, [{ at: ktm, qty: 1 }], { on: "2026-10-30" }); // last month
    await sale(p, [{ at: ktm, qty: 1 }], { on: "2026-11-09", noAllocation: true }); // an old order with no location
    // 2 units of the split order come back resellable (refund after the discount share). Which shop's units they
    // were isn't recorded, so the refund and the cost back are shared by the line's allocation: Kathmandu 1/3, Pokhara 2/3
    await db.return.create({ data: { orderId: split.id, processedById: owner.id, reason: "size", refundMethod: "CASH", refundAmount: rs(1800), createdAt: at("2026-11-10"), items: { create: { orderItemId: split.items[0].id, quantity: 2, condition: "RESELLABLE", amount: rs(1800) } } } });
    // a whole online order returned in November
    await sale(p, [{ at: pkr, qty: 1 }], { on: "2026-11-02", status: "RETURNED", updatedOn: "2026-11-11" });

    await db.expense.createMany({ data: [
      { date: "2026-11-01", category: "RENT", amount: rs(50_000), storeId: ktm.id, description: "KTM rent", createdById: owner.id },
      { date: "2026-11-03", category: "UTILITIES", amount: rs(3_000), storeId: ktm.id, description: "KTM power", createdById: owner.id },
      { date: "2026-11-01", category: "RENT", amount: rs(20_000), storeId: pkr.id, description: "PKR rent", createdById: owner.id },
      { date: "2026-11-15", category: "MARKETING", amount: rs(10_000), description: "Facebook ads", createdById: owner.id }, // HQ
      { date: "2026-10-31", category: "RENT", amount: rs(50_000), storeId: ktm.id, description: "October", createdById: owner.id },
    ] });

    const r = await shopPl("2026-11");
    const k = r.rows.find((x) => x.storeId === ktm.id)!, pk = r.rows.find((x) => x.storeId === pkr.id)!, w = r.rows.find((x) => x.storeId === wh.id)!;
    // Kathmandu: 3 × 1000 + 1 × 900 = 3900 − 600 refund = 3300; cost 4 × 400 − 800/3 back
    expect(k).toMatchObject({ netSales: rs(3300), cogs: 133333, grossProfit: rs(3300) - 133333, rent: rs(50_000), other: rs(3_000), staff: 0, profit: rs(3300) - 133333 - rs(53_000) });
    // Pokhara: 1000 + 1800 + 1000 (returned order) − 1200 refund − 1000 whole return = 1600; cost 4 × 400 − 1600/3 − 400
    expect(pk).toMatchObject({ netSales: rs(1600), cogs: 66667, rent: rs(20_000) });
    expect(w).toMatchObject({ netSales: rs(2000), cogs: rs(800), profit: rs(1200) });
    expect(r.unlinked).toMatchObject({ netSales: rs(1000), cogs: rs(400) });
    expect(r.hq).toMatchObject({ other: rs(10_000), deliveryIncome: rs(150), profit: rs(150 - 10_000) });

    // the rows are the company P&L, to the paisa
    const sum = (f: (x: { netSales: number; cogs: number; profit: number }) => number) => [...r.rows, r.hq!, r.unlinked!].reduce((a, x) => a + f(x), 0);
    expect(sum((x) => x.netSales)).toBe(r.total.netSales);
    expect(sum((x) => x.cogs)).toBe(r.total.cogs);
    expect(sum((x) => x.profit)).toBe(r.total.profit);
    // HQ's net cost spread by sales share; nothing lost to rounding
    expect(r.rows.reduce((a, x) => a + x.hqShare, 0)).toBe(-r.hq!.profit);
    expect(k.hqShare).toBe(Math.round((rs(9850) * 3300) / 6900));

    // a manager's view: only their locations, no HQ row
    const mine = await shopPl("2026-11", { storeIds: [pkr.id] });
    expect(mine.rows.map((x) => x.name)).toEqual(["Pokhara shop"]);
    expect(mine.hq).toBeNull();
  });

  it("payroll posts each person's cost to their location (split if several, HQ if all)", async () => {
    const ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    const sita = await makeUser("MANAGER", { name: "Sita", locations: [ktm.id, pkr.id] });
    const boss = await makeUser("STAFF", { name: "Online Staff" }); // all locations: HQ
    await db.$transaction((tx) => saveTaxYear(tx, owner, "2083/84", TEMPLATE_2082));
    await db.$transaction((tx) => confirmTaxYear(tx, owner, "2083/84"));
    for (const [u, basic] of [[ram, 30_000], [sita, 45_001], [boss, 50_000]] as const) await db.$transaction((tx) => saveEmployment(tx, owner, u.id, { basic: rs(basic), allowance: 0, inSsf: false, married: false, active: true }));
    await db.$transaction((tx) => buildRun(tx, owner, "2026-11", "2026-11-30"));
    await db.$transaction((tx) => approveRun(tx, owner, "2026-11"));
    const paid = await db.$transaction((tx) => markPaid(tx, owner, "2026-11", "Bank", "2026-11-30"));
    const byLoc = await db.expense.groupBy({ by: ["storeId"], where: { category: "SALARIES" }, _sum: { amount: true } });
    const amt = (id: string | null) => byLoc.find((b) => b.storeId === id)?._sum.amount ?? 0;
    expect(amt(ktm.id)).toBe(rs(30_000) + Math.ceil(rs(45_001) / 2)); // Ram + half of Sita (the odd paisa goes to the first)
    expect(amt(pkr.id)).toBe(Math.floor(rs(45_001) / 2));
    expect(amt(null)).toBe(rs(50_000));
    expect(amt(ktm.id) + amt(pkr.id) + amt(null)).toBe(paid.gross + paid.employer);
    const r = await shopPl("2026-11");
    expect(r.rows.find((x) => x.storeId === ktm.id)!.staff).toBe(amt(ktm.id));
  });

  it("recurring costs post once a month, only in their months", async () => {
    await expect(db.$transaction((tx) => saveRecurringCost(tx, owner, { storeId: ktm.id, category: "RENT", amount: rs(50_000), description: "Shop rent", startMonth: "2026-12", endMonth: "2026-11", active: true }))).rejects.toThrow(/before the first/);
    await db.$transaction((tx) => saveRecurringCost(tx, owner, { storeId: ktm.id, category: "RENT", amount: rs(50_000), description: "Shop rent", startMonth: "2026-11", endMonth: "2027-01", active: true }));
    await db.$transaction((tx) => saveRecurringCost(tx, owner, { storeId: null, category: "UTILITIES", amount: rs(4_000), description: "HQ internet", startMonth: "2026-12", active: true }));
    await db.$transaction((tx) => saveRecurringCost(tx, owner, { storeId: pkr.id, category: "OTHER", amount: rs(1_000), description: "Old security", startMonth: "2026-01", active: false }));
    expect(await postRecurring("2026-11")).toEqual({ posted: 1 });
    expect(await postRecurring("2026-11")).toEqual({ posted: 0 }); // never twice
    await Promise.all([postRecurring("2026-12"), postRecurring("2026-12")]); // two workers at once
    expect(await db.expense.count({ where: { date: "2026-12-01" } })).toBe(2);
    expect(await postRecurring("2027-02")).toEqual({ posted: 1 }); // rent has ended; internet goes on
    expect((await shopPl("2026-11")).rows.find((x) => x.storeId === ktm.id)!.rent).toBe(rs(50_000));
    await expect(db.recurringCost.create({ data: { category: "RENT", amount: 0, description: "x", startMonth: "2026-11", createdById: owner.id } })).rejects.toThrow(/RecurringCost_amount_pos/);
  });
});
