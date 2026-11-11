import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { profitAndLoss, stockValuation } from "./finance";
import { periodBounds } from "./accounting";
import { tdsAnnual } from "./statutory";
import { payablesSummary } from "./payables";
import { cashPosition } from "./cash";
import { formatPrice } from "./utils";
import { ktmDate } from "./pos";

// The fiscal-year close: the owner signs off a year (Shrawan–Ashadh) once every month in it is closed, every VAT
// period in it is filed, payroll's TDS/SSF is deposited and the bank is explained. The year's dates are the AD
// dates of Shrawan 1 and the last day of Ashadh, set by the accountant (no calendar conversion, as for VAT).
// Months are already locked by their own close, so this is a sign-off with a snapshot, plus the auditor's pack.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class YearError extends Error {}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const addDay = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const monthEnd = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };

export async function startYear(tx: Tx, owner: Actor, d: { label: string; from: string; to: string }) {
  if (!/^\d{4}\/\d{2}$/.test(d.label) || Number(d.label.slice(5)) !== (Number(d.label.slice(0, 4)) + 1) % 100) throw new YearError("Name the year like 2083/84.");
  if (!DATE.test(d.from) || !DATE.test(d.to) || d.from >= d.to) throw new YearError("Give the first and last day of the year.");
  const days = (Date.parse(`${d.to}T00:00:00Z`) - Date.parse(`${d.from}T00:00:00Z`)) / 86_400_000 + 1;
  if (days < 364 || days > 367) throw new YearError("A Nepali year is 365 or 366 days: check the dates.");
  // Shrawan 1 falls in mid-July of the AD year that is 57 years before the BS year
  if (d.from.slice(5, 7) !== "07" || Number(d.from.slice(0, 4)) !== Number(d.label.slice(0, 4)) - 57) throw new YearError(`FY ${d.label} starts in July ${Number(d.label.slice(0, 4)) - 57} (Shrawan 1): check the dates.`);
  const clash = await tx.fiscalYearClose.findFirst({ where: { OR: [{ label: d.label }, { from: { lte: d.to }, to: { gte: d.from } }] }, select: { label: true } });
  if (clash) throw new YearError(`That overlaps FY ${clash.label}.`);
  const y = await tx.fiscalYearClose.create({ data: { ...d, createdById: owner.id } });
  await audit(tx, owner, { action: "year.start", entity: ["FiscalYearClose", y.id], summary: `FY ${d.label} set up (${d.from} to ${d.to})` });
  return y;
}

export type YearCheck = { key: string; label: string; count: number; blocking: boolean; detail?: string; href: string };

