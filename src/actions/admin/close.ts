"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { closeMonth, CloseError, reopenMonth } from "@/lib/month-close";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

async function run(where: string, f: () => Promise<void>) {
  try { await f(); } catch (e) {
    if (e instanceof CloseError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
  refresh();
  return { ok: true as const };
}

export async function closeMonthAction(m: string, acceptWarnings: boolean) {
  const me = await requirePermission("finance");
  const p = month.safeParse(m);
  if (!p.success) return { ok: false as const, error: "Pick a month." };
  return run("closeMonth", () => db.$transaction((tx) => closeMonth(tx, me, p.data, { acceptWarnings: !!acceptWarnings }), { timeout: 30_000 }));
}

export async function reopenMonthAction(m: string, reason: string) {
  const me = await requirePermission("finance");
  const p = month.safeParse(m);
  if (!p.success) return { ok: false as const, error: "Pick a month." };
  return run("reopenMonth", () => db.$transaction((tx) => reopenMonth(tx, me, p.data, String(reason ?? ""))));
}
