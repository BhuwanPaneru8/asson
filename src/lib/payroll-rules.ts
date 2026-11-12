// Payroll arithmetic, kept pure so an accountant can check it line by line (tests/unit/payroll.test.ts).
// Money in paisa. Tax bands are yearly, in rupees, cumulative upper bounds (null = no upper bound).
//
// Monthly income tax (TDS) method, as Nepal payroll calculators commonly apply it:
//   annual gross        = this month's gross × 12
//   assessable          = annual gross + employer SSF (20% of basic × 12, SSF members only)
//   retirement deduction= min(employee + employer SSF (31% of basic × 12), assessable ÷ 3, Rs 5,00,000)
//   taxable             = assessable − retirement deduction
//   annual tax          = bands applied to taxable (first band at 0% for SSF members when the year says so)
//   monthly TDS         = annual tax ÷ 12
// The bands themselves are data (PayrollTaxYear), confirmed by the owner/accountant each fiscal year.

export type Band = { upTo: number | null; rate: number };
export type TaxYear = { single: Band[]; married: Band[]; ssfFirstBandZero: boolean };

export const SSF_EMPLOYEE = 0.11, SSF_EMPLOYER = 0.2;
const RETIREMENT_CAP = 500_000 * 100; // Rs 5 lakh in paisa

export function bandTax(taxable: number, bands: Band[], firstBandZero = false) {
  let tax = 0, lower = 0;
  bands.forEach((b, i) => {
    const upper = b.upTo == null ? Infinity : b.upTo * 100;
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * ((i === 0 && firstBandZero ? 0 : b.rate) / 100);
    lower = upper;
  });
  return Math.round(tax);
}

export type SlipInput = { basic: number; allowance: number; bonus: number; commission?: number; workingDays: number; unpaidDays: number; inSsf: boolean; married: boolean };
export type Slip = { earnedBasic: number; earnedAllowance: number; unpaidDeduction: number; gross: number; ssfEmployee: number; ssfEmployer: number; taxable: number; incomeTax: number; net: number; costToCompany: number };

export function computeSlip(i: SlipInput, year: TaxYear): Slip {
  const share = i.workingDays ? Math.max(0, i.workingDays - i.unpaidDays) / i.workingDays : 1;
  const earnedBasic = Math.round(i.basic * share), earnedAllowance = Math.round(i.allowance * share);
  const unpaidDeduction = i.basic + i.allowance - earnedBasic - earnedAllowance;
  const gross = earnedBasic + earnedAllowance + i.bonus + (i.commission ?? 0);
  const ssfEmployee = i.inSsf ? Math.round(earnedBasic * SSF_EMPLOYEE) : 0;
  const ssfEmployer = i.inSsf ? Math.round(earnedBasic * SSF_EMPLOYER) : 0;
  const assessable = gross * 12 + ssfEmployer * 12;
  const deduction = i.inSsf ? Math.min((ssfEmployee + ssfEmployer) * 12, Math.floor(assessable / 3), RETIREMENT_CAP) : 0;
  const taxable = Math.max(0, assessable - deduction);
  const incomeTax = Math.round(bandTax(taxable, i.married ? year.married : year.single, i.inSsf && year.ssfFirstBandZero) / 12);
  return { earnedBasic, earnedAllowance, unpaidDeduction, gross, ssfEmployee, ssfEmployer, taxable, incomeTax, net: gross - ssfEmployee - incomeTax, costToCompany: gross + ssfEmployer };
}

// Year-end settlement: the monthly method projects one month × 12, so pay that changes during the year (a raise,
// unpaid days, bonus, commission) leaves the year's TDS off. The last month of the fiscal year corrects it:
//   assessable = Σ gross + Σ employer SSF over the year's payslips
//   deduction  = min(Σ employee + employer SSF, assessable ÷ 3, Rs 5,00,000)   (SSF members)
//   annual tax = bands on (assessable − deduction)
//   last month's TDS = annual tax − TDS already deducted (never below 0; any excess is refundable by the IRD)
// Tax rises with income, so projecting single months can only over-deduct when pay varies (a raise, a bonus month,
// joining mid-year): in practice the settlement gives tax back. It tops up only if the bands or SSF status changed.
export type YearTotals = { gross: number; ssfEmployee: number; ssfEmployer: number; inSsf: boolean; married: boolean };

export function annualTax(t: YearTotals, year: TaxYear) {
  const assessable = t.gross + t.ssfEmployer;
  const deduction = t.inSsf ? Math.min(t.ssfEmployee + t.ssfEmployer, Math.floor(assessable / 3), RETIREMENT_CAP) : 0;
  const taxable = Math.max(0, assessable - deduction);
  return { assessable, deduction, taxable, tax: bandTax(taxable, t.married ? year.married : year.single, t.inSsf && year.ssfFirstBandZero) };
}

/** The last payroll month of a fiscal year ("2083/84" → "2027-07"): its run settles the year's tax. */
export const lastMonthOf = (fiscalYear: string) => `${Number(fiscalYear.slice(0, 4)) - 57 + 1}-07`;

/** Working days in a month (YYYY-MM): every day except the weekly day off. */
export function workingDaysIn(month: string, weeklyOff: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  let n = 0;
  for (; d.toISOString().slice(0, 7) === month; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() !== weeklyOff) n++;
  return n;
}

/** Nepal fiscal year of a Gregorian month: starts mid-July (Shrawan). 2026-11 → "2083/84". */
export function fiscalYearOf(month: string) {
  const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
  const bs = y + 57 - (m >= 8 ? 0 : 1); // Aug–Dec belong to the year that began in July; Jan–Jul to the one before
  return `${bs}/${String((bs + 1) % 100).padStart(2, "0")}`;
}

/** The FY 2082/83 bands as widely published (single and married). A template only: confirm before use. */
export const TEMPLATE_2082: TaxYear = {
  single: [{ upTo: 500_000, rate: 1 }, { upTo: 700_000, rate: 10 }, { upTo: 1_000_000, rate: 20 }, { upTo: 2_000_000, rate: 30 }, { upTo: 5_000_000, rate: 36 }, { upTo: null, rate: 39 }],
  married: [{ upTo: 600_000, rate: 1 }, { upTo: 800_000, rate: 10 }, { upTo: 1_100_000, rate: 20 }, { upTo: 2_000_000, rate: 30 }, { upTo: 5_000_000, rate: 36 }, { upTo: null, rate: 39 }],
  ssfFirstBandZero: true,
};
