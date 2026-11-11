"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { ScopeError } from "@/lib/scope";
import { addParcel, cancelManifest, handOver, ManifestError, openManifest, removeParcel } from "@/lib/manifests";

async function run<T>(where: string, f: () => Promise<T>) {
  try { const r = await f(); refresh(); return { ok: true as const, result: r }; } catch (e) {
    if (e instanceof ManifestError || e instanceof ScopeError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
}

export async function openManifestAction(storeId: string, carrier: string) {
  const me = await requirePermission("orders");
  return run("openManifest", async () => (await db.$transaction((tx) => openManifest(tx, me, { storeId: String(storeId), carrier: String(carrier ?? "") }))).manifest.id);
}

const scanSchema = z.object({ manifestId: z.string(), order: z.string().max(40), trackingNumber: z.string().max(60).optional() });
export async function addParcelAction(input: z.input<typeof scanSchema>) {
  const me = await requirePermission("orders");
  const p = scanSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Scan the order number." };
  return run("addParcel", () => db.$transaction((tx) => addParcel(tx, me, p.data.manifestId, p.data)));
}

export async function removeParcelAction(manifestId: string, orderId: string) {
  const me = await requirePermission("orders");
  return run("removeParcel", () => db.$transaction((tx) => removeParcel(tx, me, String(manifestId), String(orderId))));
}

export async function cancelManifestAction(manifestId: string) {
  const me = await requirePermission("orders");
  return run("cancelManifest", () => db.$transaction((tx) => cancelManifest(tx, me, String(manifestId))));
}

const handSchema = z.object({ manifestId: z.string(), riderName: z.string().max(80), riderPhone: z.string().max(30).optional(), parcels: z.number().int().min(0).max(10_000) });
export async function handOverAction(input: z.input<typeof handSchema>) {
  const me = await requirePermission("orders");
  const p = handSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Enter the rider's name and the parcels they counted." };
  // up to 300 orders ship together, so give the transaction room
  return run("handOver", () => db.$transaction((tx) => handOver(tx, me, p.data.manifestId, p.data), { timeout: 120_000, maxWait: 10_000 }));
}
