"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { ScopeError } from "@/lib/scope";
import { CashError, checkDeposit, countSafe, pettySpend, recordDeposit } from "@/lib/cash";

type R = { ok: true; message?: string } | { ok: false; error: string };
const paisa = (rupees: number) => Math.round(rupees * 100);

async function run(where: string, f: () => Promise<string | void>): Promise<R> {
  let message: string | void;
  try { message = await f(); } catch (e) {
    if (e instanceof CashError || e instanceof ScopeError) return { ok: false, error: e.message };
    void reportError(where, e);
    return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
  }
  refresh();
  return message ? { ok: true, message } : { ok: true };
}

const rupees = z.number().min(0).max(100_000_000);

export async function countSafeAction(storeId: string, countedRupees: number, note: string): Promise<R> {
  const me = await requirePermission("closing");
  const p = z.object({ storeId: z.string(), counted: rupees, note: z.string().max(300) }).safeParse({ storeId, counted: countedRupees, note });
  if (!p.success) return { ok: false, error: "Enter the cash you counted." };
  return run("countSafe", async () => {
    const r = await db.$transaction((tx) => countSafe(tx, me, p.data.storeId, paisa(p.data.counted), p.data.note));
    return r.difference ? "Counted: the difference is on the book" : "Counted: matches the book";
  });
}

const depositSchema = z.object({ storeId: z.string(), amount: rupees.refine((n) => n > 0, "Enter the amount"), bank: z.string().trim().min(2).max(60), slipNo: z.string().trim().min(1).max(40), slipPhoto: z.string().max(200).optional(), depositedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function recordDepositAction(input: z.input<typeof depositSchema>): Promise<R> {
  const me = await requirePermission("closing");
  const p = depositSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the deposit." };
  return run("recordDeposit", async () => { await db.$transaction((tx) => recordDeposit(tx, me, { ...p.data, amount: paisa(p.data.amount), slipPhoto: p.data.slipPhoto || null })); });
}

const pettySchema = z.object({ storeId: z.string(), amount: rupees.refine((n) => n > 0, "Enter the amount"), category: z.enum(["RENT", "UTILITIES", "MARKETING", "PACKAGING", "DELIVERY", "EQUIPMENT", "FEES", "OTHER"]), description: z.string().trim().min(3, "Say what it was for").max(200), receipt: z.string().max(200).optional() });

export async function pettyAction(input: z.input<typeof pettySchema>): Promise<R> {
  const me = await requirePermission("closing");
  const p = pettySchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the spend." };
  return run("petty", async () => { await db.$transaction((tx) => pettySpend(tx, me, { ...p.data, amount: paisa(p.data.amount), receipt: p.data.receipt || null })); });
}

export async function checkDepositAction(id: string, bankRupees: number, note: string): Promise<R> {
  const me = await requirePermission("finance");
  const p = z.object({ id: z.string(), bank: rupees, note: z.string().max(300) }).safeParse({ id, bank: bankRupees, note });
  if (!p.success) return { ok: false, error: "Enter what the bank statement shows." };
  return run("checkDeposit", async () => { await db.$transaction((tx) => checkDeposit(tx, me, p.data.id, { bankAmount: paisa(p.data.bank), note: p.data.note })); });
}
