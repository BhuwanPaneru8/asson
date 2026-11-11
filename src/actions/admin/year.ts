"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { closeYear, reopenYear, startYear, YearError } from "@/lib/fiscal-year";

async function run(where: string, f: () => Promise<unknown>) {
  try { await f(); } catch (e) {
    if (e instanceof YearError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
  refresh();
  return { ok: true as const };
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function startYearAction(label: string, from: string, to: string) {
  const me = await requirePermission("finance");
  const p = z.object({ label: z.string().max(10), from: date, to: date }).safeParse({ label, from, to });
  if (!p.success) return { ok: false as const, error: "Name the year (2083/84) and give its first and last day." };
  return run("startYear", () => db.$transaction((tx) => startYear(tx, me, p.data)));
}

export async function closeYearAction(label: string) {
  const me = await requirePermission("finance");
  return run("closeYear", () => db.$transaction((tx) => closeYear(tx, me, String(label), { acceptWarnings: true }), { timeout: 60_000 }));
}

export async function reopenYearAction(label: string, reason: string) {
  const me = await requirePermission("finance");
  return run("reopenYear", () => db.$transaction((tx) => reopenYear(tx, me, String(label), String(reason ?? ""))));
}