/** What stands between a year and its close. */
export async function yearChecklist(label: string) {
  const y = await db.fiscalYearClose.findUnique({ where: { label } });
  if (!y) throw new YearError("Set the year up first.");
  // Gregorian months fully inside the year must be closed; the two edge months (shared with the next/previous year) are warnings
  const months: { month: string; full: boolean }[] = [];
  for (let m = y.from.slice(0, 7); m <= y.to.slice(0, 7); m = addDay(monthEnd(m), 1).slice(0, 7)) months.push({ month: m, full: `${m}-01` >= y.from && monthEnd(m) <= y.to });
  const [closes, vat, statutory, runs, unexplained, unchecked, costless] = await Promise.all([
    db.monthClose.findMany({ where: { month: { in: months.map((m) => m.month) } } }),
    db.vatReturn.findMany({ where: { from: { lte: y.to }, to: { gte: y.from } }, orderBy: { from: "asc" } }),
    db.statutoryDeposit.count({ where: { paidOn: null, run: { fiscalYear: label } } }),
    db.payrollRun.findMany({ where: { fiscalYear: label }, select: { month: true, status: true } }),
    db.statementLine.count({ where: { status: "UNMATCHED", date: { gte: y.from, lte: y.to } } }),
    db.bankDeposit.count({ where: { status: "RECORDED", depositedOn: { gte: y.from, lte: y.to } } }),
    unitsWithoutCost(y.from, y.to),
  ]);
  const closed = new Set(closes.filter((c) => c.closedAt && (!c.reopenedAt || c.reopenedAt < c.closedAt)).map((c) => c.month));
  const openFull = months.filter((m) => m.full && !closed.has(m.month)).map((m) => m.month);
  const openEdge = months.filter((m) => !m.full && !closed.has(m.month)).map((m) => m.month);
  // VAT: filed periods must cover every day of the year, without gaps
  const gaps: string[] = [];
  let cursor = y.from;
  for (const v of vat.filter((v) => v.status === "FILED")) {
    if (v.from > cursor) gaps.push(`${cursor} to ${addDay(v.from, -1)}`);
    if (v.to >= cursor) cursor = addDay(v.to, 1);
  }
  if (cursor <= y.to) gaps.push(`${cursor} to ${y.to}`);
  const vatDrafts = vat.filter((v) => v.status !== "FILED").map((v) => v.label);
  const items: YearCheck[] = [
    { key: "months", label: "Months in the year not closed", count: openFull.length, blocking: true, detail: openFull.join(", "), href: "/admin/finance/close" },
    { key: "vat", label: "Days with no filed VAT return", count: gaps.length, blocking: true, detail: [...gaps, ...vatDrafts.map((l) => `${l} is a draft`)].join("; "), href: "/admin/finance/vat" },
    { key: "statutory", label: "Payroll TDS/SSF not deposited", count: statutory, blocking: true, href: "/admin/payroll/statutory" },
    { key: "bank", label: "Bank statement lines nobody has explained", count: unexplained, blocking: true, href: "/admin/finance/bank" },
    { key: "deposits", label: "Shop deposits not checked against the bank", count: unchecked, blocking: true, href: "/admin/cash" },
    { key: "edges", label: "Edge months (shared with the next or previous year) not closed", count: openEdge.length, blocking: false, detail: openEdge.join(", "), href: "/admin/finance/close" },
    { key: "payroll", label: "Payroll months in the year not paid", count: runs.filter((r) => r.status !== "PAID").length, blocking: false, detail: runs.filter((r) => r.status !== "PAID").map((r) => r.month).join(", "), href: "/admin/payroll" },
    { key: "costless", label: "Units sold with no purchase cost (profit overstated)", count: costless, blocking: false, href: "/admin/finance" },
  ];
  return { year: y, items, blocking: items.filter((i) => i.blocking && i.count).length, warnings: items.filter((i) => !i.blocking && i.count).length };
}

/** Units sold in the period (not cancelled) whose line had no purchase cost: same rule as the P&L's warning. */
async function unitsWithoutCost(from: string, to: string) {
  const { start, end } = periodBounds({ from, to });
  const [r] = await db.$queryRaw<{ n: number }[]>`SELECT COALESCE(SUM(oi."quantity"), 0)::int AS "n" FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
    WHERE oi."unitCost" IS NULL AND o."status" <> 'CANCELLED' AND o."createdAt" >= (${start}::timestamptz AT TIME ZONE 'UTC') AND o."createdAt" < (${end}::timestamptz AT TIME ZONE 'UTC')`;
  return r.n;
}

async function yearPl(from: string, to: string) {
  const { start, end } = periodBounds({ from, to });
  return profitAndLoss(start, end, from, addDay(to, 1));
}

