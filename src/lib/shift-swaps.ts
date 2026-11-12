import "server-only";
import type { Prisma, RosterShift } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { ktmDate } from "./pos";
import { requireStoreAccess, type Scope } from "./scope";
import { shiftLabel, weekStartOf, weekdayOf } from "./rosters";

// Shift swaps. A person hands one of their published, upcoming shifts to a colleague (give away) or trades it
// for one of the colleague's (swap). The colleague accepts, then a manager at that location approves; only then
// do the shifts change hands, and everything is checked again at that moment (the plan may have changed):
// both still upcoming and published, each person assigned where they'd work, not on approved leave, and not
// already working that day. A swap exchanges the two shifts' details (location, date, times) rather than their
// people, so the one-shift-per-person-per-day rule never clashes mid-update.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class SwapError extends Error {}

const startsAt = (s: { date: string; start: string }) => new Date(`${s.date}T${s.start}:00+05:45`);
const label = (s: { date: string; start: string; end: string }) => `${weekdayOf(s.date)} ${s.date.slice(5)} ${shiftLabel(s)}`;

/** Everything that must hold for `who` to take `shift` (optionally while giving up `freeing` on another day). */
async function canTake(tx: Tx, who: { id: string; name: string }, shift: RosterShift, now: Date, freeing?: RosterShift | null) {
  if (startsAt(shift) <= now) throw new SwapError(`${label(shift)} has already started.`);
  const [published, assigned, busy, leave] = await Promise.all([
    tx.rosterWeek.findUnique({ where: { storeId_weekStart: { storeId: shift.storeId, weekStart: weekStartOf(shift.date) } } }),
    tx.staffLocation.findUnique({ where: { userId_storeId: { userId: who.id, storeId: shift.storeId } } }),
    tx.rosterShift.findFirst({ where: { userId: who.id, date: shift.date, id: { not: freeing?.id ?? "" } }, include: { store: { select: { name: true } } } }),
    tx.leaveRequest.findFirst({ where: { userId: who.id, status: "APPROVED", fromDate: { lte: shift.date }, toDate: { gte: shift.date } } }),
  ]);
  if (!published) throw new SwapError("Only shifts in a published roster can be swapped.");
  if (!assigned) throw new SwapError(`${who.name} doesn't work at that location.`);
  if (busy) throw new SwapError(`${who.name} already works ${busy.store.name} on ${weekdayOf(shift.date)}.`);
  if (leave) throw new SwapError(`${who.name} is on leave on ${weekdayOf(shift.date)}.`);
}

async function load(tx: Tx, id: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ShiftSwap" WHERE "id" = ${id} FOR UPDATE`;
  if (!row) throw new SwapError("Request not found.");
  return tx.shiftSwap.findUniqueOrThrow({ where: { id }, include: { shift: true, backShift: true, fromUser: { select: { id: true, name: true } }, toUser: { select: { id: true, name: true } } } });
}
type Loaded = Awaited<ReturnType<typeof load>>;

/** Re-check a request in full (on offer, on accept, and on approval). */
async function check(tx: Tx, s: Pick<Loaded, "shift" | "backShift" | "fromUser" | "toUser">, now: Date) {
  if (s.shift.userId !== s.fromUser.id) throw new SwapError(`${label(s.shift)} isn't ${s.fromUser.name}'s shift any more.`);
  if (s.backShift && s.backShift.userId !== s.toUser.id) throw new SwapError(`${label(s.backShift)} isn't ${s.toUser.name}'s shift any more.`);
  // after the trade the colleague works the first shift and gives up theirs, and the other way round
  await canTake(tx, s.toUser, s.shift, now, s.backShift);
  if (s.backShift) await canTake(tx, s.fromUser, s.backShift, now, s.shift);
}

