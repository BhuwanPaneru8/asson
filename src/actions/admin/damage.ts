"use server";

import { refresh, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { ScopeError } from "@/lib/scope";
import { DamageError, recordCredit, takeOut } from "@/lib/damage";

async function run<T>(where: string, f: () => Promise<T>) {
  try { const r = await f(); refresh(); return { ok: true as const, result: r }; } catch (e) {
    if (e instanceof DamageError || e instanceof ScopeError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
}

const outSchema = z.object({ storeId: z.string(), variantId: z.string(), quantity: z.number().int().min(1).max(100_000), kind: z.enum(["REPAIRED", "WRITTEN_OFF", "TO_SUPPLIER"]), note: z.string().max(300).optional(), supplierId: z.string().nullable().optional(), creditExpected: z.number().int().min(0).nullable().optional() });
export async function takeOutAction(input: z.input<typeof outSchema>) {
  const me = await requirePermission("inventory.adjust");
  const p = outSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Check how many and what happened." };
  const r = await run("damageTakeOut", async () => { await db.$transaction((tx) => takeOut(tx, me, p.data)); return null; });
  if (r.ok && p.data.kind === "REPAIRED") revalidateTag("products", { expire: 60 });
  return r;
}
export async function recordCreditAction(entryId: string, amount: number) {
  const me = await requirePermission("finance");
  return run("damageCredit", () => db.$transaction((tx) => recordCredit(tx, me, String(entryId), Number(amount))));
}
