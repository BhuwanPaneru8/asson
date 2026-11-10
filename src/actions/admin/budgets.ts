"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { BudgetError, saveBudgets, suggestBudgets } from "@/lib/budgets";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const rows = z.array(z.object({ storeId: z.string(), sales: z.number().min(0).max(10_000_000_000), marginPct: z.number().min(0).max(100).nullable(), costs: z.number().min(0).max(10_000_000_000), note: z.string().max(300).optional() })).max(1000);

/** Amounts come in rupees and % (as typed); stored as paisa and tenths of a percent. */
export async function saveBudgetsAction(m: string, input: z.input<typeof rows>): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requirePermission("finance");
  const p = z.object({ m: month, rows }).safeParse({ m, rows: input });
  if (!p.success) return { ok: false, error: "Check the numbers." };
  try {
    await db.$transaction((tx) => saveBudgets(tx, me, p.data.m, p.data.rows.map((r) => ({ storeId: r.storeId, sales: Math.round(r.sales * 100), marginPm: r.marginPct === null ? null : Math.round(r.marginPct * 10), costs: Math.round(r.costs * 100), note: r.note }))));
  } catch (e) {
    if (e instanceof BudgetError) return { ok: false, error: e.message };
    void reportError("saveBudgets", e);
    return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
  }
  refresh();
  return { ok: true };
}

export async function suggestBudgetsAction(m: string, from: "lastYear" | "lastMonth", upliftPct: number) {
  await requirePermission("finance");
  const p = z.object({ m: month, from: z.enum(["lastYear", "lastMonth"]), up: z.number().min(-90).max(500) }).safeParse({ m, from, up: upliftPct });
  if (!p.success) return { ok: false as const, error: "Check the month and uplift." };
  const s = await suggestBudgets(p.data.m, p.data.from, p.data.up);
  return { ok: true as const, base: s.base, rows: s.rows.map((r) => ({ storeId: r.storeId, sales: r.sales / 100, marginPct: r.marginPm === null ? null : r.marginPm / 10, costs: r.costs / 100 })) };
}
