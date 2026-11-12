import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store as storeCfg } from "./config";
import { ktmDate } from "./pos";
import { requireStoreAccess, type Scope } from "./scope";

// Rosters: who works where and when. A manager plans a location's week (Sunday to Saturday, Nepal dates) as
// one shift per person per day, typed like "10-18". People can only be rostered where they're assigned, never on
// approved leave, and never at two locations on one day (unique per person and date). The week is checked
// against the Labour Act (8 hours a day, 48 a week, a day off each week) and the location's minimum staff; those
// are warnings, not blocks (overtime is legal with consent and pay). Staff see their shifts once the week is
// published. Afterwards the plan is compared with clock-ins: on time, late, left early, no-show.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class RosterError extends Error {}

const DAY = 86_400_000;
const cfg = () => storeCfg.people;
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => iso(utc(date) + n * DAY);
/** The Sunday a Nepal week starts on. */
export const weekStartOf = (date: string) => addDays(date, -new Date(utc(date)).getUTCDay());
export const weekDates = (weekStart: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
export const weekdayOf = (date: string) => WEEKDAY[new Date(utc(date)).getUTCDay()];
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(utc(s)) === s;

const pad = (n: number) => String(n).padStart(2, "0");
function parseTime(raw: string) {
  const m = raw.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2] ?? 0);
  return h <= 23 && min <= 59 ? `${pad(h)}:${pad(min)}` : null;
}
/** "10-18", "9:30-17", "10.00 – 18.30" → { start, end }. Empty or "off" → null. */
export function parseShift(raw: string): { start: string; end: string } | null {
  const v = raw.trim().toLowerCase();
  if (!v || v === "off" || v === "-") return null;
  const parts = v.split(/\s*(?:-|–|to)\s*/);
  const start = parts.length === 2 ? parseTime(parts[0]) : null, end = parts.length === 2 ? parseTime(parts[1]) : null;
  if (!start || !end) throw new RosterError(`“${raw.trim()}” isn't a shift: write it like 10-18 or 9:30-17:30.`);
  if (end <= start) throw new RosterError(`${raw.trim()}: the shift ends before it starts (shifts can't cross midnight).`);
  return { start, end };
}
export const shiftMinutes = (s: { start: string; end: string }) => { const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)); return m(s.end) - m(s.start); };
export const shiftLabel = (s: { start: string; end: string }) => `${s.start.replace(/:00$/, "").replace(/^0/, "")}–${s.end.replace(/:00$/, "").replace(/^0/, "")}`;
const at = (date: string, time: string) => new Date(`${date}T${time}:00+05:45`);

function checkWeekStart(weekStart: string) {
  if (!isDate(weekStart) || new Date(utc(weekStart)).getUTCDay() !== 0) throw new RosterError("A roster week starts on a Sunday.");
}

// ---------- reading a week ----------

export type Warning = { kind: "hours" | "day" | "dayoff" | "pending-leave" | "short"; text: string };

