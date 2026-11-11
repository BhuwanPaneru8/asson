"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { ScopeError } from "@/lib/scope";
import { cancelWave, createWave, finishWave, FulfilmentError, packOrder, packingView } from "@/lib/fulfilment";
import { parseOrderNumber } from "@/lib/utils";

async function run<T>(where: string, f: () => Promise<T>) {
  try { const r = await f(); refresh(); return { ok: true as const, result: r }; } catch (e) {
    if (e instanceof FulfilmentError || e instanceof ScopeError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
}

export async function createWaveAction(storeId: string, maxOrders: number) {
  const me = await requirePermission("orders");
  return run("createWave", async () => (await db.$transaction((tx) => createWave(tx, me, { storeId: String(storeId), maxOrders: Number(maxOrders) }))).id);
}
export async function finishWaveAction(waveId: string) {
  const me = await requirePermission("orders");
  return run("finishWave", () => db.$transaction((tx) => finishWave(tx, me, String(waveId))));
}
export async function cancelWaveAction(waveId: string) {
  const me = await requirePermission("orders");
  return run("cancelWave", () => db.$transaction((tx) => cancelWave(tx, me, String(waveId))));
}

/** Look an order up at the packing station (scanned or typed number, e.g. AS000123). */
export async function lookupForPacking(raw: string) {
  await requirePermission("orders");
  const n = parseOrderNumber(String(raw ?? ""));
  const v = n ? await packingView(n) : null;
  if (!v) return { ok: false as const, error: "No order with that number." };
  if (v.status !== "CONFIRMED") return { ok: false as const, error: `That order is ${v.status.toLowerCase().replace(/_/g, " ")}, not waiting to be packed.` };
  return { ok: true as const, order: { id: v.id, number: v.number, expected: v.expected, from: v.from, unpicked: v.unpicked, slot: v.waveOrder?.slot ?? null, wave: v.waveOrder?.wave.number ?? null, express: v.shippingMethod === "express", pickup: v.pickupStore?.name ?? null } };
}

const packSchema = z.object({ orderId: z.string(), storeId: z.string().optional(), scans: z.array(z.object({ sku: z.string().max(60), quantity: z.number().int().min(1).max(999) })).max(200), weightGrams: z.number().int().optional(), box: z.string().max(40).optional(), override: z.string().max(300).optional() });

export async function packAction(input: z.input<typeof packSchema>) {
  const me = await requirePermission("orders");
  const p = packSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Check the scans." };
  return run("packOrder", () => packOrder(me, p.data));
}
