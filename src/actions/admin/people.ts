"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError, reportErrorSoon } from "@/lib/errors";
import { dispatchNotifications } from "@/lib/notifications";
import { cancelLeave, clockIn, clockOut, correctEntry, decideLeave, PeopleError, requestLeave } from "@/lib/people";
import { ScopeError } from "@/lib/scope";
import { AbsenceError, decideAbsence, reopenAbsence, type Decision } from "@/lib/absences";

type R = { ok: true } | { ok: false; error: string };

function failure(e: unknown, where: string): { ok: false; error: string } {
  if (e instanceof PeopleError || e instanceof ScopeError || e instanceof AbsenceError) return { ok: false, error: e.message };
  void reportError(where, e);
  return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
}

async function run(where: string, f: () => Promise<unknown>): Promise<R> {
  try { await f(); } catch (e) { return failure(e, where); }
  refresh();
  return { ok: true };
}

export async function clockInAt(storeId: string): Promise<R> {
  const me = await requirePermission("self.time");
  return run("clockIn", () => db.$transaction((tx) => clockIn(tx, me, storeId)));
}

export async function clockOutNow(): Promise<R> {
  const me = await requirePermission("self.time");
  return run("clockOut", () => db.$transaction((tx) => clockOut(tx, me)));
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the dates");
const leaveSchema = z.object({ type: z.string().min(1), from: day, to: day, reason: z.string().trim().max(300).optional() });

export async function askForLeave(input: z.input<typeof leaveSchema>): Promise<R> {
  const me = await requirePermission("self.time");
  const p = leaveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the dates." };
  return run("askForLeave", () => db.$transaction((tx) => requestLeave(tx, me, p.data)));
}

export async function withdrawLeave(id: string): Promise<R> {
  const me = await requirePermission("self.time");
  return run("withdrawLeave", () => db.$transaction((tx) => cancelLeave(tx, me, id)));
}

export async function decideLeaveRequest(id: string, approve: boolean, note?: string): Promise<R> {
  const me = await requirePermission("people");
  const r = await run("decideLeave", () => db.$transaction((tx) => decideLeave(tx, me, id, approve, note?.trim().slice(0, 200))));
  if (r.ok) after(() => dispatchNotifications(20).catch(reportErrorSoon("decideLeave: dispatch")));
  return r;
}

const fixSchema = z.object({ id: z.string().min(1), clockIn: z.string().min(1), clockOut: z.string().min(1), reason: z.string().trim().min(3, "Say why, for the record").max(200) });

/** Times arrive as Nepal local "YYYY-MM-DDTHH:mm" from the form. */
export async function fixAttendance(input: z.input<typeof fixSchema>): Promise<R> {
  const me = await requirePermission("people");
  const p = fixSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the times." };
  const at = (s: string) => new Date(`${s}:00+05:45`);
  const [ci, co] = [at(p.data.clockIn), at(p.data.clockOut)];
  if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) return { ok: false, error: "Check the times." };
  return run("fixAttendance", () => db.$transaction((tx) => correctEntry(tx, me, p.data.id, { clockIn: ci, clockOut: co, reason: p.data.reason })));
}

const absenceSchema = z.object({ id: z.string().min(1), decision: z.enum(["UNPAID", "LEAVE", "WORKED"]), leaveType: z.string().optional(), note: z.string().trim().max(200).optional() });

export async function decideMissedShift(input: { id: string; decision: Decision; leaveType?: string; note?: string }): Promise<R> {
  const me = await requirePermission("people");
  const p = absenceSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Choose what happened." };
  const r = await run("decideAbsence", () => db.$transaction((tx) => decideAbsence(tx, me, p.data.id, p.data)));
  if (r.ok && p.data.decision === "UNPAID") after(() => dispatchNotifications(20).catch(reportErrorSoon("decideAbsence: dispatch")));
  return r;
}

export async function reopenMissedShift(id: string, reason: string): Promise<R> {
  const me = await requirePermission("people");
  return run("reopenAbsence", () => db.$transaction((tx) => reopenAbsence(tx, me, id, reason)));
}
