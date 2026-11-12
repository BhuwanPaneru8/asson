import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store } from "./config";
import { ktmDate } from "./pos";
import { addDays, rosterVsActual, shiftLabel } from "./rosters";
import { balances, leaveDays, leaveNo, leaveType } from "./people";
import { canActAt, scopeFor, type Scope } from "./scope";

// Absences: a published shift that ended with no clock-in becomes an Absence for a manager to decide, so
// no-shows reach payroll without anyone retyping them. The hourly job finds them (idempotent: one per shift);
// a manager at that location decides:
//   UNPAID: a day's pay comes off that month's payroll (the person gets an SMS),
//   LEAVE:  booked as approved leave of a chosen type, from the person's balance (sick, home…),
//   WORKED: they were there and forgot to clock in; an attendance entry for the shift is added.
// Approving leave that covers an open absence settles it as LEAVE. Payroll won't approve a month that still
// has open absences, and a decision can't change a month whose payroll is approved or paid.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class AbsenceError extends Error {}

export type Decision = "UNPAID" | "LEAVE" | "WORKED";
export const DECISION_LABEL: Record<"OPEN" | Decision, string> = { OPEN: "To decide", UNPAID: "Unpaid", LEAVE: "Taken as leave", WORKED: "Worked (forgot to clock in)" };

const at = (date: string, time: string) => new Date(`${date}T${time}:00+05:45`);
const fmt = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const validPhone = (p: string | null | undefined): p is string => !!p && /^9[678]\d{8}$/.test(p);

/** Job: published shifts in the last `days` days that ended with no clock-in become open absences. */
export async function findNoShows(now = new Date(), days = 7) {
  const today = ktmDate(now);
  const { rows } = await rosterVsActual(null, addDays(today, -days), today, now);
  const missed = rows.filter((r) => r.result === "no-show");
  if (!missed.length) return { found: 0 };
  const [known, shifts, leave] = await Promise.all([
    db.absence.findMany({ where: { shiftId: { in: missed.map((r) => r.id) } }, select: { shiftId: true } }),
    db.rosterShift.findMany({ where: { id: { in: missed.map((r) => r.id) } }, select: { id: true, start: true, end: true } }),
    // leave approved after the roster was made: they were on leave, not absent
    db.leaveRequest.findMany({ where: { status: "APPROVED", userId: { in: [...new Set(missed.map((r) => r.userId))] }, toDate: { gte: addDays(today, -days) } }, select: { userId: true, fromDate: true, toDate: true } }),
  ]);
  const seen = new Set(known.map((k) => k.shiftId));
  const times = new Map(shifts.map((s) => [s.id, s]));
  const data = missed
    .filter((r) => !seen.has(r.id) && times.has(r.id) && !leave.some((l) => l.userId === r.userId && l.fromDate <= r.date && l.toDate >= r.date))
    .map((r) => ({ shiftId: r.id, userId: r.userId, storeId: r.storeId, date: r.date, start: times.get(r.id)!.start, end: times.get(r.id)!.end }));
  const { count } = await db.absence.createMany({ data, skipDuplicates: true }); // the unique shiftId makes a second run harmless
  return { found: count };
}

/** Payroll for the month of `date` must still be open (no run, or a draft) for an absence on it to change. */
async function payrollOpen(tx: Tx, date: string) {
  const month = date.slice(0, 7);
  const run = await tx.payrollRun.findUnique({ where: { month }, select: { status: true } });
  if (run?.status === "APPROVED") throw new AbsenceError(`${month} payroll is approved. The owner has to reopen it before this can change.`);
  if (run?.status === "PAID") throw new AbsenceError(`${month} payroll is already paid. Add it to next month's payroll as extra unpaid days instead.`);
}

async function load(tx: Tx, manager: Actor, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Absence" WHERE "id" = ${id} FOR UPDATE`; // two managers can't decide it at once
  const a = await tx.absence.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, phone: true } }, store: { select: { name: true } } } });
  if (!a) throw new AbsenceError("Absence not found.");
  if (a.userId === manager.id) throw new AbsenceError("Someone else has to decide your own absence.");
  if (!canActAt(await scopeFor(manager, tx), a.storeId)) throw new AbsenceError(`You don't manage ${a.store.name}.`);
  return a;
}