/** Everything the planner shows for one location's week, with the Labour Act and staffing checks. */
export async function rosterWeek(storeId: string, weekStart: string) {
  checkWeekStart(weekStart);
  const dates = weekDates(weekStart), weekEnd = dates[6];
  const [store, assigned, here, holidays, published] = await Promise.all([
    db.store.findUniqueOrThrow({ where: { id: storeId }, select: { id: true, name: true, minStaff: true } }),
    db.staffLocation.findMany({ where: { storeId, user: { role: { not: "CUSTOMER" } } }, select: { user: { select: { id: true, name: true, role: true } } } }),
    db.rosterShift.findMany({ where: { storeId, date: { gte: weekStart, lte: weekEnd } } }),
    db.holiday.findMany({ where: { date: { gte: weekStart, lte: weekEnd } } }),
    db.rosterWeek.findUnique({ where: { storeId_weekStart: { storeId, weekStart } } }),
  ]);
  // people: everyone assigned here, plus anyone rostered here this week who has since moved
  const extra = here.filter((s) => !assigned.some((a) => a.user.id === s.userId)).map((s) => s.userId);
  const moved = extra.length ? await db.user.findMany({ where: { id: { in: [...new Set(extra)] } }, select: { id: true, name: true, role: true } }) : [];
  const people = [...assigned.map((a) => a.user), ...moved].sort((a, b) => a.name.localeCompare(b.name));
  const ids = people.map((p) => p.id);
  const [elsewhere, leave] = await Promise.all([
    db.rosterShift.findMany({ where: { userId: { in: ids }, storeId: { not: storeId }, date: { gte: weekStart, lte: weekEnd } }, include: { store: { select: { name: true } } } }),
    db.leaveRequest.findMany({ where: { userId: { in: ids }, status: { in: ["APPROVED", "PENDING"] }, fromDate: { lte: weekEnd }, toDate: { gte: weekStart } }, select: { userId: true, fromDate: true, toDate: true, status: true, type: true } }),
  ]);
  const rows = people.map((p) => {
    const days = dates.map((date) => {
      const shift = here.find((s) => s.userId === p.id && s.date === date) ?? null;
      const away = elsewhere.find((s) => s.userId === p.id && s.date === date);
      const lv = leave.find((l) => l.userId === p.id && l.fromDate <= date && l.toDate >= date);
      return { date, shift: shift && { start: shift.start, end: shift.end }, elsewhere: away ? `${away.store.name} ${shiftLabel(away)}` : null, leave: lv ? (lv.status === "APPROVED" ? "leave" : "leave asked") : null };
    });
    const all = [...days.filter((d) => d.shift).map((d) => d.shift!), ...elsewhere.filter((s) => s.userId === p.id)];
    return { ...p, assigned: assigned.some((a) => a.user.id === p.id), days, minutes: all.reduce((s, x) => s + shiftMinutes(x), 0), shifts: all.length };
  });
  const warnings: Warning[] = [];
  for (const r of rows) {
    if (r.minutes > cfg().maxWeekHours * 60) warnings.push({ kind: "hours", text: `${r.name}: ${Math.round(r.minutes / 6) / 10} hours this week (over ${cfg().maxWeekHours}: overtime needs their consent and overtime pay)` });
    if (r.shifts >= 7) warnings.push({ kind: "dayoff", text: `${r.name} has no day off this week` });
    for (const d of r.days) {
      if (d.shift && shiftMinutes(d.shift) > cfg().dayHours * 60) warnings.push({ kind: "day", text: `${r.name}, ${weekdayOf(d.date)}: ${shiftLabel(d.shift)} is over ${cfg().dayHours} hours` });
      if (d.shift && d.leave === "leave asked") warnings.push({ kind: "pending-leave", text: `${r.name} has asked for leave on ${weekdayOf(d.date)}` });
    }
  }
  const heads = dates.map((date) => ({ date, weekday: weekdayOf(date), holiday: holidays.find((h) => h.date === date)?.name ?? null, staff: here.filter((s) => s.date === date).length }));
  if (!here.length) { if (people.length && store.minStaff) warnings.push({ kind: "short", text: `No shifts planned yet: ${store.name} needs ${store.minStaff} people a day` }); }
  else for (const h of heads) if (h.staff < store.minStaff && !h.holiday) warnings.push({ kind: "short", text: `${h.weekday} ${h.date.slice(5)}: ${h.staff} rostered, ${store.name} needs ${store.minStaff}` });
  return { store, weekStart, dates: heads, rows, warnings, published: published ? { at: published.publishedAt } : null, changedSincePublish: !!published?.changedAt && published.changedAt > published.publishedAt };
}

// ---------- changing a week ----------

export type Cell = { userId: string; date: string; value: string };

/**
 * Save the planner: each cell is a shift ("10-18") or empty. Checked first; nothing is saved if a cell is wrong
 * (a bad time, someone not assigned here, approved leave, or a shift at another location that day).
 */
