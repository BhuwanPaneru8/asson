"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { ScopeError } from "@/lib/scope";
import { cancelSwap, decideSwap, offerSwap, respondSwap, SwapError } from "@/lib/shift-swaps";

async function run<T>(where: string, f: () => Promise<T>) {
  try { const r = await f(); refresh(); return { ok: true as const, result: r }; } catch (e) {
    if (e instanceof SwapError || e instanceof ScopeError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
}

const offer = z.object({ shiftId: z.string(), toUserId: z.string(), backShiftId: z.string().nullable().optional(), note: z.string().max(200).optional() });
export async function offerSwapAction(input: z.input<typeof offer>) {
  const me = await requirePermission("self.time");
  const p = offer.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Choose a colleague." };
  return run("offerSwap", async () => { await db.$transaction((tx) => offerSwap(tx, me, p.data)); return null; });
}
export async function respondSwapAction(id: string, accept: boolean) {
  const me = await requirePermission("self.time");
  return run("respondSwap", () => db.$transaction((tx) => respondSwap(tx, me, String(id), !!accept)));
}
export async function cancelSwapAction(id: string) {
  const me = await requirePermission("self.time");
  return run("cancelSwap", () => db.$transaction((tx) => cancelSwap(tx, me, String(id))));
}
export async function decideSwapAction(id: string, approve: boolean, note?: string) {
  const me = await requirePermission("people");
  return run("decideSwap", () => db.$transaction((tx) => decideSwap(tx, me, String(id), !!approve, String(note ?? "").slice(0, 200))));
}
