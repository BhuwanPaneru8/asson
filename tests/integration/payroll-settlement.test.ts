import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { adjustSlip, approveRun, buildRun, confirmTaxYear, saveEmployment, saveTaxYear, yearEndCheck } from "@/lib/payroll";
import { annualTax, fiscalYearOf, lastMonthOf, TEMPLATE_2082 } from "@/lib/payroll-rules";
import { makeLocation, makeUser, resetDb } from "../support/db";

const rs = (n: number) => n * 100;
const FY = "2082/83"; // Aug 2025 – Jul 2026
const MONTHS = ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
const TODAY = "2026-07-31";
type U = Awaited<ReturnType<typeof makeUser>>;
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

describe("year-end tax settlement", () => {
  let owner: U, ram: U, sita: U;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN");
    const shop = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [shop.id] });
    sita = await makeUser("MANAGER", { name: "Sita", locations: [shop.id] });
    await tx((t) => saveTaxYear(t, owner, FY, TEMPLATE_2082));
    await tx((t) => confirmTaxYear(t, owner, FY));
    await tx((t) => saveEmployment(t, owner, ram.id, { basic: rs(40_000), allowance: 0, inSsf: false, married: false, active: true }));
    await tx((t) => saveEmployment(t, owner, sita.id, { basic: rs(60_000), allowance: rs(10_000), inSsf: true, married: true, active: true }));
  });

  const month = (m: string) => tx((t) => buildRun(t, owner, m, TODAY));
  const slip = (m: string, u: U) => db.payslip.findFirstOrThrow({ where: { userId: u.id, run: { month: m } } });

  it("knows the fiscal year's last month", () => {
    expect(lastMonthOf(FY)).toBe("2026-07");
    expect(fiscalYearOf("2026-07")).toBe(FY);
    expect(fiscalYearOf("2025-08")).toBe(FY);
    expect(lastMonthOf("2083/84")).toBe("2027-07");
  });

  it("the last month makes the year's TDS add up to the tax on the year's actual pay, after a raise", async () => {
    for (const m of MONTHS) {
      if (m === "2026-01") await tx((t) => saveEmployment(t, owner, ram.id, { basic: rs(80_000), allowance: 0, inSsf: false, married: false, active: true })); // a raise halfway
      await month(m);
      await tx((t) => approveRun(t, owner, m));
    }
    // monthly TDS so far: each month projected × 12 on its own; tax rises with income, so the months after the raise
    // were taxed as if the whole year paid that much: the year was over-deducted, and July gives it back
    const before = await db.payslip.findMany({ where: { userId: ram.id }, select: { gross: true, incomeTax: true } });
    const grossSoFar = before.reduce((a, s) => a + s.gross, 0), tdsSoFar = before.reduce((a, s) => a + s.incomeTax, 0);

    await month("2026-07");
    const july = await slip("2026-07", ram);
    const yearGross = grossSoFar + july.gross;
    const yearTax = annualTax({ gross: yearGross, ssfEmployee: 0, ssfEmployer: 0, inSsf: false, married: false }, TEMPLATE_2082).tax;
    expect(july.yearTax).toBe(yearTax);
    expect(tdsSoFar + july.incomeTax - july.taxAdjustment).toBeGreaterThan(yearTax); // the monthly method alone would over-deduct
    expect(july.incomeTax).toBe(Math.max(0, yearTax - tdsSoFar));
    expect(july.taxRefundDue).toBe(Math.max(0, tdsSoFar - yearTax));
    expect(july.taxAdjustment).toBeLessThan(0); // less than the usual monthly amount
    expect(july.net).toBe(july.gross - july.incomeTax);
    const all = await db.payslip.aggregate({ where: { userId: ram.id }, _sum: { incomeTax: true } });
    expect(all._sum.incomeTax! - july.taxRefundDue).toBe(yearTax); // the year adds up exactly, counting what's to claim back

    // SSF member: the retirement deduction and the SSF first band count over the year too
    const sitaYear = await db.payslip.aggregate({ where: { userId: sita.id }, _sum: { incomeTax: true, gross: true, ssfEmployee: true, ssfEmployer: true } });
    const sitaJuly = await slip("2026-07", sita);
    expect(sitaJuly.yearTax).toBe(annualTax({ gross: sitaYear._sum.gross!, ssfEmployee: sitaYear._sum.ssfEmployee!, ssfEmployer: sitaYear._sum.ssfEmployer!, inSsf: true, married: true }, TEMPLATE_2082).tax);
    expect(sitaYear._sum.incomeTax).toBe(sitaJuly.yearTax); // steady pay: on track all year, settled to the paisa

    // a July bonus is settled too: adjusting the draft re-settles
    await tx((t) => adjustSlip(t, owner, july.id, { bonus: rs(50_000), extraUnpaidDays: 0 }));
    const july2 = await slip("2026-07", ram);
    const year2 = annualTax({ gross: grossSoFar + july2.gross, ssfEmployee: 0, ssfEmployer: 0, inSsf: false, married: false }, TEMPLATE_2082).tax;
    expect(july2.incomeTax).toBe(Math.max(0, year2 - tdsSoFar));
    expect(july2.taxRefundDue).toBe(Math.max(0, tdsSoFar - year2));

    const check = await yearEndCheck(FY);
    expect(check.rows.find((r) => r.name === "Ram")).toMatchObject({ months: 12, settled: { yearTax: year2, refund: july2.taxRefundDue } });
  });

  it("over-deducted earlier: July's TDS stops at zero and the rest is shown to claim back", async () => {
    for (const m of MONTHS) {
      await month(m);
      if (m === "2025-08") await tx(async (t) => adjustSlip(t, owner, (await slip(m, ram)).id, { bonus: rs(900_000), extraUnpaidDays: 0 })); // one huge month, taxed as if every month were like it
      await tx((t) => approveRun(t, owner, m));
    }
    await month("2026-07");
    const july = await slip("2026-07", ram);
    const tdsBefore = (await db.payslip.aggregate({ where: { userId: ram.id, run: { month: { lt: "2026-07" } } }, _sum: { incomeTax: true } }))._sum.incomeTax!;
    expect(july.incomeTax).toBe(0);
    expect(july.taxRefundDue).toBe(tdsBefore - july.yearTax!);
    expect(july.taxRefundDue).toBeGreaterThan(0);
    expect(july.net).toBe(july.gross);
  });

  it("won't settle against an earlier month that's still a draft; mid-year the check flags drift", async () => {
    for (const m of MONTHS.slice(0, 3)) await month(m);
    await tx((t) => approveRun(t, owner, "2025-08"));
    let check = await yearEndCheck(FY);
    expect(check.rows.find((r) => r.name === "Ram")).toMatchObject({ months: 3, gap: 0 }); // steady pay: on track
    await tx(async (t) => adjustSlip(t, owner, (await slip("2025-09", ram)).id, { bonus: rs(200_000), extraUnpaidDays: 0 }));
    check = await yearEndCheck(FY);
    expect(check.rows.find((r) => r.name === "Ram")!.gap).toBeLessThan(-rs(10_000)); // a bonus month projected × 12 over-deducts

    await expect(month("2026-07")).rejects.toThrow(/Approve 2025-09, 2025-10 first: 2026-07 settles the year's tax/);
  });
});
