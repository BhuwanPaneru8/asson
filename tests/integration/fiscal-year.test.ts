import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { closeYear, reopenYear, startYear, yearChecklist, yearPack } from "@/lib/fiscal-year";
import { makeProduct, makeUser, resetDb } from "../support/db";
import { profitAndLoss } from "@/lib/finance";
import { periodBounds } from "@/lib/accounting";

type U = Awaited<ReturnType<typeof makeUser>>;
const after = new Date("2027-08-01T06:00:00Z");
const months = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"];

describe("fiscal-year close", () => {
  let owner: U;
  beforeEach(async () => { await resetDb(); owner = await makeUser("ADMIN", { name: "Owner" }); });

  const vat = (label: string, from: string, to: string, status: "FILED" | "DRAFT" = "FILED") =>
    db.vatReturn.create({ data: { label, from, to, status, filedAt: status === "FILED" ? new Date() : null, createdById: owner.id } });

  it("the year's dates are checked; the checklist blocks until months, VAT, payroll deposits and the bank are done", async () => {
    await expect(db.$transaction((tx) => startYear(tx, owner, { label: "2083/85", from: "2026-07-17", to: "2027-07-16" }))).rejects.toThrow(/like 2083\/84/);
    await expect(db.$transaction((tx) => startYear(tx, owner, { label: "2083/84", from: "2026-07-17", to: "2027-03-16" }))).rejects.toThrow(/365 or 366/);
    await expect(db.$transaction((tx) => startYear(tx, owner, { label: "2083/84", from: "2025-07-17", to: "2026-07-16" }))).rejects.toThrow(/starts in July 2026/);
    await db.$transaction((tx) => startYear(tx, owner, { label: "2083/84", from: "2026-07-17", to: "2027-07-16" }));
    await expect(db.$transaction((tx) => startYear(tx, owner, { label: "2084/85", from: "2027-07-01", to: "2028-06-30" }))).rejects.toThrow(/overlaps FY 2083\/84/);

    // VAT filed for the year except a gap in Magh and a draft at the end
    await vat("first half", "2026-07-17", "2027-01-14");
    await vat("second half", "2027-02-13", "2027-06-14");
    await vat("Ashadh", "2027-06-15", "2027-07-16", "DRAFT");
    let c = await yearChecklist("2083/84");
    const v = c.items.find((i) => i.key === "vat")!;
    expect(v.count).toBe(2);
    expect(v.detail).toBe("2027-01-15 to 2027-02-12; 2027-06-15 to 2027-07-16; Ashadh is a draft");
    expect(c.items.find((i) => i.key === "months")!.count).toBe(11); // Aug … Jun are fully inside
    expect(c.items.find((i) => i.key === "edges")!.detail).toBe("2026-07, 2027-07");
    await expect(db.$transaction((tx) => closeYear(tx, owner, "2083/84", { acceptWarnings: true }, after))).rejects.toThrow(/Clear these first/);

    // finish it all
    for (const m of months) await db.monthClose.create({ data: { month: m, closedAt: new Date(), closedById: owner.id, closedByName: "Owner", snapshot: {} } });
    await vat("Magh", "2027-01-15", "2027-02-12");
    await db.vatReturn.updateMany({ where: { label: "Ashadh" }, data: { status: "FILED", filedAt: new Date() } });
    await db.statementLine.create({ data: { account: "NIC", date: "2027-03-01", amount: 500, description: "x", key: "k1", status: "UNMATCHED", importedById: owner.id } });
    c = await yearChecklist("2083/84");
    expect(c.items.filter((i) => i.blocking && i.count).map((i) => i.key)).toEqual(["bank"]);
    await db.statementLine.updateMany({ data: { status: "IGNORED", note: "interest" } });
    c = await yearChecklist("2083/84");
    expect(c.blocking).toBe(0);
    expect(c.warnings).toBe(1); // the two edge months
    await expect(db.$transaction((tx) => closeYear(tx, owner, "2083/84", { acceptWarnings: true }, new Date("2027-07-10T06:00:00Z")))).rejects.toThrow(/hasn't ended/);
    await expect(db.$transaction((tx) => closeYear(tx, owner, "2083/84", { acceptWarnings: false }, after))).rejects.toThrow(/confirm/);
    await db.$transaction((tx) => closeYear(tx, owner, "2083/84", { acceptWarnings: true }, after));
    await expect(db.$transaction((tx) => closeYear(tx, owner, "2083/84", { acceptWarnings: true }, after))).rejects.toThrow(/already closed/);
    const y = await db.fiscalYearClose.findUniqueOrThrow({ where: { label: "2083/84" } });
    expect(y.snapshot).toMatchObject({ pl: { netSales: 0 }, vat: { output: 0 } });
    await expect(db.$transaction((tx) => reopenYear(tx, owner, "2083/84", " "))).rejects.toThrow(/Say why/);
    await db.$transaction((tx) => reopenYear(tx, owner, "2083/84", "Auditor adjustment", new Date("2027-08-02T06:00:00Z")));
    await db.$transaction((tx) => closeYear(tx, owner, "2083/84", { acceptWarnings: true }, new Date("2027-08-03T06:00:00Z")));
    expect((await db.fiscalYearClose.findUniqueOrThrow({ where: { label: "2083/84" } })).reopenReason).toBe("Auditor adjustment");
  });

  it("the pack splits the year into its months, clipping the edge months to the year", async () => {
    await db.$transaction((tx) => startYear(tx, owner, { label: "2083/84", from: "2026-07-17", to: "2027-07-16" }));
    const p = await yearPack("2083/84");
    expect(p.monthly.map((m) => m.label)).toEqual(["2026-07 (17–31)", ...months, "2027-07 (01–16)"]);
    expect(p.monthly[0]).toMatchObject({ from: "2026-07-17", to: "2026-07-31" });
    // the year's total (summed from its months) equals a P&L over the whole year, sale on an edge day included
    const prod = await makeProduct({ price: 1000 });
    for (const [on, qty] of [["2026-07-16", 9], ["2026-07-17", 1], ["2026-12-31", 2], ["2027-07-16", 3], ["2027-07-17", 5]] as const) {
      await db.order.create({ data: { email: "x@t.l", phone: "9800000000", status: "DELIVERED", paymentMethod: "COD", subtotal: prod.price * qty, total: prod.price * qty, shippingMethod: "standard", shippingAddress: {}, createdAt: new Date(`${on}T23:30:00+05:45`),
        items: { create: { variantId: prod.variants[0].id, productId: prod.id, name: "x", slug: prod.slug, sku: prod.variants[0].sku, color: "W", size: "M", image: "", unitPrice: prod.price, quantity: qty, unitCost: 40_000 } } } });
    }
    const again = await yearPack("2083/84");
    const { start, end } = periodBounds({ from: "2026-07-17", to: "2027-07-16" });
    const direct = await profitAndLoss(start, end, "2026-07-17", "2027-07-17");
    expect(again.total.netSales).toBe(direct.netSales);
    expect(again.total.netProfit).toBe(direct.netProfit);
    expect(again.total.netSales).toBe(prod.price * 6); // 1 + 2 + 3: the days just outside the year aren't in it
  });
});
