"use server";

import { after } from "next/server";
import { refresh, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError, reportErrorSoon } from "@/lib/errors";
import { dispatchNotifications } from "@/lib/notifications";
import { requireStoreAccess, ScopeError } from "@/lib/scope";
import { approveCount, cancelCount, clearLine, CountError, recordCount, startCount, submitCount } from "@/lib/counts";

/** Every count action is limited to staff who work at the count's location. */
async function requireCountAccess(user: { id: string; role: string }, countId: string) {
  const c = await db.stockCount.findUnique({ where: { id: countId }, select: { storeId: true } });
  if (!c) throw new CountError("Count not found.");
  await requireStoreAccess(user, c.storeId);
}

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function failure(e: unknown, where: string): { ok: false; error: string } {
  if (e instanceof CountError || e instanceof ScopeError) return { ok: false, error: e.message };
  void reportError(where, e);
  return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
}

export async function startStockCount(input: { storeId: string; categoryId?: string; note?: string }): Promise<R> {
  const me = await requirePermission("stock.count");
  const p = z.object({ storeId: z.string().min(1), categoryId: z.string().optional(), note: z.string().trim().max(300).optional() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Pick a location." };
  let id: string;
  try {
    await requireStoreAccess(me, p.data.storeId);
    id = (await db.$transaction((tx) => startCount(tx, me, { ...p.data, categoryId: p.data.categoryId || null }), { timeout: 30_000 })).id;
  } catch (e) {
    return failure(e, "startStockCount");
  }
  redirect(`/admin/counts/${id}`);
}

/** A barcode scan or typed SKU: +1 on that item. Returns only the counted figure (counting is blind). */
export async function scanForCount(countId: string, code: string): Promise<R<{ variantId: string; sku: string; name: string; color: string; size: string; counted: number }>> {
  const me = await requirePermission("stock.count");
  const sku = code.trim().slice(0, 60);
  if (!sku) return { ok: false, error: "Scan or type a SKU." };
  const v = await db.variant.findFirst({ where: { sku: { equals: sku, mode: "insensitive" } }, select: { id: true, sku: true, color: true, size: true, product: { select: { name: true } } } });
  if (!v) return { ok: false, error: `No item with SKU ${sku}.` };
  try {
    await requireCountAccess(me, countId);
    const counted = await db.$transaction((tx) => recordCount(tx, me, countId, v.id, { add: 1 }));
    return { ok: true, variantId: v.id, sku: v.sku, name: v.product.name, color: v.color, size: v.size, counted };
  } catch (e) {
    return failure(e, "scanForCount");
  }
}

export async function setCountLine(countId: string, variantId: string, quantity: number | null): Promise<R<{ counted: number | null }>> {
  const me = await requirePermission("stock.count");
  try {
    await requireCountAccess(me, countId);
    if (quantity == null) {
      await db.$transaction((tx) => clearLine(tx, countId, variantId));
      return { ok: true, counted: null };
    }
    const counted = await db.$transaction((tx) => recordCount(tx, me, countId, variantId, { set: quantity }));
    return { ok: true, counted };
  } catch (e) {
    return failure(e, "setCountLine");
  }
}

export async function submitStockCount(countId: string): Promise<R> {
  const me = await requirePermission("stock.count");
  try {
    await requireCountAccess(me, countId);
    await db.$transaction((tx) => submitCount(tx, me, countId));
  } catch (e) {
    return failure(e, "submitStockCount");
  }
  refresh();
  return { ok: true };
}

export async function approveStockCount(countId: string, note?: string): Promise<R<{ plus: number; minus: number }>> {
  const me = await requirePermission("inventory.adjust");
  try {
    await requireCountAccess(me, countId);
    const r = await db.$transaction((tx) => approveCount(tx, me, countId, note?.trim().slice(0, 300)), { timeout: 60_000 });
    revalidateTag("products", { expire: 60 });
    if (r.plus) after(() => dispatchNotifications().catch(reportErrorSoon("dispatchNotifications")));
    refresh();
    return { ok: true, plus: r.plus, minus: r.minus };
  } catch (e) {
    return failure(e, "approveStockCount");
  }
}

export async function cancelStockCount(countId: string, reason: string): Promise<R> {
  const me = await requirePermission("stock.count");
  const why = reason.trim();
  if (why.length < 3) return { ok: false, error: "Say why the count is cancelled." };
  const c = await db.stockCount.findUnique({ where: { id: countId }, select: { status: true } });
  // once submitted, only someone who could approve it may throw it away
  if (c?.status === "SUBMITTED") await requirePermission("inventory.adjust");
  try {
    await requireCountAccess(me, countId);
    await db.$transaction((tx) => cancelCount(tx, me, countId, why));
  } catch (e) {
    return failure(e, "cancelStockCount");
  }
  refresh();
  return { ok: true };
}