export async function decideAbsence(tx: Tx, manager: Actor, id: string, d: { decision: Decision; leaveType?: string; note?: string }, today = ktmDate()) {
  const a = await load(tx, manager, id);
  if (a.status !== "OPEN") throw new AbsenceError(`This absence is already decided: ${DECISION_LABEL[a.status].toLowerCase()}.`);
  await payrollOpen(tx, a.date);
  const note = d.note?.trim().slice(0, 200) || null;
  const what = `${a.user.name}, ${fmt(a.date)} ${shiftLabel(a)} at ${a.store.name}`;
  let leaveRequestId: string | null = null;
  let summary: string;

  if (d.decision === "LEAVE") {
    const t = leaveType(d.leaveType ?? "");
    if (!t) throw new AbsenceError("Choose the kind of leave.");
    if (!leaveDays(a.date, a.date)) throw new AbsenceError("That was their weekly day off, so it can't be leave. Choose unpaid or worked.");
    const overlap = await tx.leaveRequest.findFirst({ where: { userId: a.userId, status: { in: ["PENDING", "APPROVED"] }, fromDate: { lte: a.date }, toDate: { gte: a.date } }, select: { number: true, status: true } });
    if (overlap) throw new AbsenceError(`${a.user.name} already has ${leaveNo(overlap.number)} (${overlap.status.toLowerCase()}) on that day. Decide that request instead.`);
    const b = (await balances(tx, a.userId, today)).find((x) => x.key === t.key)!;
    if (b.left != null && b.left < 1) throw new AbsenceError(`${a.user.name} has no ${t.label.toLowerCase()} left this year.`);
    const lr = await tx.leaveRequest.create({ data: { userId: a.userId, type: t.key, fromDate: a.date, toDate: a.date, days: 1, reason: `Missed shift booked as leave${note ? `: ${note}` : ""}`, status: "APPROVED", decidedById: manager.id, decidedAt: new Date(), decisionNote: note } });
    leaveRequestId = lr.id;
    summary = `${what}: taken as ${t.label.toLowerCase()} (${leaveNo(lr.number)})`;
  } else if (d.decision === "WORKED") {
    if (!note || note.length < 3) throw new AbsenceError("Say how you know they worked, for the record.");
    // the attendance record payroll and leave accrual read; marked as a manager's correction
    await tx.attendance.create({ data: { userId: a.userId, storeId: a.storeId, clockIn: at(a.date, a.start), clockOut: at(a.date, a.end), editedById: manager.id, editReason: `Forgot to clock in: ${note}` } });
    summary = `${what}: worked, forgot to clock in (${note})`;
  } else if (d.decision === "UNPAID") {
    summary = `${what}: unpaid absence${note ? ` (${note})` : ""}`;
  } else throw new AbsenceError("Choose what happened.");

  const upd = await tx.absence.updateMany({ where: { id, status: "OPEN" }, data: { status: d.decision, leaveRequestId, decidedById: manager.id, decidedAt: new Date(), note } });
  if (!upd.count) throw new AbsenceError("Someone else just decided this absence.");
  await audit(tx, manager, { action: `absence.${d.decision.toLowerCase()}`, entity: ["Absence", id], summary });
  if (d.decision === "UNPAID" && validPhone(a.user.phone)) {
    await tx.notification.create({ data: { channel: "SMS", template: "absence_unpaid", to: a.user.phone, body: `${store.name}: you missed your shift on ${fmt(a.date)} at ${a.store.name}. It is recorded as an unpaid day. Talk to your manager if this is wrong.` } });
  }
}

/** A manager takes back an unpaid or leave decision (a mistake, proof arrived late). Worked can't be undone here:
 * the attendance entry it added is corrected on the People page like any other. */