/** The auditor's pack: the year's P&L by month, VAT and TDS totals, and balances as they stand. */
export async function yearPack(label: string) {
  const y = await db.fiscalYearClose.findUnique({ where: { label } });
  if (!y) throw new YearError("Set the year up first.");
  const parts: { label: string; from: string; to: string }[] = [];
  for (let m = y.from.slice(0, 7); m <= y.to.slice(0, 7); m = addDay(monthEnd(m), 1).slice(0, 7)) {
    const from = `${m}-01` < y.from ? y.from : `${m}-01`, to = monthEnd(m) > y.to ? y.to : monthEnd(m);
    parts.push({ label: from === `${m}-01` && to === monthEnd(m) ? m : `${m} (${from.slice(8)}–${to.slice(8)})`, from, to });
  }
  const [monthly, vat, tds, stock, payables, cash] = await Promise.all([
    Promise.all(parts.map(async (p) => ({ ...p, pl: await yearPl(p.from, p.to) }))),
    db.vatReturn.findMany({ where: { from: { lte: y.to }, to: { gte: y.from } }, orderBy: { from: "asc" } }),
    tdsAnnual(label),
    stockValuation(),
    payablesSummary(),
    cashPosition({ all: true }),
  ]);
  // the months don't overlap and cover the year, so the year's figures are their sums (one pass over the year, not two)
  const add = (k: "netSales" | "cogs" | "grossProfit" | "deliveryIncome" | "totalExpenses" | "netProfit" | "unitsWithoutCost" | "orders") => monthly.reduce((a, m) => a + m.pl[k], 0);
  const total = { netSales: add("netSales"), cogs: add("cogs"), grossProfit: add("grossProfit"), deliveryIncome: add("deliveryIncome"), totalExpenses: add("totalExpenses"), netProfit: add("netProfit"), unitsWithoutCost: add("unitsWithoutCost"), orders: add("orders") };
  return {
    year: y, total, monthly,
    vat: { returns: vat, output: vat.reduce((a, v) => a + v.outputVat, 0), input: vat.reduce((a, v) => a + v.inputVat, 0), paid: vat.reduce((a, v) => a + (v.paidAmount ?? 0), 0) },
    tds: tds.total, stock: { atCost: stock.atCost, units: stock.units }, payables: { owed: payables.owed, overdue: payables.overdue },
    cash: { safes: cash.reduce((a, r) => a + r.balance, 0), tills: cash.reduce((a, r) => a + r.inTills, 0) },
  };
}

export async function closeYear(tx: Tx, owner: Actor, label: string, opts: { acceptWarnings: boolean }, now = new Date()) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`year-close:${label}`}))`;
  const c = await yearChecklist(label);
  if (c.year.closedAt && (!c.year.reopenedAt || c.year.reopenedAt < c.year.closedAt)) throw new YearError(`FY ${label} is already closed.`);
  if (c.year.to >= ktmDate(now)) throw new YearError("The year hasn't ended yet.");
  if (c.blocking) throw new YearError(`Clear these first: ${c.items.filter((i) => i.blocking && i.count).map((i) => i.label).join("; ")}.`);
  if (c.warnings && !opts.acceptWarnings) throw new YearError("Read the warnings and confirm to close anyway.");
  const pack = await yearPack(label);
  const snapshot = { checklist: c.items.map(({ key, label: l, count }) => ({ key, label: l, count })), pl: { netSales: pack.total.netSales, grossProfit: pack.total.grossProfit, expenses: pack.total.totalExpenses, netProfit: pack.total.netProfit }, vat: { output: pack.vat.output, input: pack.vat.input, paid: pack.vat.paid }, tds: pack.tds, stock: pack.stock, payables: pack.payables, cash: pack.cash } as Prisma.InputJsonValue;
  await tx.fiscalYearClose.update({ where: { label }, data: { closedAt: now, closedById: owner.id, closedByName: owner.name, snapshot } });
  await audit(tx, owner, { action: "year.close", entity: ["FiscalYearClose", c.year.id], summary: `FY ${label} closed: net sales ${formatPrice(pack.total.netSales)}, net profit ${formatPrice(pack.total.netProfit)}, VAT paid ${formatPrice(pack.vat.paid)}, TDS ${formatPrice(pack.tds.tds)}` });
}

export async function reopenYear(tx: Tx, owner: Actor, label: string, reason: string, now = new Date()) {
  if (!reason.trim()) throw new YearError("Say why the year is being reopened.");
  const y = await tx.fiscalYearClose.findUnique({ where: { label } });
  if (!y?.closedAt || (y.reopenedAt && y.reopenedAt > y.closedAt)) throw new YearError(`FY ${label} isn't closed.`);
  await tx.fiscalYearClose.update({ where: { label }, data: { reopenedAt: now, reopenReason: reason.trim().slice(0, 300) } });
  await audit(tx, owner, { action: "year.reopen", entity: ["FiscalYearClose", y.id], summary: `FY ${label} reopened: ${reason.trim().slice(0, 150)}` });
}
