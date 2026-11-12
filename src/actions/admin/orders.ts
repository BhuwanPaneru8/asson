"use server";

import { reportErrorSoon } from "@/lib/errors";
import { refresh, revalidateTag } from "next/cache";
import { z } from "zod";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { formatOrderNumber, formatPrice } from "@/lib/utils";
import { TransitionError, transitionOrder } from "@/lib/orders";
import { after } from "next/server";
import { dispatchNotifications } from "@/lib/notifications";
import { changeAddress, EditError, reduceItem, swapSize } from "@/lib/order-edits";

const sendSoon = () => after(() => dispatchNotifications().catch(reportErrorSoon("dispatchNotifications")));

type R = { ok: boolean; error?: string; message?: string };
const statusEnum = z.enum(["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "RETURNING", "DELIVERED", "CANCELLED", "RETURN_REQUESTED", "RETURNED"]);

export async function updateOrderStatus(input: { orderId: string; to: OrderStatus; note?: string; carrier?: string; trackingNumber?: string }): Promise<R> {
  const staff = await requirePermission("orders");
  const p = z.object({ orderId: z.string(), to: statusEnum, note: z.string().max(500).optional(), carrier: z.string().max(60).optional(), trackingNumber: z.string().max(60).optional() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };
  if (p.data.to === "SHIPPED" && !p.data.trackingNumber?.trim()) return { ok: false, error: "Add a tracking number before marking as shipped." };
  try {
    await transitionOrder({ orderId: p.data.orderId, to: p.data.to, actor: staff.email, actorId: staff.id, message: p.data.note || undefined, shipping: { carrier: p.data.carrier?.trim(), trackingNumber: p.data.trackingNumber?.trim() } });
  } catch (e) {
    return { ok: false, error: e instanceof TransitionError ? e.message : "Update failed." };
  }
  if (["CANCELLED", "RETURNED"].includes(p.data.to)) revalidateTag("products", { expire: 0 });
  sendSoon();
  refresh();
  return { ok: true };
}

/** Move many orders forward at once (e.g. confirm all pending, pack a pick-list). */
export async function bulkUpdateStatus(orderIds: string[], to: OrderStatus): Promise<R> {
  const staff = await requirePermission("orders");
  if (!orderIds.length || orderIds.length > 200) return { ok: false, error: "Select between 1 and 200 orders." };
  if (to === "SHIPPED") return { ok: false, error: "Ship orders individually so each gets a tracking number." };
  let done = 0;
  const failed: string[] = [];
  for (const id of orderIds) {
    try { await transitionOrder({ orderId: id, to, actor: staff.email, actorId: staff.id }); done++; }
    catch { failed.push(id); }
  }
  if (["CANCELLED", "RETURNED"].includes(to)) revalidateTag("products", { expire: 0 });
  sendSoon();
  refresh();
  return { ok: true, message: `${done} updated${failed.length ? `, ${failed.length} skipped (not eligible)` : ""}.` };
}

export async function addOrderNote(orderId: string, message: string): Promise<R> {
  const staff = await requirePermission("orders");
  const m = message.trim().slice(0, 1000);
  if (!m) return { ok: false, error: "Note is empty." };
  await db.orderEvent.create({ data: { orderId, message: m, actor: staff.email } });
  refresh();
  return { ok: true };
}

export async function markPaid(orderId: string, reference?: string): Promise<R> {
  const staff = await requirePermission("orders");
  const ok = await db.$transaction(async (tx) => {
    const res = await tx.order.updateMany({ where: { id: orderId, paymentStatus: "PENDING" }, data: { paymentStatus: "PAID", paymentRef: reference?.slice(0, 100) || undefined } });
    if (!res.count) return false;
    await tx.orderEvent.create({ data: { orderId, message: `Payment marked as received${reference ? ` (${reference})` : ""}`, actor: staff.email } });
    const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { number: true, total: true, paymentMethod: true } });
    await audit(tx, staff, { action: "order.paid", entity: ["Order", orderId], summary: `${formatOrderNumber(o.number)}: marked paid ${formatPrice(o.total)} (${o.paymentMethod})${reference ? ` ref ${reference.slice(0, 60)}` : ""}`, changes: { paymentStatus: ["PENDING", "PAID"] } });
    return true;
  });
  if (!ok) return { ok: false, error: "Payment is not pending." };
  refresh();
  return { ok: true };
}

// ---------- COD verification call ----------

/** Record the outcome of the confirmation call. Confirmed → order confirmed; rejected → cancelled (restocked). */
export async function recordCall(orderId: string, outcome: "CONFIRMED" | "NO_ANSWER" | "REJECTED", note?: string): Promise<R> {
  const staff = await requirePermission("orders");
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true, callAttempts: true } });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "PENDING") return { ok: false, error: "Only new orders need a confirmation call." };
  const n = order.callAttempts + 1;
  await db.order.update({ where: { id: orderId }, data: { callOutcome: outcome, callAttempts: n } });
  const msg = { CONFIRMED: "Customer confirmed on call", NO_ANSWER: `Call attempt ${n}: no answer`, REJECTED: "Customer did not place / rejected this order on call" }[outcome];
  try {
    if (outcome === "CONFIRMED") await transitionOrder({ orderId, to: "CONFIRMED", actor: staff.email, actorId: staff.id, message: `${msg}${note ? ` — ${note}` : ""}` });
    else if (outcome === "REJECTED") await transitionOrder({ orderId, to: "CANCELLED", actor: staff.email, actorId: staff.id, message: `${msg}${note ? ` — ${note}` : ""}` });
    else await db.orderEvent.create({ data: { orderId, actor: staff.email, message: `${msg}${note ? ` — ${note}` : ""}` } });
  } catch (e) {
    return { ok: false, error: e instanceof TransitionError ? e.message : "Update failed." };
  }
  if (outcome !== "NO_ANSWER") sendSoon();
  if (outcome === "REJECTED") revalidateTag("products", { expire: 0 });
  refresh();
  return { ok: true, message: outcome === "NO_ANSWER" && n >= 3 ? "Three unanswered calls — consider cancelling this order." : undefined };
}

