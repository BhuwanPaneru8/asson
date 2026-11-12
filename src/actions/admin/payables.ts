"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { PayablesError, recordBill, recordCreditNote, recordPayment, voidBill, voidCreditNote, voidPayment } from "@/lib/payables";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const rupees = z.coerce.number().finite().min(0).max(100_000_000).transform((n) => Math.round(n * 100));
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

function failure(e: unknown, where: string): { ok: false; error: string } {
  if (e instanceof PayablesError) return { ok: false, error: e.message };
  void reportError(where, e);
  return { ok: false, error: "Couldn't save that. Nothing was recorded — please try again." };
}

const billSchema = z.object({
  supplierId: z.string().min(1, "Pick the supplier"),
  reference: z.string().trim().min(1, "Enter the supplier's invoice number").max(60),
  billDate: day,
  dueDate: day.optional().or(z.literal("")),
  amount: rupees.refine((n) => n > 0, "Enter the bill total"),
  vatAmount: rupees.default(0),
  purchaseOrderId: z.string().optional().or(z.literal("")),
  note: z.string().trim().max(500).optional(),
});

/** Managers record bills as they arrive; paying them is the owner's job. */
export async function recordSupplierBill(input: z.input<typeof billSchema>): Promise<R<{ number: number; creditUsed: number }>> {
  const me = await requirePermission("purchasing");
  const p = billSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the bill details." };
  try {
    const b = await db.$transaction((tx) => recordBill(tx, me, { ...p.data, dueDate: p.data.dueDate || undefined, purchaseOrderId: p.data.purchaseOrderId || null }));
    refresh();
    return { ok: true, number: b.number, creditUsed: b.creditUsed };
  } catch (e) {
    return failure(e, "recordSupplierBill");
  }
}

const paymentSchema = z.object({
  supplierId: z.string().min(1, "Pick the supplier"),
  amount: rupees.refine((n) => n > 0, "Enter the amount paid"),
  method: z.enum(["CASH", "BANK", "CHEQUE", "ESEWA", "KHALTI", "FONEPAY"]),
  reference: z.string().trim().max(60).optional(),
  paidAt: day,
  note: z.string().trim().max(500).optional(),
  billIds: z.array(z.string()).max(100).optional(),
});

export async function recordSupplierPayment(input: z.input<typeof paymentSchema>): Promise<R<{ number: number; credit: number }>> {
  const me = await requirePermission("finance");
  const p = paymentSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the payment details." };
  try {
    const r = await db.$transaction((tx) => recordPayment(tx, me, p.data));
    refresh();
    return { ok: true, number: r.number, credit: r.credit };
  } catch (e) {
    return failure(e, "recordSupplierPayment");
  }
}

export async function voidSupplierBill(id: string, reason: string): Promise<R> {
  const me = await requirePermission("finance");
  if (reason.trim().length < 3) return { ok: false, error: "Say why this bill is void." };
  try {
    await db.$transaction((tx) => voidBill(tx, me, id, reason.trim().slice(0, 300)));
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e, "voidSupplierBill");
  }
}

export async function voidSupplierPayment(id: string, reason: string): Promise<R> {
  const me = await requirePermission("finance");
  if (reason.trim().length < 3) return { ok: false, error: "Say why this payment is void." };
  try {
    await db.$transaction((tx) => voidPayment(tx, me, id, reason.trim().slice(0, 300)));
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e, "voidSupplierPayment");
  }
}

const creditSchema = z.object({
  supplierId: z.string().min(1, "Pick the supplier"),
  reference: z.string().trim().min(1, "Enter the supplier's credit note number").max(60),
  date: day,
  amount: rupees.refine((n) => n > 0, "Enter the credit total"),
  vatAmount: rupees.default(0),
  reason: z.string().trim().min(3, "Say what the credit is for").max(200),
  billIds: z.array(z.string()).max(100).optional(),
  damageEntryIds: z.array(z.string()).max(200).optional(),
});

/** Finance records a supplier's credit note: it settles bills, the rest is credit; it can cover damaged returns. */
export async function recordSupplierCredit(input: z.input<typeof creditSchema>): Promise<R<{ number: number; credit: number }>> {
  const me = await requirePermission("finance");
  const p = creditSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  try {
    const r = await db.$transaction((tx) => recordCreditNote(tx, me, p.data));
    refresh();
    return { ok: true, number: r.number, credit: r.credit };
  } catch (e) {
    return failure(e, "recordSupplierCredit");
  }
}

export async function voidSupplierCredit(id: string, reason: string): Promise<R> {
  const me = await requirePermission("finance");
  try {
    await db.$transaction((tx) => voidCreditNote(tx, me, id, reason.trim().slice(0, 300)));
    refresh();
    return { ok: true };
  } catch (e) {
    return failure(e, "voidSupplierCredit");
  }
}
