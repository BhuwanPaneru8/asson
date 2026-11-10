import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store } from "./config";
import { ktmDate } from "./pos";
import { timesheet } from "./people";
import { computeSlip, fiscalYearOf, workingDaysIn, type Band, type TaxYear } from "./payroll-rules";
import { formatPrice } from "./utils";
import { commissionByPerson } from "./commissions";

// Monthly payroll, owner only. A run for a month is built from each person's salary terms (Employment) and
// the timesheet (unpaid leave), with tax from the fiscal year's confirmed bands. While DRAFT it can be
// rebuilt and adjusted (bonus, extra unpaid days); APPROVED freezes it; PAID posts the cost to Expenses
// (gross salaries + employer SSF) so it shows in the P&L. Approved runs are never edited, only reopened
// before they're paid.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class PayrollError extends Error {}

export function validBands(bands: Band[]) {
  if (!bands.length) return "Add at least one band.";
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    if (!(b.rate >= 0 && b.rate <= 60)) return "Rates are percentages between 0 and 60.";
    const last = i === bands.length - 1;
    if (last ? b.upTo != null : b.upTo == null) return "Every band has an upper limit except the last.";
    if (i > 0 && b.upTo != null && b.upTo <= (bands[i - 1].upTo ?? 0)) return "Band limits must go up.";
  }
  return null;
}

export async function taxYearFor(reader: Tx | typeof db, fiscalYear: string): Promise<(TaxYear & { confirmed: boolean }) | null> {
  const t = await reader.payrollTaxYear.findUnique({ where: { fiscalYear } });
  return t ? { single: t.single as Band[], married: t.married as Band[], ssfFirstBandZero: t.ssfFirstBandZero, confirmed: !!t.confirmedAt } : null;
}

/** Save bands for a year. Any change clears the confirmation: someone must look again. */
export async function saveTaxYear(tx: Tx, owner: Actor, fiscalYear: string, d: TaxYear & { source?: string }) {
  for (const [k, bands] of [["single", d.single], ["married", d.married]] as const) {
    const err = validBands(bands);
    if (err) throw new PayrollError(`${k === "single" ? "Single" : "Married"} bands: ${err}`);
  }
  await tx.payrollTaxYear.upsert({
    where: { fiscalYear },
    create: { fiscalYear, single: d.single, married: d.married, ssfFirstBandZero: d.ssfFirstBandZero, source: d.source || null },
    update: { single: d.single, married: d.married, ssfFirstBandZero: d.ssfFirstBandZero, source: d.source || null, confirmedAt: null, confirmedById: null },
  });
  await audit(tx, owner, { action: "payroll.tax_save", entity: ["PayrollTaxYear", fiscalYear], summary: `Tax bands for FY ${fiscalYear} saved (needs confirming)`, changes: { single: d.single, married: d.married, ssfFirstBandZero: d.ssfFirstBandZero } });
}

export async function confirmTaxYear(tx: Tx, owner: Actor, fiscalYear: string) {
  const upd = await tx.payrollTaxYear.updateMany({ where: { fiscalYear, confirmedAt: null }, data: { confirmedAt: new Date(), confirmedById: owner.id } });
  if (!upd.count) throw new PayrollError(`FY ${fiscalYear} has no bands to confirm, or they're already confirmed.`);
  await audit(tx, owner, { action: "payroll.tax_confirm", entity: ["PayrollTaxYear", fiscalYear], summary: `Tax bands for FY ${fiscalYear} confirmed for payroll` });
}

export type EmploymentInput = { basic: number; allowance: number; inSsf: boolean; married: boolean; pan?: string | null; bankAccount?: string | null; joinedOn?: string | null; active: boolean };

export async function saveEmployment(tx: Tx, owner: Actor, userId: string, d: EmploymentInput) {
  const u = await tx.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
  if (!u || u.role === "CUSTOMER") throw new PayrollError("Only staff are on the payroll.");
  const before = await tx.employment.findUnique({ where: { userId } });
  await tx.employment.upsert({ where: { userId }, create: { userId, ...d }, update: d });
  await audit(tx, owner, { action: "payroll.employment", entity: ["User", userId], summary: `${u.name}'s pay terms ${before ? "changed" : "set"}: basic ${formatPrice(d.basic)}, allowance ${formatPrice(d.allowance)}${d.inSsf ? ", in SSF" : ""}${d.active ? "" : ", off payroll"}` });
}

const slipFields = (s: ReturnType<typeof computeSlip>) => ({ earnedBasic: s.earnedBasic, unpaidDeduction: s.unpaidDeduction, gross: s.gross, ssfEmployee: s.ssfEmployee, ssfEmployer: s.ssfEmployer, incomeTax: s.incomeTax, net: s.net });

