"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { createReturn, fileReturn, recordVatPayment, reopenReturn, VatError } from "@/lib/vat";

async function run(where: string, f: () => Promise<unknown>) {
  try { await f(); } catch (e) {
    if (e instanceof VatError) return { ok: false as const, error: e.message };
    if (e instanceof Error && /can't overlap/.test(e.message)) return { ok: false as const, error: "That period overlaps another return." };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
  refresh();
  return { ok: true as const };
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function createVatReturn(label: string, from: string, to: string) {
  const me = await requirePermission("finance");
  const p = z.object({ label: z.string().max(40), from: date, to: date }).safeParse({ label, from, to });
  if (!p.success) return { ok: false as const, error: "Name the period and give its first and last day." };
  return run("createVatReturn", () => db.$transaction((tx) => createReturn(tx, me, p.data)));
}

export async function fileVatReturn(id: string, ackNo: string) {
  const me = await requirePermission("finance");
  return run("fileVatReturn", () => db.$transaction((tx) => fileReturn(tx, me, String(id), String(ackNo ?? "")), { timeout: 30_000 }));
}

export async function reopenVatReturn(id: string, reason: string) {
  const me = await requirePermission("finance");
  return run("reopenVatReturn", () => db.$transaction((tx) => reopenReturn(tx, me, String(id), String(reason ?? ""))));
}

export async function payVatReturn(id: string, paidOn: string, rupees: number, ref: string) {
  const me = await requirePermission("finance");
  const p = z.object({ paidOn: date, amount: z.number().positive().max(100_000_000), ref: z.string().max(80) }).safeParse({ paidOn, amount: rupees, ref });
  if (!p.success) return { ok: false as const, error: "Enter the date and amount paid." };
  return run("payVatReturn", () => db.$transaction((tx) => recordVatPayment(tx, me, String(id), { paidOn: p.data.paidOn, amount: Math.round(p.data.amount * 100), ref: p.data.ref })));
}
