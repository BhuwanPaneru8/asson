"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { ScopeError } from "@/lib/scope";
import { createExchange, ExchangeError, exchangeRef, receiveExchange } from "@/lib/exchanges";
import { StockError } from "@/lib/stock";
import { dispatchNotifications } from "@/lib/notifications";
import { after } from "next/server";
import { formatOrderNumber, parseOrderNumber } from "@/lib/utils";

/** Find the open exchange behind a scanned number (original order, replacement order or EX-). */
export async function lookupExchangeAction(raw: string) {
  await requirePermission("orders");
  const v = String(raw ?? "").trim().toUpperCase();
  const exNo = /^EX-?\d+$/.test(v) ? Number(v.replace(/\D/g, "")) : null;
  const n = exNo ? null : parseOrderNumber(v);
  const ex = exNo ? await db.exchange.findUnique({ where: { number: exNo }, include: { items: { include: { orderItem: { select: { name: true, size: true, color: true } } } }, order: { select: { number: true } }, replacement: { select: { number: true, status: true } } } })
    : n ? await db.exchange.findFirst({ where: { status: "OPEN", OR: [{ order: { number: n } }, { replacement: { number: n } }] }, orderBy: { createdAt: "asc" }, include: { items: { include: { orderItem: { select: { name: true, size: true, color: true } } } }, order: { select: { number: true } }, replacement: { select: { number: true, status: true } } } }) : null;
  if (!ex) return { ok: false as const, error: "No open exchange for that number." };
  if (ex.status !== "OPEN") return { ok: false as const, error: `${exchangeRef(ex.number)} is already ${ex.status === "DONE" ? "received" : "cancelled"}.` };
  return { ok: true as const, exchange: { ref: exchangeRef(ex.number), from: formatOrderNumber(ex.order.number), replacement: formatOrderNumber(ex.replacement.number), replacementStatus: ex.replacement.status, items: ex.items.map((i) => ({ id: i.id, label: `${i.orderItem.name} · ${i.orderItem.color} ${i.orderItem.size}`, quantity: i.quantity })) } };
}

const schema = z.object({ ref: z.string().max(40), storeId: z.string(), conditions: z.record(z.string(), z.enum(["RESELLABLE", "DAMAGED"])) });
export async function receiveExchangeAction(input: z.input<typeof schema>) {
  const me = await requirePermission("orders");
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Scan the exchange and check each item." };
  try {
    const r = await db.$transaction((tx) => receiveExchange(tx, me, p.data));
    refresh();
    return { ok: true as const, result: r };
  } catch (e) {
    if (e instanceof ExchangeError || e instanceof ScopeError) return { ok: false as const, error: e.message };
    void reportError("receiveExchange", e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
}

const staffSchema = z.object({ orderId: z.string(), reason: z.string().max(300), lines: z.array(z.object({ orderItemId: z.string(), quantity: z.number().int().min(0).max(99), newVariantId: z.string() })).min(1).max(50) });
/** Care staff start an exchange for a customer who called or messaged (same rules as the customer's own). */
export async function staffExchangeAction(input: z.input<typeof staffSchema>) {
  const me = await requirePermission("care");
  const p = staffSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Choose the new size for at least one item." };
  try {
    const r = await db.$transaction((tx) => createExchange(tx, { orderId: p.data.orderId, lines: p.data.lines, reason: p.data.reason || "Size exchange (by phone)", actor: me.email ?? me.name, staff: me }), { timeout: 15_000 });
    after(() => dispatchNotifications().catch(() => {}));
    refresh();
    return { ok: true as const, result: { number: r.exchange.number, replacementId: r.replacement.id } };
  } catch (e) {
    if (e instanceof ExchangeError || e instanceof StockError) return { ok: false as const, error: e.message };
    void reportError("staffExchange", e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
}