/** Create or rebuild a month's draft: everyone on the payroll, unpaid leave from the timesheet. */
export async function buildRun(tx: Tx, owner: Actor, month: string, today = ktmDate()) {
  if (!/^\d{4}-\d{2}$/.test(month) || month > today.slice(0, 7)) throw new PayrollError("Choose this month or an earlier one.");
  const fy = fiscalYearOf(month);
  const year = await taxYearFor(tx, fy);
  if (!year?.confirmed) throw new PayrollError(`Confirm the income-tax bands for FY ${fy} first (Payroll → Tax bands).`);
  const run = await tx.payrollRun.findUnique({ where: { month }, include: { slips: true } });
  if (run && run.status !== "DRAFT") throw new PayrollError(`${month} payroll is already ${run.status.toLowerCase()}. Reopen it first.`);
  const r = run ?? (await tx.payrollRun.create({ data: { month, fiscalYear: fy, createdById: owner.id }, include: { slips: true } }));
  const [staff, sheet, commission] = await Promise.all([
    tx.employment.findMany({ where: { active: true }, include: { user: { select: { id: true, role: true } } } }),
    timesheet(month, { all: true }),
    commissionByPerson(month),
  ]);
  const workingDays = workingDaysIn(month, store.people.weeklyOff);
  const keep = new Set<string>();
  for (const e of staff.filter((x) => x.user.role !== "CUSTOMER")) {
    const t = sheet.find((x) => x.userId === e.userId);
    const prev = r.slips.find((s) => s.userId === e.userId);
    const extra = prev?.extraUnpaidDays ?? 0, bonus = prev?.bonus ?? 0;
    const unpaidDays = Math.min(workingDays, (t?.unpaidLeaveDays ?? 0) + extra);
    const earned = commission.get(e.userId) ?? 0;
    const s = computeSlip({ basic: e.basic, allowance: e.allowance, bonus, commission: earned, workingDays, unpaidDays, inSsf: e.inSsf, married: e.married }, year);
    const data = { basic: e.basic, allowance: e.allowance, bonus, commission: earned, workingDays, daysWorked: t?.days ?? 0, leaveDays: t?.leaveDays ?? 0, unpaidDays, extraUnpaidDays: extra, inSsf: e.inSsf, married: e.married, ...slipFields(s) };
    await tx.payslip.upsert({ where: { runId_userId: { runId: r.id, userId: e.userId } }, create: { runId: r.id, userId: e.userId, ...data }, update: data });
    keep.add(e.userId);
  }
  await tx.payslip.deleteMany({ where: { runId: r.id, userId: { notIn: [...keep] } } });
  await audit(tx, owner, { action: run ? "payroll.rebuild" : "payroll.create", entity: ["PayrollRun", r.id], summary: `Payroll ${month} ${run ? "rebuilt" : "drafted"} for ${keep.size} person(s)` });
  return r.id;
}

/** Owner adjusts one slip on a draft: a bonus, extra unpaid days (absences), a note. */
export async function adjustSlip(tx: Tx, owner: Actor, slipId: string, d: { bonus: number; extraUnpaidDays: number; note?: string }) {
  const s = await tx.payslip.findUnique({ where: { id: slipId }, include: { run: true, user: { select: { name: true } } } });
  if (!s) throw new PayrollError("Payslip not found.");
  if (s.run.status !== "DRAFT") throw new PayrollError("Only a draft can be changed. Reopen it first.");
  const year = await taxYearFor(tx, s.run.fiscalYear);
  if (!year?.confirmed) throw new PayrollError(`Confirm the income-tax bands for FY ${s.run.fiscalYear} first.`);
  const timesheetUnpaid = s.unpaidDays - s.extraUnpaidDays;
  const unpaidDays = Math.min(s.workingDays, timesheetUnpaid + d.extraUnpaidDays);
  const c = computeSlip({ basic: s.basic, allowance: s.allowance, bonus: d.bonus, commission: s.commission, workingDays: s.workingDays, unpaidDays, inSsf: s.inSsf, married: s.married }, year);
  await tx.payslip.update({ where: { id: slipId }, data: { bonus: d.bonus, extraUnpaidDays: d.extraUnpaidDays, unpaidDays, note: d.note || null, ...slipFields(c) } });
  await audit(tx, owner, { action: "payroll.adjust", entity: ["Payslip", slipId], summary: `${s.user.name} ${s.run.month}: bonus ${formatPrice(d.bonus)}, ${d.extraUnpaidDays} extra unpaid day(s)${d.note ? ` (${d.note})` : ""}` });
}

export async function approveRun(tx: Tx, owner: Actor, month: string) {
  const r = await tx.payrollRun.findUnique({ where: { month }, include: { _count: { select: { slips: true } } } });
  if (!r) throw new PayrollError("No payroll for that month.");
  if (!r._count.slips) throw new PayrollError("Nobody is on this payroll.");
  const upd = await tx.payrollRun.updateMany({ where: { id: r.id, status: "DRAFT" }, data: { status: "APPROVED", approvedById: owner.id, approvedAt: new Date() } });
  if (!upd.count) throw new PayrollError(`${month} payroll is already ${r.status.toLowerCase()}.`);
  await audit(tx, owner, { action: "payroll.approve", entity: ["PayrollRun", r.id], summary: `Payroll ${month} approved (${r._count.slips} payslip(s))` });
}