export async function saveWeek(tx: Tx, user: Actor, storeId: string, weekStart: string, cells: Cell[]) {
  await requireStoreAccess(user, storeId, tx);
  checkWeekStart(weekStart);
  if (cells.length > 7 * 200) throw new RosterError("Too many cells.");
  const dates = new Set(weekDates(weekStart));
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`roster:${storeId}:${weekStart}`}))`;
  const ids = [...new Set(cells.map((c) => c.userId))];
  const [assigned, users, leave, existing] = await Promise.all([
    tx.staffLocation.findMany({ where: { storeId, userId: { in: ids } }, select: { userId: true } }),
    tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    tx.leaveRequest.findMany({ where: { userId: { in: ids }, status: "APPROVED", fromDate: { lte: weekDates(weekStart)[6] }, toDate: { gte: weekStart } }, select: { userId: true, fromDate: true, toDate: true } }),
    tx.rosterShift.findMany({ where: { userId: { in: ids }, date: { in: [...dates] } }, include: { store: { select: { name: true } } } }),
  ]);
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? "Someone";
  const errors: string[] = [];
  const plan: { userId: string; date: string; shift: { start: string; end: string } | null }[] = [];
  for (const c of cells) {
    if (!dates.has(c.date)) { errors.push(`${c.date} isn't in this week`); continue; }
    let shift: { start: string; end: string } | null = null;
    try { shift = parseShift(c.value); } catch (e) { errors.push(`${name(c.userId)}, ${weekdayOf(c.date)}: ${(e as Error).message}`); continue; }
    const mine = existing.find((x) => x.userId === c.userId && x.date === c.date);
    if (shift) {
      if (!assigned.some((a) => a.userId === c.userId)) { errors.push(`${name(c.userId)} isn't assigned to this location`); continue; }
      if (leave.some((l) => l.userId === c.userId && l.fromDate <= c.date && l.toDate >= c.date)) { errors.push(`${name(c.userId)} is on leave on ${weekdayOf(c.date)}`); continue; }
      if (mine && mine.storeId !== storeId) { errors.push(`${name(c.userId)} works at ${mine.store.name} on ${weekdayOf(c.date)}`); continue; }
    } else if (mine && mine.storeId !== storeId) continue; // an empty cell never removes another location's shift
    plan.push({ userId: c.userId, date: c.date, shift });
  }
  if (errors.length) throw new RosterError(`Nothing saved. ${[...new Set(errors)].slice(0, 6).join("; ")}${errors.length > 6 ? `; and ${errors.length - 6} more` : ""}.`);
  let set = 0, removed = 0;
  for (const p of plan) {
    const mine = existing.find((x) => x.userId === p.userId && x.date === p.date && x.storeId === storeId);
    if (!p.shift) { if (mine) { await tx.rosterShift.delete({ where: { id: mine.id } }); removed++; } continue; }
    if (mine && mine.start === p.shift.start && mine.end === p.shift.end) continue;
    try {
      if (mine) await tx.rosterShift.update({ where: { id: mine.id }, data: { ...p.shift, createdById: user.id } });
      else await tx.rosterShift.create({ data: { storeId, userId: p.userId, date: p.date, ...p.shift, createdById: user.id } });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new RosterError(`${name(p.userId)} has just been rostered elsewhere on ${weekdayOf(p.date)}. Reload and try again.`);
      throw e;
    }
    set++;
  }
  if (set || removed) await tx.rosterWeek.updateMany({ where: { storeId, weekStart }, data: { changedAt: new Date() } });
  if (set || removed) await audit(tx, user, { action: "roster.save", entity: ["Store", storeId], summary: `Roster for the week of ${weekStart}: ${set} shift(s) set, ${removed} removed` });
  return { set, removed };
}

/** Fill this week's empty cells from last week's, for people still here and not on leave. */
export async function copyPreviousWeek(tx: Tx, user: Actor, storeId: string, weekStart: string) {
  checkWeekStart(weekStart);
  const prev = await tx.rosterShift.findMany({ where: { storeId, date: { gte: addDays(weekStart, -7), lte: addDays(weekStart, -1) } } });
  if (!prev.length) throw new RosterError("Last week has no shifts here to copy.");
  const taken = await tx.rosterShift.findMany({ where: { userId: { in: [...new Set(prev.map((p) => p.userId))] }, date: { gte: weekStart, lte: addDays(weekStart, 6) } }, select: { userId: true, date: true } });
  const leave = await tx.leaveRequest.findMany({ where: { userId: { in: [...new Set(prev.map((p) => p.userId))] }, status: "APPROVED", fromDate: { lte: addDays(weekStart, 6) }, toDate: { gte: weekStart } }, select: { userId: true, fromDate: true, toDate: true } });
  const here = new Set((await tx.staffLocation.findMany({ where: { storeId }, select: { userId: true } })).map((s) => s.userId));
  const cells: Cell[] = prev.map((p) => ({ userId: p.userId, date: addDays(p.date, 7), value: `${p.start}-${p.end}` }))
    .filter((c) => here.has(c.userId) && !taken.some((t) => t.userId === c.userId && t.date === c.date) && !leave.some((l) => l.userId === c.userId && l.fromDate <= c.date && l.toDate >= c.date));
  if (!cells.length) return { set: 0, skipped: prev.length };
  const r = await saveWeek(tx, user, storeId, weekStart, cells);
  return { set: r.set, skipped: prev.length - cells.length };
}

