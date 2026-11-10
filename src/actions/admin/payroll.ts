"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { CommissionError, saveRule } from "@/lib/commissions";
import { adjustSlip, approveRun, buildRun, confirmTaxYear, markPaid, PayrollError, reopenRun, saveEmployment, saveTaxYear } from "@/lib/payroll";

type R = { ok: true } | { ok: false; error: string };
const paisa = (rupees: number) => Math.round(rupees * 100);

async function run(where: string, f: () => Promise<unknown>): Promise<R> {
  try { await f(); } catch (e) {
    if (e instanceof PayrollError) return { ok: false, error: e.message };
    void reportError(where, e);
    return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
  }
  refresh();
  return { ok: true };
}

const money = z.coerce.number().min(0).max(10_000_000);
const employmentSchema = z.object({
  basic: money, allowance: money, inSsf: z.boolean(), married: z.boolean(), active: z.boolean(),
  pan: z.string().trim().regex(/^\d{9}$/, "PAN is 9 digits").optional().or(z.literal("")),
  bankAccount: z.string().trim().max(60).optional(), joinedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export async function savePayTerms(userId: string, input: z.input<typeof employmentSchema>): Promise<R> {
  const me = await requirePermission("payroll");
  const p = employmentSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the amounts." };
  const d = p.data;
  return run("savePayTerms", () => db.$transaction((tx) => saveEmployment(tx, me, userId, { basic: paisa(d.basic), allowance: paisa(d.allowance), inSsf: d.inSsf, married: d.married, active: d.active, pan: d.pan || null, bankAccount: d.bankAccount || null, joinedOn: d.joinedOn || null })));
}

const band = z.object({ upTo: z.coerce.number().positive().nullable(), rate: z.coerce.number().min(0).max(60) });
const taxSchema = z.object({ fiscalYear: z.string().regex(/^\d{4}\/\d{2}$/), single: z.array(band).min(1).max(12), married: z.array(band).min(1).max(12), ssfFirstBandZero: z.boolean(), source: z.string().trim().max(200).optional() });

export async function saveTaxBands(input: z.input<typeof taxSchema>): Promise<R> {
  const me = await requirePermission("payroll");
  const p = taxSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Each band needs a limit in rupees (except the last) and a rate." };
  return run("saveTaxBands", () => db.$transaction((tx) => saveTaxYear(tx, me, p.data.fiscalYear, p.data)));
}

export async function confirmTaxBands(fiscalYear: string): Promise<R> {
  const me = await requirePermission("payroll");
  return run("confirmTaxBands", () => db.$transaction((tx) => confirmTaxYear(tx, me, fiscalYear)));
}

export async function buildPayroll(month: string): Promise<R> {
  const me = await requirePermission("payroll");
  const r = await run("buildPayroll", () => db.$transaction((tx) => buildRun(tx, me, month), { timeout: 60_000 }));
  if (r.ok) redirect(`/admin/payroll/${month}`);
  return r;
}

const adjustSchema = z.object({ bonus: money, extraUnpaidDays: z.coerce.number().int().min(0).max(31), note: z.string().trim().max(200).optional() });

export async function adjustPayslip(slipId: string, input: z.input<typeof adjustSchema>): Promise<R> {
  const me = await requirePermission("payroll");
  const p = adjustSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the bonus and days." };
  return run("adjustPayslip", () => db.$transaction((tx) => adjustSlip(tx, me, slipId, { bonus: paisa(p.data.bonus), extraUnpaidDays: p.data.extraUnpaidDays, note: p.data.note })));
}

export async function approvePayroll(month: string): Promise<R> {
  const me = await requirePermission("payroll");
  return run("approvePayroll", () => db.$transaction((tx) => approveRun(tx, me, month)));
}

export async function reopenPayroll(month: string, reason: string): Promise<R> {
  const me = await requirePermission("payroll");
  if (reason.trim().length < 3) return { ok: false, error: "Say why, for the record." };
  return run("reopenPayroll", () => db.$transaction((tx) => reopenRun(tx, me, month, reason.trim().slice(0, 200))));
}

export async function payPayroll(month: string, paidVia: string): Promise<R> {
  const me = await requirePermission("payroll");
  const via = paidVia.trim().slice(0, 40);
  if (!via) return { ok: false, error: "How were salaries paid?" };
  return run("payPayroll", () => db.$transaction((tx) => markPaid(tx, me, month, via)));
}

const ruleSchema = z.object({ storeId: z.string().nullable(), ratePct: z.coerce.number().min(0).max(20), threshold: z.coerce.number().min(0).max(100_000_000), active: z.boolean() });

/** Commission for one shop (storeId) or every shop (null): % of sales excl. VAT once the monthly target is reached. */
export async function saveCommissionRule(input: z.input<typeof ruleSchema>): Promise<R> {
  const me = await requirePermission("payroll");
  const p = ruleSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "The rate is 0–20% and the target a rupee amount." };
  try {
    await db.$transaction((tx) => saveRule(tx, me, { storeId: p.data.storeId, rateBp: Math.round(p.data.ratePct * 100), threshold: paisa(p.data.threshold), active: p.data.active }));
  } catch (e) {
    if (e instanceof CommissionError) return { ok: false, error: e.message };
    void reportError("saveCommissionRule", e);
    return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
  }
  refresh();
  return { ok: true };
}