export async function reopenRun(tx: Tx, owner: Actor, month: string, reason: string) {
  const r = await tx.payrollRun.findUnique({ where: { month } });
  const upd = r ? await tx.payrollRun.updateMany({ where: { id: r.id, status: "APPROVED" }, data: { status: "DRAFT", approvedAt: null, approvedById: null } }) : { count: 0 };
  if (!r || !upd.count) throw new PayrollError("Only an approved payroll that hasn't been paid can be reopened.");
  await audit(tx, owner, { action: "payroll.reopen", entity: ["PayrollRun", r.id], summary: `Payroll ${month} reopened: ${reason}` });
}

/** Salaries paid: the run is final, and its cost goes to Expenses (P&L) as salaries + employer SSF. */
export async function markPaid(tx: Tx, owner: Actor, month: string, paidVia: string, today = ktmDate()) {
  const r = await tx.payrollRun.findUnique({ where: { month }, include: { slips: true } });
  if (!r) throw new PayrollError("No payroll for that month.");
  const upd = await tx.payrollRun.updateMany({ where: { id: r.id, status: "APPROVED" }, data: { status: "PAID", paidAt: new Date() } });
  if (!upd.count) throw new PayrollError("Approve the payroll before marking it paid.");
  const gross = r.slips.reduce((s, x) => s + x.gross, 0), employer = r.slips.reduce((s, x) => s + x.ssfEmployer, 0);
  const net = r.slips.reduce((s, x) => s + x.net, 0), tds = r.slips.reduce((s, x) => s + x.incomeTax, 0), ssf = r.slips.reduce((s, x) => s + x.ssfEmployee + x.ssfEmployer, 0);
  // cost goes to the location each person works at (split evenly if several; HQ if all/none), so the shop P&L
  // carries its own staff; `source` makes posting twice impossible
  const people = await tx.user.findMany({ where: { id: { in: r.slips.map((x) => x.userId) } }, select: { id: true, allLocations: true, locations: { select: { storeId: true } } } });
  const where = new Map(people.map((p) => [p.id, p.allLocations || !p.locations.length ? [null] : p.locations.map((l) => l.storeId).sort()]));
  const byLoc = new Map<string | null, { gross: number; employer: number; people: number }>();
  for (const x of r.slips) {
    const locs = where.get(x.userId) ?? [null];
    locs.forEach((loc, i) => {
      // even split, the remainder to the first location so nothing is lost to rounding
      const part = (v: number) => Math.floor(v / locs.length) + (i === 0 ? v % locs.length : 0);
      const b = byLoc.get(loc) ?? { gross: 0, employer: 0, people: 0 };
      b.gross += part(x.gross); b.employer += part(x.ssfEmployer); b.people += 1;
      byLoc.set(loc, b);
    });
  }
  const names = new Map((await tx.store.findMany({ where: { id: { in: [...byLoc.keys()].filter((k): k is string => !!k) } }, select: { id: true, name: true } })).map((x) => [x.id, x.name]));
  for (const [loc, b] of [...byLoc.entries()].sort(([a], [z]) => String(a).localeCompare(String(z)))) {
    const at = loc ? names.get(loc) ?? "location" : "HQ";
    await tx.expense.create({ data: { date: today, category: "SALARIES", amount: b.gross, storeId: loc, source: `payroll:${month}:${loc ?? "hq"}:gross`, description: `Payroll ${month}: gross salaries, ${at} (${b.people} people; whole run net ${formatPrice(net)}, TDS ${formatPrice(tds)} to deposit)`, paidVia, createdById: owner.id } });
    if (b.employer) await tx.expense.create({ data: { date: today, category: "SALARIES", amount: b.employer, storeId: loc, source: `payroll:${month}:${loc ?? "hq"}:ssf`, description: `Payroll ${month}: employer SSF 20%, ${at} (deposit ${formatPrice(ssf)} to SSF for the whole run)`, paidVia, createdById: owner.id } });
  }
  await audit(tx, owner, { action: "payroll.paid", entity: ["PayrollRun", r.id], summary: `Payroll ${month} paid via ${paidVia}: net ${formatPrice(net)}, TDS ${formatPrice(tds)}, SSF ${formatPrice(ssf)}; cost ${formatPrice(gross + employer)} posted to expenses` });
  return { gross, employer, net, tds, ssf };
}

export const runTotals = (slips: { gross: number; net: number; incomeTax: number; ssfEmployee: number; ssfEmployer: number }[]) => ({
  people: slips.length,
  gross: slips.reduce((s, x) => s + x.gross, 0),
  net: slips.reduce((s, x) => s + x.net, 0),
  tds: slips.reduce((s, x) => s + x.incomeTax, 0),
  ssfEmployee: slips.reduce((s, x) => s + x.ssfEmployee, 0),
  ssfEmployer: slips.reduce((s, x) => s + x.ssfEmployer, 0),
  cost: slips.reduce((s, x) => s + x.gross + x.ssfEmployer, 0),
});
