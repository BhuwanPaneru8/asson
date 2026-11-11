import "server-only";
import type { Prisma, StatutoryKind } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store as storeCfg } from "./config";
import { ktmDate } from "./pos";
import { formatPrice } from "./utils";

// Statutory deposits from payroll: once a month's salaries are paid, the income tax withheld (TDS) is owed to
// the IRD and the SSF contributions (employee + employer) to the Social Security Fund, by
// `store.statutoryDueDays` after the month ends. Finance records each deposit (or it's matched from the bank
// statement). The annual TDS report per employee feeds the e-TDS filing.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class StatutoryError extends Error {}

export const KIND_LABEL: Record<StatutoryKind, string> = { TDS: "Salary TDS (IRD)", SSF: "SSF contributions" };

export const dueOnFor = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, storeCfg.statutoryDueDays)).toISOString().slice(0, 10); // day N of the next month
};

/** Called in the same transaction that marks a payroll paid. Safe to call twice (unique per run and kind). */
export async function createForRun(tx: Tx, runId: string, month: string) {
  const slips = await tx.payslip.aggregate({ where: { runId }, _sum: { incomeTax: true, ssfEmployee: true, ssfEmployer: true } });
  const tds = slips._sum.incomeTax ?? 0, ssf = (slips._sum.ssfEmployee ?? 0) + (slips._sum.ssfEmployer ?? 0);
  const dueOn = dueOnFor(month);
  const rows = [...(tds > 0 ? [{ runId, kind: "TDS" as const, amount: tds, dueOn }] : []), ...(ssf > 0 ? [{ runId, kind: "SSF" as const, amount: ssf, dueOn }] : [])];
  if (rows.length) await tx.statutoryDeposit.createMany({ data: rows, skipDuplicates: true });
  return { tds, ssf, dueOn };
}

export async function recordDeposit(tx: Tx, finance: Actor, id: string, d: { paidOn: string; amount: number; reference: string }, now = new Date()) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "StatutoryDeposit" WHERE "id" = ${id} FOR UPDATE`;
  if (!row) throw new StatutoryError("Not found.");
  const s = await tx.statutoryDeposit.findUniqueOrThrow({ where: { id }, include: { run: { select: { month: true } } } });
  if (s.paidOn) throw new StatutoryError("Already recorded as deposited.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.paidOn) || d.paidOn > ktmDate(now)) throw new StatutoryError("Enter the deposit date (not in the future).");
  if (!Number.isInteger(d.amount) || d.amount <= 0) throw new StatutoryError("Enter the amount deposited.");
  if (!d.reference.trim()) throw new StatutoryError("Enter the voucher or challan number.");
  await tx.statutoryDeposit.update({ where: { id }, data: { paidOn: d.paidOn, paidAmount: d.amount, reference: d.reference.trim().slice(0, 80), paidById: finance.id } });
  await audit(tx, finance, { action: "statutory.deposit", entity: ["StatutoryDeposit", id], summary: `${KIND_LABEL[s.kind]} for ${s.run.month}: ${formatPrice(d.amount)} deposited ${d.paidOn} (${d.reference.trim()})${d.amount !== s.amount ? `; owed ${formatPrice(s.amount)}` : ""}${d.paidOn > s.dueOn ? " — LATE" : ""}` });
}

/** Everything owed, oldest first: due, overdue, deposited (and whether the bank shows it). */
export async function statutoryOverview(now = new Date()) {
  const today = ktmDate(now);
  const rows = await db.statutoryDeposit.findMany({ orderBy: [{ dueOn: "desc" }, { kind: "asc" }], take: 48, include: { run: { select: { month: true, fiscalYear: true } }, statementLine: { select: { date: true } } } });
  return rows.map((r) => ({ ...r, state: r.paidOn ? (r.paidOn > r.dueOn ? "paid late" : "paid") : today > r.dueOn ? "overdue" : "due" }));
}

/** Per employee for a fiscal year (from payroll runs of that year): PAN, gross, SSF and tax withheld, by month. */
export async function tdsAnnual(fiscalYear: string) {
  const slips = await db.payslip.findMany({
    where: { run: { fiscalYear, status: "PAID" } },
    select: { gross: true, ssfEmployee: true, incomeTax: true, run: { select: { month: true } }, user: { select: { id: true, name: true, employment: { select: { pan: true } } } } },
    orderBy: { run: { month: "asc" } },
  });
  const by = new Map<string, { name: string; pan: string; months: number; gross: number; ssf: number; tds: number }>();
  for (const s of slips) {
    const r = by.get(s.user.id) ?? { name: s.user.name, pan: s.user.employment?.pan ?? "", months: 0, gross: 0, ssf: 0, tds: 0 };
    r.months++; r.gross += s.gross; r.ssf += s.ssfEmployee; r.tds += s.incomeTax;
    by.set(s.user.id, r);
  }
  const rows = [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { fiscalYear, rows, missingPan: rows.filter((r) => !r.pan && r.tds > 0).length, total: rows.reduce((a, r) => ({ gross: a.gross + r.gross, ssf: a.ssf + r.ssf, tds: a.tds + r.tds }), { gross: 0, ssf: 0, tds: 0 }) };
}
