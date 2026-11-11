"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { ScopeError } from "@/lib/scope";
import { DeliveryError, REASONS, receiveReturn, recordAttempt, reportLost, startReturn } from "@/lib/deliveries";

async function run<T>(where: string, f: () => Promise<T>) {
  try { const r = await f(); refresh(); return { ok: true as const, result: r }; } catch (e) {
    if (e instanceof DeliveryError || e instanceof ScopeError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
}

const reason = z.enum(REASONS as [string, ...string[]]).transform((r) => r as (typeof REASONS)[number]);
const attemptSchema = z.object({ orderId: z.string(), reason, note: z.string().max(300).optional() });

export async function recordAttemptAction(input: z.input<typeof attemptSchema>) {
  const me = await requirePermission("orders");
  const p = attemptSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Choose what happened." };
  return run("recordAttempt", () => db.$transaction((tx) => recordAttempt(tx, me, p.data)));
}

const returnSchema = z.object({ orderId: z.string(), reason: reason.optional(), note: z.string().max(300).optional() });
export async function startReturnAction(input: z.input<typeof returnSchema>) {
  const me = await requirePermission("orders");
  const p = returnSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Choose why it's coming back." };
  return run("startReturn", () => db.$transaction((tx) => startReturn(tx, me, p.data)));
}

const receiveSchema = z.object({ order: z.string().max(40), storeId: z.string(), damaged: z.boolean(), courierCharge: z.number().int().min(0), note: z.string().max(300).optional() });
export async function receiveReturnAction(input: z.input<typeof receiveSchema>) {
  const me = await requirePermission("orders");
  const p = receiveSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Scan the order number and check the fee." };
  return run("receiveReturn", () => db.$transaction((tx) => receiveReturn(tx, me, p.data)));
}

export async function reportLostAction(orderId: string, note: string) {
  const me = await requirePermission("orders");
  return run("reportLost", () => db.$transaction((tx) => reportLost(tx, me, { orderId: String(orderId), note: String(note ?? "").slice(0, 300) })));
}