export async function publishWeek(tx: Tx, user: Actor, storeId: string, weekStart: string, now = new Date()) {
  await requireStoreAccess(user, storeId, tx);
  checkWeekStart(weekStart);
  const n = await tx.rosterShift.count({ where: { storeId, date: { gte: weekStart, lte: addDays(weekStart, 6) } } });
  if (!n) throw new RosterError("There are no shifts to publish.");
  await tx.$executeRaw`INSERT INTO "RosterWeek" ("storeId", "weekStart", "publishedAt", "publishedById") VALUES (${storeId}, ${weekStart}, (${now}::timestamptz AT TIME ZONE 'UTC'), ${user.id})
    ON CONFLICT ("storeId", "weekStart") DO UPDATE SET "publishedAt" = EXCLUDED."publishedAt", "publishedById" = EXCLUDED."publishedById"`;
  await audit(tx, user, { action: "roster.publish", entity: ["Store", storeId], summary: `Roster for the week of ${weekStart} published (${n} shifts)` });
  return { shifts: n };
}

export async function setMinStaff(tx: Tx, user: Actor, storeId: string, minStaff: number) {
  await requireStoreAccess(user, storeId, tx);
  if (!Number.isInteger(minStaff) || minStaff < 0 || minStaff > 50) throw new RosterError("Minimum staff is 0 to 50.");
  await tx.store.update({ where: { id: storeId }, data: { minStaff } });
  await audit(tx, user, { action: "roster.min-staff", entity: ["Store", storeId], summary: `Minimum staff per day set to ${minStaff}` });
}

export async function saveHoliday(tx: Tx, user: Actor, d: { date: string; name: string }) {
  if (!isDate(d.date)) throw new RosterError("Enter the date.");
  const name = d.name.trim().slice(0, 80);
  if (name.length < 2) throw new RosterError("Name the holiday.");
  await tx.holiday.upsert({ where: { date: d.date }, create: { date: d.date, name }, update: { name } });
  await audit(tx, user, { action: "holiday.save", entity: ["Holiday", d.date], summary: `Public holiday ${d.date}: ${name}` });
}
export async function removeHoliday(tx: Tx, user: Actor, date: string) {
  const r = await tx.holiday.deleteMany({ where: { date } });
  if (r.count) await audit(tx, user, { action: "holiday.remove", entity: ["Holiday", date], summary: `Public holiday ${date} removed` });
}

// ---------- staff and HQ views ----------

/** A person's published shifts from today, with the location. */
export async function myShifts(userId: string, today = ktmDate(), days = 7) {
  const shifts = await db.rosterShift.findMany({ where: { userId, date: { gte: today, lte: addDays(today, days - 1) } }, orderBy: { date: "asc" }, include: { store: { select: { name: true } } } });
  if (!shifts.length) return [];
  const weeks = await db.rosterWeek.findMany({ where: { OR: shifts.map((s) => ({ storeId: s.storeId, weekStart: weekStartOf(s.date) })) } });
  const holidays = await db.holiday.findMany({ where: { date: { in: shifts.map((s) => s.date) } } });
  return shifts.filter((s) => weeks.some((w) => w.storeId === s.storeId && w.weekStart === weekStartOf(s.date)))
    .map((s) => ({ date: s.date, weekday: weekdayOf(s.date), store: s.store.name, label: shiftLabel(s), holiday: holidays.find((h) => h.date === s.date)?.name ?? null }));
}

export type ShiftResult = "on time" | "late" | "left early" | "late, left early" | "no-show" | "to come" | "not in yet";

