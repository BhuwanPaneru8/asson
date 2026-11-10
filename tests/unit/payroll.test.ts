import { describe, expect, it } from "vitest";
import { bandTax, computeSlip, fiscalYearOf, TEMPLATE_2082, workingDaysIn } from "@/lib/payroll-rules";

const rs = (n: number) => n * 100;

describe("payroll arithmetic (checkable by hand)", () => {
  it("applies tax bands", () => {
    expect(bandTax(rs(600_000), TEMPLATE_2082.single)).toBe(rs(15_000)); // 5L × 1% + 1L × 10%
    expect(bandTax(rs(600_000), TEMPLATE_2082.single, true)).toBe(rs(10_000)); // SSF member: first band 0%
    expect(bandTax(rs(600_000), TEMPLATE_2082.married)).toBe(rs(6_000)); // all in the 6L band at 1%
    expect(bandTax(rs(6_000_000), TEMPLATE_2082.single)).toBe(rs(5_000 + 20_000 + 60_000 + 300_000 + 1_080_000 + 390_000));
  });

  it("not in SSF: gross 50,000 → TDS 1,250, net 48,750", () => {
    const s = computeSlip({ basic: rs(40_000), allowance: rs(10_000), bonus: 0, workingDays: 26, unpaidDays: 0, inSsf: false, married: false }, TEMPLATE_2082);
    expect(s).toMatchObject({ gross: rs(50_000), ssfEmployee: 0, ssfEmployer: 0, incomeTax: rs(1_250), net: rs(48_750), costToCompany: rs(50_000) });
  });

  it("in SSF: 11% / 20% of basic, retirement deduction, first band free", () => {
    // assessable 6,00,000 + 96,000 = 6,96,000; deduction min(1,48,800, 2,32,000, 5,00,000) = 1,48,800
    // taxable 5,47,200 → 0% on 5L + 10% on 47,200 = 4,720 a year → 393 a month (rounded)
    const s = computeSlip({ basic: rs(40_000), allowance: rs(10_000), bonus: 0, workingDays: 26, unpaidDays: 0, inSsf: true, married: false }, TEMPLATE_2082);
    expect(s).toMatchObject({ gross: rs(50_000), ssfEmployee: rs(4_400), ssfEmployer: rs(8_000), taxable: rs(547_200), incomeTax: 39_333, net: rs(50_000) - rs(4_400) - 39_333, costToCompany: rs(58_000) });
  });

  it("unpaid days reduce basic and allowance pro rata; a bonus adds to gross", () => {
    const s = computeSlip({ basic: rs(26_000), allowance: rs(0), bonus: rs(5_000), workingDays: 26, unpaidDays: 2, inSsf: false, married: false }, TEMPLATE_2082);
    expect(s).toMatchObject({ earnedBasic: rs(24_000), unpaidDeduction: rs(2_000), gross: rs(29_000) });
  });

  it("calendar helpers", () => {
    expect(workingDaysIn("2026-11", 6)).toBe(26); // November 2026 has 4 Saturdays
    expect(fiscalYearOf("2026-11")).toBe("2083/84");
    expect(fiscalYearOf("2026-07")).toBe("2082/83");
    expect(fiscalYearOf("2027-01")).toBe("2083/84");
  });
});
