import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { monthBounds, profitAndLoss } from "./finance";
import { ktmDate } from "./pos";
import { formatPrice } from "./utils";

// Month-end close. The owner closes a finished month once its books are complete: nothing blocking (open tills,
// statement lines nobody explained, deposits nobody checked), warnings read. A closed month is locked in the
// database (triggers on expenses, supplier bills and payments: see the month_lock migration), so no code path
// can add or change what it owes or spent; the app checks first to give a clear message. Reopening needs a reason
// and is logged; closing again records a fresh snapshot.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class CloseError extends Error {}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const isClosedRow = (c: { closedAt: Date | null; reopenedAt: Date | null } | null) => !!c?.closedAt && (!c.reopenedAt || c.reopenedAt < c.closedAt);

export async function isMonthClosed(month: string, reader: Tx | typeof db = db) {
  return isClosedRow(await reader.monthClose.findUnique({ where: { month }, select: { closedAt: true, reopenedAt: true } }));
}

/** Refuse a change dated in a closed month (date "YYYY-MM-DD", a Date, or a month). The database refuses too. */
export async function assertMonthOpen(reader: Tx | typeof db, when: string | Date, what = "this") {
  const month = typeof when === "string" ? when.slice(0, 7) : ktmDate(when).slice(0, 7);
  if (await isMonthClosed(month, reader)) throw new CloseError(`${month} is closed, so ${what} can't be added or changed there. Reopen the month first (Finance → Month-end close).`);
}

export type CheckItem = { key: string; label: string; count: number; blocking: boolean; href: string };