/** Published shifts in [from, to] compared with clock-ins at that location that day. */
export async function rosterVsActual(storeIds: string[] | null, from: string, to: string, now = new Date()) {
  const shifts = await db.rosterShift.findMany({ where: { ...(storeIds ? { storeId: { in: storeIds } } : {}), date: { gte: from, lte: to } }, include: { user: { select: { name: true } }, store: { select: { name: true } } }, orderBy: [{ date: "asc" }, { start: "asc" }] });
  const weeks = shifts.length ? await db.rosterWeek.findMany({ where: { storeId: { in: [...new Set(shifts.map((s) => s.storeId))] }, weekStart: { gte: weekStartOf(from), lte: to } } }) : [];
  const published = new Set(weeks.map((w) => `${w.storeId}|${w.weekStart}`));
  const live = shifts.filter((s) => published.has(`${s.storeId}|${weekStartOf(s.date)}`));
  const entries = live.length ? await db.attendance.findMany({ where: { userId: { in: [...new Set(live.map((s) => s.userId))] }, ...(storeIds ? { storeId: { in: storeIds } } : {}), clockIn: { gte: at(from, "00:00"), lt: new Date(at(to, "00:00").getTime() + DAY) } }, select: { userId: true, storeId: true, clockIn: true, clockOut: true } }) : [];
  const grace = cfg().lateGraceMinutes * 60_000;
  const byShift = new Map<string, typeof entries>(); // person|location|Nepal date → entries, earliest first
  for (const e of [...entries].sort((a, b) => +a.clockIn - +b.clockIn)) { const k = `${e.userId}|${e.storeId}|${ktmDate(e.clockIn)}`; byShift.set(k, [...(byShift.get(k) ?? []), e]); }
  const rows = live.map((s) => {
    const mine = byShift.get(`${s.userId}|${s.storeId}|${s.date}`) ?? [];
    const start = at(s.date, s.start), end = at(s.date, s.end);
    let result: ShiftResult;
    if (!mine.length) result = now < start ? "to come" : now < end ? "not in yet" : "no-show";
    else {
      const late = mine[0].clockIn.getTime() > start.getTime() + grace;
      const lastOut = mine.at(-1)!.clockOut;
      const early = !!lastOut && lastOut.getTime() < end.getTime() - grace && now > end;
      result = late && early ? "late, left early" : late ? "late" : early ? "left early" : "on time";
    }
    const lateBy = mine.length ? Math.max(0, Math.round((mine[0].clockIn.getTime() - start.getTime()) / 60_000)) : null;
    return { id: s.id, date: s.date, store: s.store.name, storeId: s.storeId, userId: s.userId, name: s.user.name, label: shiftLabel(s), result, lateBy, clockIn: mine[0]?.clockIn ?? null };
  });
  const done = rows.filter((r) => r.result !== "to come" && r.result !== "not in yet");
  const people = new Map<string, { name: string; shifts: number; onTime: number; late: number; early: number; noShow: number }>();
  for (const r of done) {
    const p = people.get(r.userId) ?? { name: r.name, shifts: 0, onTime: 0, late: 0, early: 0, noShow: 0 };
    p.shifts++;
    if (r.result === "on time") p.onTime++; else if (r.result === "no-show") p.noShow++; else { if (r.result.startsWith("late")) p.late++; if (r.result.endsWith("left early")) p.early++; }
    people.set(r.userId, p);
  }
  return { rows, people: [...people.values()].sort((a, b) => b.noShow - a.noShow || b.late - a.late || a.name.localeCompare(b.name)), onTimePct: done.length ? Math.round((done.filter((r) => r.result === "on time").length / done.length) * 100) : null };
}

/** HQ: every location's week at a glance: published or not, shifts, days short of staff. */
export async function rosterOverview(scope: Scope, weekStart: string) {
  checkWeekStart(weekStart);
  const end = addDays(weekStart, 6);
  const [stores, perDay, weeks, holidays] = await Promise.all([
    db.store.findMany({ where: { active: true, ...(scope.all ? {} : { id: { in: scope.storeIds } }) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true, minStaff: true } }),
    db.rosterShift.groupBy({ by: ["storeId", "date"], where: { date: { gte: weekStart, lte: end }, ...(scope.all ? {} : { storeId: { in: scope.storeIds } }) }, _count: { _all: true } }),
    db.rosterWeek.findMany({ where: { weekStart } }),
    db.holiday.findMany({ where: { date: { gte: weekStart, lte: end } }, select: { date: true } }),
  ]);
  const open = weekDates(weekStart).filter((d) => !holidays.some((h) => h.date === d));
  return stores.map((s) => {
    const days = perDay.filter((p) => p.storeId === s.id);
    const short = open.filter((d) => (days.find((x) => x.date === d)?._count._all ?? 0) < s.minStaff).length;
    return { ...s, shifts: days.reduce((a, d) => a + d._count._all, 0), short, published: weeks.some((w) => w.storeId === s.id) };
  });
}
