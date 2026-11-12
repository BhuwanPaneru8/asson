"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { ScopeError } from "@/lib/scope";
import { copyPreviousWeek, publishWeek, removeHoliday, RosterError, saveHoliday, saveWeek, setMinStaff } from "@/lib/rosters";

async function run<T>(where: string, f: () => Promise<T>) {
  try { const r = await f(); refresh(); return { ok: true as const, result: r }; } catch (e) {
    if (e instanceof RosterError || e instanceof ScopeError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
}

const saveSchema = z.object({ storeId: z.string(), weekStart: z.string(), cells: z.array(z.object({ userId: z.string(), date: z.string(), value: z.string().max(40) })).max(1400) });
export async function saveWeekAction(input: z.input<typeof saveSchema>) {
  const me = await requirePermission("people");
  const p = saveSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Check the shifts." };
  return run("saveWeek", () => db.$transaction((tx) => saveWeek(tx, me, p.data.storeId, p.data.weekStart, p.data.cells)));
}
export async function copyWeekAction(storeId: string, weekStart: string) {
  const me = await requirePermission("people");
  return run("copyWeek", () => db.$transaction((tx) => copyPreviousWeek(tx, me, String(storeId), String(weekStart))));
}
export async function publishWeekAction(storeId: string, weekStart: string) {
  const me = await requirePermission("people");
  return run("publishWeek", () => db.$transaction((tx) => publishWeek(tx, me, String(storeId), String(weekStart))));
}
export async function setMinStaffAction(storeId: string, minStaff: number) {
  const me = await requirePermission("people");
  return run("setMinStaff", () => db.$transaction((tx) => setMinStaff(tx, me, String(storeId), Number(minStaff))));
}
export async function saveHolidayAction(date: string, name: string) {
  const me = await requirePermission("team.manage");
  return run("saveHoliday", () => db.$transaction((tx) => saveHoliday(tx, me, { date: String(date), name: String(name ?? "") })));
}
export async function removeHolidayAction(date: string) {
  const me = await requirePermission("team.manage");
  return run("removeHoliday", () => db.$transaction((tx) => removeHoliday(tx, me, String(date))));
}