export async function offerSwap(tx: Tx, user: Actor, d: { shiftId: string; toUserId: string; backShiftId?: string | null; note?: string }, now = new Date()) {
  const shift = await tx.rosterShift.findUnique({ where: { id: d.shiftId } });
  if (!shift || shift.userId !== user.id) throw new SwapError("That isn't one of your shifts.");
  if (d.toUserId === user.id) throw new SwapError("Choose a colleague.");
  const to = await tx.user.findUnique({ where: { id: d.toUserId }, select: { id: true, name: true, role: true } });
  if (!to || to.role === "CUSTOMER") throw new SwapError("Choose a colleague.");
  const back = d.backShiftId ? await tx.rosterShift.findUnique({ where: { id: d.backShiftId } }) : null;
  if (d.backShiftId && (!back || back.userId !== to.id)) throw new SwapError(`That isn't one of ${to.name}'s shifts.`);
  await check(tx, { shift, backShift: back, fromUser: { id: user.id, name: user.name }, toUser: to }, now);
  try {
    return await tx.shiftSwap.create({ data: { shiftId: shift.id, fromUserId: user.id, toUserId: to.id, backShiftId: back?.id ?? null, note: d.note?.trim().slice(0, 200) ?? "" } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new SwapError("There's already a request open for that shift.");
    throw e;
  }
}

export async function respondSwap(tx: Tx, user: Actor, id: string, accept: boolean, now = new Date()) {
  const s = await load(tx, id);
  if (s.toUserId !== user.id) throw new SwapError("This request isn't for you.");
  if (s.status !== "OFFERED") throw new SwapError(`This request is already ${s.status.toLowerCase()}.`);
  if (accept) await check(tx, s, now);
  await tx.shiftSwap.update({ where: { id }, data: accept ? { status: "ACCEPTED" } : { status: "DECLINED", decidedAt: now } });
}

export async function cancelSwap(tx: Tx, user: Actor, id: string) {
  const s = await load(tx, id);
  if (s.fromUserId !== user.id) throw new SwapError("Only the person who asked can withdraw it.");
  if (s.status !== "OFFERED" && s.status !== "ACCEPTED") throw new SwapError(`This request is already ${s.status.toLowerCase()}.`);
  await tx.shiftSwap.update({ where: { id }, data: { status: "CANCELLED" } });
}

/** A manager at the shift's location approves (the shifts change hands now) or rejects. */
export async function decideSwap(tx: Tx, manager: Actor, id: string, approve: boolean, note = "", now = new Date()) {
  const s = await load(tx, id);
  await requireStoreAccess(manager, s.shift.storeId, tx);
  if (s.backShift) await requireStoreAccess(manager, s.backShift.storeId, tx);
  if (manager.id === s.fromUserId || manager.id === s.toUserId) throw new SwapError("Someone else has to approve a swap you're part of.");
  if (s.status !== "ACCEPTED") throw new SwapError(s.status === "OFFERED" ? `${s.toUser.name} hasn't accepted yet.` : `This request is already ${s.status.toLowerCase()}.`);
  const what = s.backShift ? `${s.fromUser.name} ${label(s.shift)} ⇄ ${s.toUser.name} ${label(s.backShift)}` : `${label(s.shift)}: ${s.fromUser.name} → ${s.toUser.name}`;
  if (!approve) {
    await tx.shiftSwap.update({ where: { id }, data: { status: "REJECTED", decidedById: manager.id, decidedAt: now, decisionNote: note.trim().slice(0, 200) } });
    await audit(tx, manager, { action: "roster.swap-reject", entity: ["ShiftSwap", id], summary: `Shift swap rejected: ${what}${note ? ` (${note})` : ""}` });
    return;
  }
  await tx.$queryRaw`SELECT "id" FROM "RosterShift" WHERE "id" IN (${s.shiftId}, ${s.backShiftId ?? s.shiftId}) FOR UPDATE`;
  const fresh = { ...s, shift: await tx.rosterShift.findUniqueOrThrow({ where: { id: s.shiftId } }), backShift: s.backShiftId ? await tx.rosterShift.findUnique({ where: { id: s.backShiftId } }) : null };
  if (s.backShiftId && !fresh.backShift) throw new SwapError(`${s.toUser.name}'s shift has been removed from the roster.`);
  await check(tx, fresh, now);
  if (!fresh.backShift) await tx.rosterShift.update({ where: { id: s.shiftId }, data: { userId: s.toUserId } });
  else {
    const a = fresh.shift, b = fresh.backShift;
    const pick = (x: RosterShift) => ({ storeId: x.storeId, date: x.date, start: x.start, end: x.end });
    await tx.rosterShift.update({ where: { id: a.id }, data: pick(b) }); // the requester now works the colleague's shift
    await tx.rosterShift.update({ where: { id: b.id }, data: pick(a) }); // and the colleague works theirs
  }
  await tx.shiftSwap.update({ where: { id }, data: { status: "APPROVED", decidedById: manager.id, decidedAt: now, decisionNote: note.trim().slice(0, 200) } });
  // anything else open on these shifts no longer makes sense
  await tx.shiftSwap.updateMany({ where: { id: { not: id }, status: { in: ["OFFERED", "ACCEPTED"] }, OR: [{ shiftId: { in: [s.shiftId, ...(s.backShiftId ? [s.backShiftId] : [])] } }, { backShiftId: { in: [s.shiftId, ...(s.backShiftId ? [s.backShiftId] : [])] } }] }, data: { status: "CANCELLED" } });
  await audit(tx, manager, { action: "roster.swap-approve", entity: ["ShiftSwap", id], summary: `Shift swap approved: ${what}` });
}

// ---------- views ----------

const view = { shift: { include: { store: { select: { name: true } } } }, backShift: { include: { store: { select: { name: true } } } }, fromUser: { select: { name: true } }, toUser: { select: { name: true } } } as const;
const describe = (s: Prisma.ShiftSwapGetPayload<{ include: typeof view }>) => ({
  id: s.id, shiftId: s.shiftId, status: s.status, note: s.note, from: s.fromUser.name, to: s.toUser.name, decisionNote: s.decisionNote,
  shift: `${s.shift.store.name} · ${label(s.shift)}`, back: s.backShift ? `${s.backShift.store.name} · ${label(s.backShift)}` : null,
});

/** For Today: what I've asked for, what's asked of me, my colleagues and their upcoming shifts to swap with. */
export async function swapsFor(userId: string, now = new Date()) {
  const today = ktmDate(now);
  const [mine, forMe, recent, places] = await Promise.all([
    db.shiftSwap.findMany({ where: { fromUserId: userId, status: { in: ["OFFERED", "ACCEPTED"] }, shift: { date: { gte: today } } }, include: view, orderBy: { createdAt: "desc" } }),
    db.shiftSwap.findMany({ where: { toUserId: userId, status: "OFFERED", shift: { date: { gte: today } } }, include: view, orderBy: { createdAt: "asc" } }),
    db.shiftSwap.findMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }], status: { in: ["APPROVED", "REJECTED", "DECLINED"] }, decidedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } }, include: view, orderBy: { createdAt: "desc" }, take: 5 }),
    db.staffLocation.findMany({ where: { userId }, select: { storeId: true } }),
  ]);
  const stores = places.map((p) => p.storeId);
  const colleagues = stores.length ? await db.user.findMany({ where: { id: { not: userId }, role: { not: "CUSTOMER" }, locations: { some: { storeId: { in: stores } } } }, orderBy: { name: "asc" }, select: { id: true, name: true,
    rosterShifts: { where: { date: { gte: today, lte: new Date(now.getTime() + 21 * 86_400_000).toISOString().slice(0, 10) }, storeId: { in: stores } }, orderBy: { date: "asc" }, select: { id: true, date: true, start: true, end: true, store: { select: { name: true } } } } } }) : [];
  return {
    mine: mine.map(describe), forMe: forMe.map(describe), recent: recent.map(describe),
    colleagues: colleagues.map((c) => ({ id: c.id, name: c.name, shifts: c.rosterShifts.map((s) => ({ id: s.id, label: `${s.store.name} · ${label(s)}` })) })),
  };
}

/** For managers: accepted swaps at their locations waiting for approval. */
export async function swapsToApprove(scope: Scope, now = new Date()) {
  const rows = await db.shiftSwap.findMany({ where: { status: "ACCEPTED", shift: { date: { gte: ktmDate(now) }, ...(scope.all ? {} : { storeId: { in: scope.storeIds } }) } }, include: view, orderBy: { createdAt: "asc" }, take: 100 });
  return rows.map(describe);
}
