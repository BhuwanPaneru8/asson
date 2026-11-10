import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { adjustSlip, approveRun, buildRun, confirmTaxYear, markPaid, reopenRun, saveEmployment, saveTaxYear } from "@/lib/payroll";
import { TEMPLATE_2082 } from "@/lib/payroll-rules";
import { makeLocation, makeUser, resetDb } from "../support/db";

const rs = (n: number) => n * 100;
type U = Awaited<ReturnType<typeof makeUser>>;

describe("payroll", () => {
  let owner: U, ram: U, sita: U;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN");
    const shop = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [shop.id] });
    sita = await makeUser("MANAGER", { name: "Sita", locations: [shop.id] });
    await db.$transaction((tx) => saveEmployment(tx, owner, ram.id, { basic: rs(26_000), allowance: rs(0), inSsf: false, married: false, active: true }));
    await db.$transaction((tx) => saveEmployment(tx, owner, sita.id, { basic: rs(40_000), allowance: rs(10_000), inSsf: true, married: false, active: true }));
  });

  it("won't run on bands nobody confirmed; editing bands needs a fresh confirmation", async () => {
    await expect(db.$transaction((tx) => buildRun(tx, owner, "2026-11", "2026-11-30"))).rejects.toThrow(/Confirm the income-tax bands for FY 2083\/84/);
    await db.$transaction((tx) => saveTaxYear(tx, owner, "2083/84", TEMPLATE_2082));
    await expect(db.$transaction((tx) => buildRun(tx, owner, "2026-11", "2026-11-30"))).rejects.toThrow(/Confirm/);
    await db.$transaction((tx) => confirmTaxYear(tx, owner, "2083/84"));
    await db.$transaction((tx) => buildRun(tx, owner, "2026-11", "2026-11-30"));
    await db.$transaction((tx) => saveTaxYear(tx, owner, "2083/84", { ...TEMPLATE_2082, ssfFirstBandZero: false }));
    expect((await db.payrollTaxYear.findUniqueOrThrow({ where: { fiscalYear: "2083/84" } })).confirmedAt).toBeNull();
    await expect(db.$transaction((tx) => saveTaxYear(tx, owner, "2083/84", { ...TEMPLATE_2082, single: [{ upTo: 500_000, rate: 1 }, { upTo: 400_000, rate: 10 }, { upTo: null, rate: 20 }] }))).rejects.toThrow(/must go up/);
  });

  it("builds from salary terms and the timesheet; adjustments; approve freezes; paid posts to expenses", async () => {
    await db.$transaction((tx) => saveTaxYear(tx, owner, "2083/84", TEMPLATE_2082));
    await db.$transaction((tx) => confirmTaxYear(tx, owner, "2083/84"));
    await db.leaveRequest.create({ data: { userId: ram.id, type: "UNPAID", fromDate: "2026-11-09", toDate: "2026-11-10", days: 2, status: "APPROVED" } });
    await db.$transaction((tx) => buildRun(tx, owner, "2026-11", "2026-11-30"));
    const run = await db.payrollRun.findUniqueOrThrow({ where: { month: "2026-11" }, include: { slips: true } });
    const r = run.slips.find((s) => s.userId === ram.id)!, s = run.slips.find((x) => x.userId === sita.id)!;
    expect(r).toMatchObject({ workingDays: 26, unpaidDays: 2, earnedBasic: rs(24_000), gross: rs(24_000), ssfEmployee: 0 });
    expect(s).toMatchObject({ gross: rs(50_000), ssfEmployee: rs(4_400), ssfEmployer: rs(8_000), incomeTax: 39_333 });

    await db.$transaction((tx) => adjustSlip(tx, owner, r.id, { bonus: rs(2_000), extraUnpaidDays: 1, note: "absent 20th" }));
    expect(await db.payslip.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ unpaidDays: 3, earnedBasic: rs(23_000), gross: rs(25_000), note: "absent 20th" });
    await db.$transaction((tx) => buildRun(tx, owner, "2026-11", "2026-11-30")); // a rebuild keeps the owner's adjustments
    expect(await db.payslip.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ unpaidDays: 3, bonus: rs(2_000) });

    await db.$transaction((tx) => approveRun(tx, owner, "2026-11"));
    await expect(db.$transaction((tx) => adjustSlip(tx, owner, r.id, { bonus: 0, extraUnpaidDays: 0 }))).rejects.toThrow(/Only a draft/);
    await expect(db.$transaction((tx) => buildRun(tx, owner, "2026-11", "2026-11-30"))).rejects.toThrow(/already approved/);
    await db.$transaction((tx) => reopenRun(tx, owner, "2026-11", "wrong bonus"));
    await db.$transaction((tx) => approveRun(tx, owner, "2026-11"));

    const paid = await db.$transaction((tx) => markPaid(tx, owner, "2026-11", "Bank transfer", "2026-11-30"));
    expect(paid).toMatchObject({ gross: rs(75_000), employer: rs(8_000) });
    const exp = await db.expense.findMany({ where: { category: "SALARIES" }, orderBy: { amount: "desc" } });
    expect(exp.map((e) => e.amount)).toEqual([rs(75_000), rs(8_000)]);
    await expect(db.$transaction((tx) => reopenRun(tx, owner, "2026-11", "x"))).rejects.toThrow(/Only an approved payroll/);
    await expect(db.$transaction((tx) => markPaid(tx, owner, "2026-11", "Cash", "2026-11-30"))).rejects.toThrow(/Approve the payroll/);
  });

  it("only staff go on the payroll, and only this month or earlier", async () => {
    const shopper = await makeUser("CUSTOMER");
    await expect(db.$transaction((tx) => saveEmployment(tx, owner, shopper.id, { basic: 1, allowance: 0, inSsf: false, married: false, active: true }))).rejects.toThrow(/Only staff/);
    await expect(db.$transaction((tx) => buildRun(tx, owner, "2026-12", "2026-11-30"))).rejects.toThrow(/this month or an earlier one/);
  });
});