// ---------- COD remittance ----------

const remitSchema = z.object({
  carrier: z.string().trim().min(2).max(60),
  reference: z.string().trim().min(2, "Enter the bank / statement reference").max(80),
  received: z.number().int().min(0),
  orderIds: z.array(z.string()).min(1).max(1000),
  note: z.string().trim().max(300).optional(),
});

/** Record money a courier paid us for COD it collected. Each order can be remitted only once. */
export async function recordCodRemittance(input: z.input<typeof remitSchema>): Promise<R> {
  const staff = await requirePermission("closing");
  const p = remitSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;
  try {
    await db.$transaction(async (tx) => {
      const orders = await tx.order.findMany({ where: { id: { in: d.orderIds }, paymentMethod: "COD", status: "DELIVERED", codRemittanceId: null }, select: { id: true, total: true } });
      if (orders.length !== d.orderIds.length) throw new TransitionError("Some orders are not delivered COD orders awaiting remittance (or were already remitted). Refresh and try again.");
      const expected = orders.reduce((s, o) => s + o.total, 0);
      const rem = await tx.codRemittance.create({ data: { carrier: d.carrier, reference: d.reference, expected, received: d.received, note: d.note || null, createdById: staff.id } });
      const res = await tx.order.updateMany({ where: { id: { in: d.orderIds }, codRemittanceId: null }, data: { codRemittanceId: rem.id } });
      if (res.count !== d.orderIds.length) throw new TransitionError("Another remittance just claimed some of these orders.");
      await tx.orderEvent.createMany({ data: orders.map((o) => ({ orderId: o.id, actor: staff.email, message: `COD remitted by ${d.carrier} (ref ${d.reference})` })) });
      await audit(tx, staff, { action: "cod.remittance", entity: ["CodRemittance", rem.id], summary: `${d.carrier} remittance ${d.reference}: received ${formatPrice(d.received)} of ${formatPrice(expected)} for ${orders.length} order${orders.length > 1 ? "s" : ""}${d.received !== expected ? ` (difference ${formatPrice(d.received - expected)})` : ""}`, changes: { expected, received: d.received, orders: orders.length } });
    });
  } catch (e) {
    return { ok: false, error: e instanceof TransitionError ? e.message : "Couldn't record the remittance." };
  }
  refresh();
  return { ok: true };
}

// ---------- Changing an order before it's packed ----------

async function editRun(where: string, f: () => Promise<unknown>): Promise<R> {
  try {
    await f();
    revalidateTag("products", { expire: 60 });
    sendSoon();
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof EditError) return { ok: false, error: e.message };
    reportErrorSoon(where)(e);
    return { ok: false, error: "Couldn't change the order. Nothing was changed — please try again." };
  }
}
export async function reduceItemAction(orderId: string, orderItemId: string, quantity: number): Promise<R> {
  const me = await requirePermission("orders");
  return editRun("reduceItem", () => db.$transaction((tx) => reduceItem(tx, me, { orderId: String(orderId), orderItemId: String(orderItemId), quantity: Number(quantity) })));
}
export async function swapSizeAction(orderId: string, orderItemId: string, newVariantId: string, quantity?: number): Promise<R> {
  const me = await requirePermission("orders");
  return editRun("swapSize", () => db.$transaction((tx) => swapSize(tx, me, { orderId: String(orderId), orderItemId: String(orderItemId), newVariantId: String(newVariantId), quantity: quantity == null ? undefined : Number(quantity) })));
}
export async function changeAddressAction(orderId: string, address: unknown): Promise<R> {
  const me = await requirePermission("orders");
  return editRun("changeAddress", () => db.$transaction((tx) => changeAddress(tx, me, { orderId: String(orderId), address })));
}