/** What stands between a month and closing it. */
export async function closeChecklist(month: string) {
  if (!MONTH.test(month)) throw new CloseError("Months are YYYY-MM.");
  const { start, end, next } = monthBounds(month);
  const from = `${month}-01`, to = `${next}-01`;
  const [openShifts, unmatched, unchecked, payroll, latestStatement, salesDays, closedDays, pl] = await Promise.all([
    db.shift.count({ where: { status: "OPEN", openedAt: { lt: end } } }),
    db.statementLine.count({ where: { status: "UNMATCHED", date: { gte: from, lt: to } } }),
    db.bankDeposit.count({ where: { status: "RECORDED", depositedOn: { gte: from, lt: to } } }),
    db.payrollRun.findUnique({ where: { month }, select: { status: true } }),
    db.statementLine.aggregate({ _max: { date: true } }),
    // shop days with till sales, and the ones that were closed and locked
    db.$queryRaw<{ n: number }[]>`SELECT COUNT(DISTINCT (sh."storeId", to_char((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD')))::int AS "n"
      FROM "Order" o JOIN "Shift" sh ON sh."id" = o."shiftId"
      WHERE o."createdAt" >= (${start}::timestamptz AT TIME ZONE 'UTC') AND o."createdAt" < (${end}::timestamptz AT TIME ZONE 'UTC')`,
    db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS "n" FROM "DayClose" d WHERE d."date" >= ${from} AND d."date" < ${to}
      AND EXISTS (SELECT 1 FROM "Order" o JOIN "Shift" sh ON sh."id" = o."shiftId" WHERE sh."storeId" = d."storeId"
        AND to_char((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD') = d."date")`,
    profitAndLoss(start, end, from, to),
  ]);
  const lastDay = new Date(Date.parse(`${to}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const items: CheckItem[] = [
    { key: "shifts", label: "Till shifts still open", count: openShifts, blocking: true, href: "/admin/closing" },
    { key: "statement", label: "Bank statement lines nobody has explained", count: unmatched, blocking: true, href: "/admin/finance/bank" },
    { key: "deposits", label: "Shop deposits not yet checked against the bank", count: unchecked, blocking: true, href: "/admin/cash" },
    { key: "days", label: "Shop days with sales not closed and locked", count: Math.max(0, (salesDays[0]?.n ?? 0) - (closedDays[0]?.n ?? 0)), blocking: false, href: "/admin/closing" },
    { key: "payroll", label: payroll ? `Payroll is ${payroll.status.toLowerCase()}, not paid` : "No payroll run for the month", count: payroll?.status === "PAID" ? 0 : 1, blocking: false, href: "/admin/payroll" },
    { key: "statementEnd", label: `No bank statement up to the month's last day (${lastDay})`, count: !latestStatement._max.date || latestStatement._max.date < lastDay ? 1 : 0, blocking: false, href: "/admin/finance/bank" },
    { key: "costless", label: "Units sold with no purchase cost (profit overstated)", count: pl.unitsWithoutCost, blocking: false, href: "/admin/finance" },
  ];
  return { month, items, blocking: items.filter((i) => i.blocking && i.count > 0).length, warnings: items.filter((i) => !i.blocking && i.count > 0).length, pl };
}

/** Close a finished month. Blocking items must be cleared; warnings must be acknowledged. */
export async function closeMonth(tx: Tx, owner: Actor, month: string, opts: { acceptWarnings: boolean }, now = new Date()) {
  if (!MONTH.test(month)) throw new CloseError("Months are YYYY-MM.");
  if (month >= ktmDate(now).slice(0, 7)) throw new CloseError("Only a finished month can be closed.");
  const c = await closeChecklist(month);
  if (c.blocking) throw new CloseError(`Clear these first: ${c.items.filter((i) => i.blocking && i.count).map((i) => `${i.label} (${i.count})`).join("; ")}.`);
  if (c.warnings && !opts.acceptWarnings) throw new CloseError("Read the warnings and confirm to close anyway.");
  // lock the row (or its absence) so two closes at once can't both write
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`month-close:${month}`}))`;
  const existing = await tx.monthClose.findUnique({ where: { month } });
  if (isClosedRow(existing)) throw new CloseError(`${month} is already closed.`);
  const snapshot = { checklist: c.items.map(({ key, label, count }) => ({ key, label, count })), pl: { netSales: c.pl.netSales, cogs: c.pl.cogs, grossProfit: c.pl.grossProfit, expenses: c.pl.totalExpenses, netProfit: c.pl.netProfit, orders: c.pl.orders } } as Prisma.InputJsonValue;
  if (existing) await tx.monthClose.update({ where: { month }, data: { closedAt: now, closedById: owner.id, closedByName: owner.name, snapshot, closes: { increment: 1 } } });
  else await tx.monthClose.create({ data: { month, closedAt: now, closedById: owner.id, closedByName: owner.name, snapshot } });
  await audit(tx, owner, { action: "month.close", entity: ["MonthClose", month], summary: `${month} closed: net sales ${formatPrice(c.pl.netSales)}, net profit ${formatPrice(c.pl.netProfit)}${c.warnings ? ` (${c.warnings} warning(s) accepted)` : ""}` });
}

export async function reopenMonth(tx: Tx, owner: Actor, month: string, reason: string, now = new Date()) {
  if (!reason.trim()) throw new CloseError("Say why the month is being reopened.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`month-close:${month}`}))`;
  const c = await tx.monthClose.findUnique({ where: { month } });
  if (!isClosedRow(c)) throw new CloseError(`${month} isn't closed.`);
  await tx.monthClose.update({ where: { month }, data: { reopenedAt: now, reopenReason: reason.trim().slice(0, 300) } });
  await audit(tx, owner, { action: "month.reopen", entity: ["MonthClose", month], summary: `${month} reopened: ${reason.trim().slice(0, 150)}` });
}

/** The last 12 months with their state, newest first. */
export async function closeOverview(now = new Date()) {
  const thisMonth = ktmDate(now).slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => { const [y, m] = thisMonth.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 - i, 1)); return d.toISOString().slice(0, 7); });
  const rows = await db.monthClose.findMany({ where: { month: { in: months } } });
  const by = new Map(rows.map((r) => [r.month, r]));
  return months.map((m) => { const r = by.get(m) ?? null; return { month: m, current: m === thisMonth, closed: isClosedRow(r), row: r }; });
}
