import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store } from "./config";
import { ktmDate } from "./pos";
import { canActAt, requireStoreAccess, scopeFor, type Scope } from "./scope";
import { settleByLeave } from "./absences";

// Attendance (clock in/out at a location) and leave (request → manager approves), the record payroll is
// built on. Times are stored UTC; days are Nepal calendar days (ktmDate). One open entry per person: clocking
// in locks the person's row, so two devices can't both start a shift.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class PeopleError extends Error {}

const MIN = 60_000, DAY = 86_400_000;
const cfg = () => store.people;
export const leaveType = (key: string) => cfg().leave.find((l) => l.key === key);
export const leaveNo = (n: number) => `LV-${String(n).padStart(5, "0")}`;

// ---------- attendance ----------

export async function clockIn(tx: Tx, user: Actor, storeId: string, now = new Date()) {
  await requireStoreAccess(user, storeId, tx);
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`; // one clock-in at a time per person
  const open = await tx.attendance.findFirst({ where: { userId: user.id, clockOut: null }, include: { store: { select: { name: true } } } });
  if (open) throw new PeopleError(`You're already clocked in at ${open.store.name} since ${hm(open.clockIn)}.`);
  // the database also allows only one open entry per person (partial unique index), whatever the code does
  try {
    return await tx.attendance.create({ data: { userId: user.id, storeId, clockIn: now } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new PeopleError("You're already clocked in.");
    throw e;
  }
}

export async function clockOut(tx: Tx, user: Actor, now = new Date()) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
  const open = await tx.attendance.findFirst({ where: { userId: user.id, clockOut: null } });
  if (!open) throw new PeopleError("You're not clocked in.");
  return tx.attendance.update({ where: { id: open.id }, data: { clockOut: now } });
}

/** Job: entries left open too long were forgotten clock-outs. Close at zero length and flag for a manager. */
export async function autoCloseForgotten(now = new Date()) {
  const cutoff = new Date(now.getTime() - cfg().autoCloseHours * 3_600_000);
  const stale = await db.attendance.findMany({ where: { clockOut: null, clockIn: { lt: cutoff } }, select: { id: true, clockIn: true } });
  for (const a of stale) await db.attendance.updateMany({ where: { id: a.id, clockOut: null }, data: { clockOut: a.clockIn, autoClosed: true } });
  return { closed: stale.length };
}

/** A manager fixes an entry (forgotten clock-out, wrong time). Never your own; always with a reason. */
export async function correctEntry(tx: Tx, manager: Actor, id: string, d: { clockIn: Date; clockOut: Date; reason: string }) {
  const a = await tx.attendance.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
  if (!a) throw new PeopleError("Entry not found.");
  if (a.userId === manager.id) throw new PeopleError("Someone else has to correct your own hours.");
  await requireStoreAccess(manager, a.storeId, tx);
  if (d.clockOut < d.clockIn) throw new PeopleError("Clock-out is before clock-in.");
  if (d.clockOut.getTime() - d.clockIn.getTime() > 18 * 3_600_000) throw new PeopleError("That's more than 18 hours in one entry.");
  if (d.clockOut.getTime() > Date.now() + 5 * MIN) throw new PeopleError("Clock-out can't be in the future.");
  await tx.attendance.update({ where: { id }, data: { clockIn: d.clockIn, clockOut: d.clockOut, autoClosed: false, editedById: manager.id, editReason: d.reason } });
  await audit(tx, manager, { action: "attendance.correct", entity: ["Attendance", id], summary: `${a.user.name}'s hours corrected: ${hm(a.clockIn)}–${a.clockOut ? hm(a.clockOut) : "open"} → ${hm(d.clockIn)}–${hm(d.clockOut)} (${d.reason})`, changes: { from: { clockIn: a.clockIn, clockOut: a.clockOut }, to: { clockIn: d.clockIn, clockOut: d.clockOut } } });
}

const hm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: store.timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
export const minutesOf = (a: { clockIn: Date; clockOut: Date | null }, now = new Date()) => Math.max(0, Math.round(((a.clockOut ?? now).getTime() - a.clockIn.getTime()) / MIN));

// ---------- leave ----------

/** Working days in an inclusive Nepal date range: every day except the weekly day off. */
export function leaveDays(from: string, to: string) {
  let n = 0;
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY) if (new Date(t).getUTCDay() !== cfg().weeklyOff) n++;
  return n;
}

/** Start (inclusive) of the leave year containing a Nepal date. */
export function leaveYearStart(date: string) {
  const start = `${date.slice(0, 4)}-${cfg().leaveYearStart}`;
  return date >= start ? start : `${Number(date.slice(0, 4)) - 1}-${cfg().leaveYearStart}`;
}

