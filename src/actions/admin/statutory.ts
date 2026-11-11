"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { recordDeposit, StatutoryError } from "@/lib/statutory";

export async function recordStatutoryDeposit(id: string, paidOn: string, rupees: number, reference: string) {
  const me = await requirePermission("payroll");
  const p = z.object({ paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount: z.number().positive().max(100_000_000), reference: z.string().max(80) }).safeParse({ paidOn, amount: rupees, reference });
  if (!p.success) return { ok: false as const, error: "Enter the date, amount and voucher number." };
  try {
    await db.$transaction((tx) => recordDeposit(tx, me, String(id), { paidOn: p.data.paidOn, amount: Math.round(p.data.amount * 100), reference: p.data.reference }));
  } catch (e) {
    if (e instanceof StatutoryError) return { ok: false as const, error: e.message };
    void reportError("recordStatutoryDeposit", e);
    return { ok: false as const, error: "Couldn't save that. Nothing changed — please try again." };
  }
  refresh();
  return { ok: true as const };
}
