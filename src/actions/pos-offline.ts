"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { reportError } from "@/lib/errors";
import { getOpenShift } from "@/lib/pos";
import { requireStoreAccess, ScopeError } from "@/lib/scope";
import { POS_EXCEPTION_LABEL, tillSnapshotPage, type TillRow } from "@/lib/pos-offline";
import { formatOrderNumber } from "@/lib/utils";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** One page of this shop's price list for the till to keep for offline selling (signed prices, no costs). */
export async function tillPriceList(cursor: string | null): Promise<R<{ storeId: string; rows: TillRow[]; next: string | null }>> {
  const me = await requirePermission("pos.sell");
  const shift = await getOpenShift(me.id);
  if (!shift) return { ok: false, error: "Open your shift first." };
  const c = z.string().max(40).nullable().safeParse(cursor);
  if (!c.success) return { ok: false, error: "Bad page." };
  const page = await tillSnapshotPage(shift.storeId, c.data);
  return { ok: true, storeId: shift.storeId, ...page };
}

const reportSchema = z.object({
  deviceId: z.string().regex(/^[\w-]{8,64}$/),
  shiftId: z.string().min(1).max(40),
  pending: z.number().int().min(0).max(10_000),
  oldestAt: z.iso.datetime().nullable(),
});

/**
 * The till says how many offline sales it holds for a shift. While that's above zero the shift can't close
 * and the shop's day can't lock. Only the shift's own cashier can report for it.
 */
export async function reportTillQueue(input: z.input<typeof reportSchema>): Promise<R> {
  const me = await requirePermission("pos.sell");
  const p = reportSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Bad report." };
  const d = p.data;
  const shift = await db.shift.findFirst({ where: { id: d.shiftId, cashierId: me.id }, select: { id: true, storeId: true } });
  if (!shift) return { ok: false, error: "Not your shift." };
  const data = { storeId: shift.storeId, cashierId: me.id, shiftId: shift.id, pending: d.pending, oldestPendingAt: d.oldestAt ? new Date(d.oldestAt) : null, lastSeenAt: new Date() };
  try {
    await db.posDevice.upsert({ where: { id: d.deviceId }, create: { id: d.deviceId, ...data }, update: data });
  } catch (e) {
    // two tabs reporting the same new device at once: the second insert loses the race, so update instead
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") await db.posDevice.update({ where: { id: d.deviceId }, data });
    else { void reportError("reportTillQueue", e); return { ok: false, error: "Couldn't save." }; }
  }
  return { ok: true };
}

const resolveSchema = z.object({ id: z.string().min(1).max(40), note: z.string().trim().min(3).max(300) });

/** A manager has checked an offline-sale exception (counted the shelf, contacted the customer…) and says what they did. */
export async function resolvePosException(input: z.input<typeof resolveSchema>): Promise<R> {
  const me = await requirePermission("closing");
  const p = resolveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Say what you checked or did (at least a few words)." };
  const x = await db.posException.findUnique({ where: { id: p.data.id }, select: { id: true, kind: true, storeId: true, order: { select: { number: true } } } });
  if (!x) return { ok: false, error: "Not found." };
  try {
    await requireStoreAccess(me, x.storeId);
  } catch (e) {
    if (e instanceof ScopeError) return { ok: false, error: e.message };
    throw e;
  }
  const done = await db.$transaction(async (tx) => {
    const res = await tx.posException.updateMany({ where: { id: x.id, resolvedAt: null }, data: { resolvedAt: new Date(), resolvedById: me.id, resolveNote: p.data.note } });
    if (!res.count) return false;
    await audit(tx, me, { action: "pos.offline_exception_resolved", entity: ["PosException", x.id], summary: `${me.name} checked ${formatOrderNumber(x.order.number)} (${POS_EXCEPTION_LABEL[x.kind]}): ${p.data.note.slice(0, 160)}` });
    return true;
  });
  if (!done) return { ok: false, error: "Someone has already checked this one." };
  refresh();
  return { ok: true };
}