/** Nepal dates on which someone worked at least `presentMinutes`, within [from, to]. */
export async function daysWorked(reader: Tx | typeof db, userId: string, from: string, to: string) {
  const rows = await reader.attendance.findMany({ where: { userId, clockOut: { not: null }, clockIn: { gte: new Date(`${from}T00:00:00+05:45`), lt: new Date(new Date(`${to}T00:00:00+05:45`).getTime() + DAY) } }, select: { clockIn: true, clockOut: true } });
  const perDay = new Map<string, number>();
  for (const r of rows) perDay.set(ktmDate(r.clockIn), (perDay.get(ktmDate(r.clockIn)) ?? 0) + minutesOf(r));
  return [...perDay.values()].filter((m) => m >= cfg().presentMinutes).length;
}

export type Balance = { key: string; label: string; paid: boolean; entitled: number | null; used: number; pending: number; left: number | null; note: string };

/** What someone may still take this leave year, per type. null = no limit (unpaid). */
export async function balances(reader: Tx | typeof db, userId: string, today = ktmDate()): Promise<Balance[]> {
  const yearFrom = leaveYearStart(today);
  const [requests, worked] = await Promise.all([
    reader.leaveRequest.findMany({ where: { userId, status: { in: ["APPROVED", "PENDING"] }, fromDate: { gte: yearFrom } }, select: { type: true, days: true, status: true } }),
    daysWorked(reader, userId, yearFrom, today),
  ]);
  return cfg().leave.map((t) => {
    const used = requests.filter((r) => r.type === t.key && r.status === "APPROVED").reduce((s, r) => s + r.days, 0);
    const pending = requests.filter((r) => r.type === t.key && r.status === "PENDING").reduce((s, r) => s + r.days, 0);
    const entitled = t.accruePerDaysWorked ? Math.min(t.maxBalance ?? Infinity, Math.floor(worked / t.accruePerDaysWorked)) : t.perYear ?? null;
    const note = t.accruePerDaysWorked ? `1 day per ${t.accruePerDaysWorked} days worked (${worked} so far this year)` : t.perYear ? `${t.perYear} a year` : t.perRequest ? `up to ${t.perRequest} days each time` : "no limit";
    return { key: t.key, label: t.label, paid: t.paid, entitled, used, pending, left: entitled == null ? null : entitled - used - pending, note };
  });
}

export async function requestLeave(tx: Tx, user: Actor, d: { type: string; from: string; to: string; reason?: string }, today = ktmDate()) {
  const t = leaveType(d.type);
  if (!t) throw new PeopleError("Choose a leave type.");
  if (d.to < d.from) throw new PeopleError("The last day is before the first.");
  if (d.from < today && d.type !== "SICK") throw new PeopleError("Only sick leave can be asked for after the day.");
  const days = leaveDays(d.from, d.to);
  if (!days) throw new PeopleError("Those dates are all weekly days off.");
  if (t.perRequest && days > t.perRequest) throw new PeopleError(`${t.label} is up to ${t.perRequest} days.`);
  const overlap = await tx.leaveRequest.findFirst({ where: { userId: user.id, status: { in: ["PENDING", "APPROVED"] }, fromDate: { lte: d.to }, toDate: { gte: d.from } }, select: { number: true } });
  if (overlap) throw new PeopleError(`You already have ${leaveNo(overlap.number)} on some of those days.`);
  const b = (await balances(tx, user.id, today)).find((x) => x.key === t.key)!;
  if (b.left != null && days > b.left) throw new PeopleError(`Only ${Math.max(0, b.left)} day(s) of ${t.label.toLowerCase()} left this year.`);
  return tx.leaveRequest.create({ data: { userId: user.id, type: t.key, fromDate: d.from, toDate: d.to, days, reason: d.reason || null } });
}

/** Can this manager decide for that person? Owner/HQ always; otherwise they must share a location. */
export async function managesPerson(reader: Tx | typeof db, manager: Actor, scope: Scope, userId: string) {
  if (scope.all) return true;
  const places = await reader.staffLocation.findMany({ where: { userId }, select: { storeId: true } });
  return places.some((p) => canActAt(scope, p.storeId));
}