export async function reopenAbsence(tx: Tx, manager: Actor, id: string, reason: string) {
  const a = await load(tx, manager, id);
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new AbsenceError("Say why, for the record.");
  if (a.status === "OPEN") throw new AbsenceError("This absence is still to decide.");
  if (a.status === "WORKED") throw new AbsenceError("A worked day added an attendance entry. Correct that entry on the People page instead.");
  await payrollOpen(tx, a.date);
  if (a.leaveRequestId) await tx.leaveRequest.update({ where: { id: a.leaveRequestId }, data: { status: "CANCELLED", decisionNote: `Absence decision taken back: ${why}` } });
  await tx.absence.update({ where: { id }, data: { status: "OPEN", leaveRequestId: null, decidedById: null, decidedAt: null, note: null } });
  await audit(tx, manager, { action: "absence.reopen", entity: ["Absence", id], summary: `${a.user.name}, ${fmt(a.date)} at ${a.store.name}: ${DECISION_LABEL[a.status].toLowerCase()} taken back (${why})` });
}

/** Leave approved for days someone had already missed (sick leave asked for afterwards) settles those absences. */
export async function settleByLeave(tx: Tx, leave: { id: string; userId: string; fromDate: string; toDate: string }, by: Actor) {
  const open = await tx.absence.findMany({ where: { userId: leave.userId, status: "OPEN", date: { gte: leave.fromDate, lte: leave.toDate } }, select: { id: true } });
  if (!open.length) return 0;
  await tx.absence.updateMany({ where: { id: { in: open.map((o) => o.id) }, status: "OPEN" }, data: { status: "LEAVE", leaveRequestId: leave.id, decidedById: by.id, decidedAt: new Date(), note: "Leave approved for the day" } });
  return open.length;
}

/** Payroll: unpaid absences per person in a month (YYYY-MM), and how many are still undecided. */
export async function absencesForPayroll(reader: Tx | typeof db, month: string) {
  const rows = await reader.absence.groupBy({ by: ["userId", "status"], where: { date: { gte: `${month}-01`, lte: `${month}-31` }, status: { in: ["UNPAID", "OPEN"] } }, _count: { _all: true } });
  const unpaid = new Map<string, number>();
  let open = 0;
  for (const r of rows) {
    if (r.status === "UNPAID") unpaid.set(r.userId, r._count._all);
    else open += r._count._all;
  }
  return { unpaid, open };
}

/** The Absences page: what's open at the viewer's locations, and the recent decisions. */
export async function absenceList(scope: Scope, today = ktmDate(), days = 45) {
  const where = scope.all ? {} : { storeId: { in: scope.storeIds } };
  const include = { user: { select: { name: true } }, store: { select: { name: true, code: true } }, leaveRequest: { select: { type: true, number: true } } } as const;
  const [open, decided] = await Promise.all([
    db.absence.findMany({ where: { ...where, status: "OPEN" }, orderBy: [{ date: "asc" }, { start: "asc" }], include }),
    db.absence.findMany({ where: { ...where, status: { not: "OPEN" }, date: { gte: addDays(today, -days) } }, orderBy: [{ date: "desc" }, { decidedAt: "desc" }], take: 200, include }),
  ]);
  const ids = [...new Set(decided.map((a) => a.decidedById).filter((x): x is string => !!x))];
  const deciders = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(deciders.map((u) => [u.id, u.name]));
  const shape = (a: (typeof open)[number]) => ({
    id: a.id, userId: a.userId, name: a.user.name, store: a.store.name, storeCode: a.store.code, date: a.date, day: fmt(a.date), label: shiftLabel(a), status: a.status,
    leave: a.leaveRequest ? `${leaveType(a.leaveRequest.type)?.label ?? a.leaveRequest.type} · ${leaveNo(a.leaveRequest.number)}` : null,
    note: a.note, decidedBy: a.decidedById ? names.get(a.decidedById) ?? null : null, decidedAt: a.decidedAt,
  });
  return { open: open.map(shape), decided: decided.map(shape) };
}

/** A person's own absences (their Time page): what was recorded and how it was decided. */
export async function myAbsences(userId: string, today = ktmDate(), days = 60) {
  const rows = await db.absence.findMany({ where: { userId, date: { gte: addDays(today, -days) } }, orderBy: { date: "desc" }, include: { store: { select: { name: true } } } });
  return rows.map((a) => ({ id: a.id, day: fmt(a.date), date: a.date, store: a.store.name, label: shiftLabel(a), status: a.status }));
}