export async function decideLeave(tx: Tx, manager: Actor, id: string, approve: boolean, note?: string) {
  const r = await tx.leaveRequest.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, phone: true } } } });
  if (!r) throw new PeopleError("Request not found.");
  if (r.userId === manager.id) throw new PeopleError("Someone else has to decide your own leave.");
  if (!(await managesPerson(tx, manager, await scopeFor(manager, tx), r.userId))) throw new PeopleError(`${r.user.name} doesn't work at any of your locations.`);
  if (r.status !== "PENDING") throw new PeopleError(`${leaveNo(r.number)} is already ${r.status.toLowerCase()}.`);
  const upd = await tx.leaveRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: approve ? "APPROVED" : "REJECTED", decidedById: manager.id, decidedAt: new Date(), decisionNote: note || null } });
  if (!upd.count) throw new PeopleError("Someone else just decided this request.");
  const t = leaveType(r.type);
  const settled = approve ? await settleByLeave(tx, r, manager) : 0; // missed shifts on those days are now leave
  await audit(tx, manager, { action: approve ? "leave.approve" : "leave.reject", entity: ["LeaveRequest", id], summary: `${leaveNo(r.number)} ${r.user.name}: ${t?.label ?? r.type}, ${r.fromDate} to ${r.toDate} (${r.days} day${r.days === 1 ? "" : "s"}) ${approve ? "approved" : "rejected"}${note ? `: ${note}` : ""}${settled ? `; ${settled} missed shift(s) settled as leave` : ""}` });
  if (r.user.phone && /^9[678]\d{8}$/.test(r.user.phone)) {
    await tx.notification.create({ data: { channel: "SMS", template: "leave_decided", to: r.user.phone, body: `${store.name}: your ${t?.label.toLowerCase() ?? "leave"} ${r.fromDate} to ${r.toDate} was ${approve ? "approved" : "not approved"}${note ? ` (${note.slice(0, 60)})` : ""}.` } });
  }
}

export async function cancelLeave(tx: Tx, user: Actor, id: string, today = ktmDate()) {
  const r = await tx.leaveRequest.findUnique({ where: { id } });
  if (!r || r.userId !== user.id) throw new PeopleError("Request not found.");
  if (r.status !== "PENDING" && !(r.status === "APPROVED" && r.fromDate > today)) throw new PeopleError("Only a pending request, or approved leave that hasn't started, can be cancelled.");
  await tx.leaveRequest.update({ where: { id }, data: { status: "CANCELLED" } });
}

// ---------- reports ----------

export type TimesheetRow = { userId: string; name: string; role: string; days: number; minutes: number; entries: number; toFix: number; leaveDays: number; unpaidLeaveDays: number };

/** One month (YYYY-MM, Nepal days) per person: days worked, hours, entries to fix, leave taken. */
export async function timesheet(month: string, scope: Scope): Promise<TimesheetRow[]> {
  const from = new Date(`${month}-01T00:00:00+05:45`);
  const next = new Date(from); next.setUTCMonth(next.getUTCMonth() + 1);
  const where = scope.all ? {} : { storeId: { in: scope.storeIds } };
  const [entries, leave] = await Promise.all([
    db.attendance.findMany({ where: { ...where, clockIn: { gte: from, lt: next } }, include: { user: { select: { name: true, role: true } } } }),
    db.leaveRequest.findMany({
      where: { status: "APPROVED", fromDate: { lte: `${month}-31` }, toDate: { gte: `${month}-01` }, ...(scope.all ? {} : { user: { locations: { some: { storeId: { in: scope.storeIds } } } } }) },
      select: { userId: true, type: true, fromDate: true, toDate: true, user: { select: { name: true, role: true } } },
    }),
  ]);
  const rows = new Map<string, TimesheetRow & { dayMins: Map<string, number> }>();
  for (const e of entries) {
    const r = rows.get(e.userId) ?? { userId: e.userId, name: e.user.name, role: e.user.role, days: 0, minutes: 0, entries: 0, toFix: 0, leaveDays: 0, unpaidLeaveDays: 0, dayMins: new Map() };
    const m = e.clockOut ? minutesOf(e) : 0;
    r.minutes += m; r.entries++;
    if (e.autoClosed || !e.clockOut) r.toFix += e.autoClosed ? 1 : 0;
    r.dayMins.set(ktmDate(e.clockIn), (r.dayMins.get(ktmDate(e.clockIn)) ?? 0) + m);
    rows.set(e.userId, r);
  }
  // people on leave who never clocked in this month still belong on the sheet (and on the payroll)
  for (const l of leave) if (!rows.has(l.userId)) rows.set(l.userId, { userId: l.userId, name: l.user.name, role: l.user.role, days: 0, minutes: 0, entries: 0, toFix: 0, leaveDays: 0, unpaidLeaveDays: 0, dayMins: new Map() });
  for (const r of rows.values()) {
    r.days = [...r.dayMins.values()].filter((m) => m >= cfg().presentMinutes).length;
    for (const l of leave.filter((x) => x.userId === r.userId)) {
      const days = leaveDays(l.fromDate < `${month}-01` ? `${month}-01` : l.fromDate, l.toDate > `${month}-31` ? lastDay(month) : l.toDate);
      r.leaveDays += days;
      if (!leaveType(l.type)?.paid) r.unpaidLeaveDays += days;
    }
  }
  return [...rows.values()].map((r) => ({ userId: r.userId, name: r.name, role: r.role, days: r.days, minutes: r.minutes, entries: r.entries, toFix: r.toFix, leaveDays: r.leaveDays, unpaidLeaveDays: r.unpaidLeaveDays })).sort((a, b) => a.name.localeCompare(b.name));
}

const lastDay = (month: string) => { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
