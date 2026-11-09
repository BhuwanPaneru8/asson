import "server-only";
import { randomBytes } from "node:crypto";
import type { Payment, PaymentProvider, Prisma } from "@prisma/client";
import { db } from "../db";
import { TransitionError, transitionOrder } from "../orders";
import { formatOrderNumber } from "../utils";
import { buildEsewaForm, esewaEnabled, esewaStatus } from "./esewa";
import { khaltiEnabled, khaltiInitiate, khaltiLookup } from "./khalti";

/**
 * Online payments for Nepal (eSewa, Khalti).
 *
 * Invariants:
 *  - An order is marked PAID only after the provider confirms it server-to-server (signed eSewa
 *    response or Khalti lookup), and only if the confirmed amount equals the order total.
 *  - Settling is idempotent: duplicate callbacks, refreshes and reconciliation can't double-apply.
 *  - Unpaid online orders hold stock only until `paymentDueAt`; then they are reconciled once more
 *    with the provider and cancelled (restocking) if still unpaid.
 */

export const PAYMENT_WINDOW_MIN = 45;
const MAX_HOLD_MIN = 120;

export function enabledProviders(): Record<PaymentProvider, boolean> {
  return { ESEWA: esewaEnabled(), KHALTI: khaltiEnabled() };
}
export const onlinePaymentsEnabled = () => Object.values(enabledProviders()).some(Boolean);

export const PROVIDER_LABEL: Record<PaymentProvider, string> = { ESEWA: "eSewa", KHALTI: "Khalti" };

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Order is waiting for an online payment and may (re)start one. */
export function canPayOnline(o: { status: string; paymentStatus: string; paymentMethod: string }) {
  return o.paymentMethod === "ONLINE" && o.paymentStatus === "PENDING" && o.status === "PENDING";
}

type StartResult =
  | { kind: "form"; action: string; fields: Record<string, string> }
  | { kind: "redirect"; url: string }
  | { kind: "error"; message: string };

export async function startPayment(orderId: string, provider: PaymentProvider): Promise<StartResult> {
  if (!enabledProviders()[provider]) return { kind: "error", message: `${PROVIDER_LABEL[provider]} isn't available right now.` };
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { kind: "error", message: "Order not found." };
  if (order.paymentStatus === "PAID") return { kind: "error", message: "This order is already paid." };
  if (!canPayOnline(order)) return { kind: "error", message: "This order can no longer be paid online." };
  if (order.paymentDueAt && order.paymentDueAt < new Date()) return { kind: "error", message: "The payment window for this order has closed." };

  // Each attempt needs a fresh, unique id (eSewa rejects reused transaction_uuids)
  const reference = `${formatOrderNumber(order.number)}-${randomBytes(4).toString("hex")}`;
  const payment = await db.payment.create({ data: { orderId, provider, amount: order.total, reference } });

  // Give the customer a fresh window for this attempt, without holding stock indefinitely
  const cap = new Date(order.createdAt.getTime() + MAX_HOLD_MIN * 60_000);
  const due = new Date(Math.min(Date.now() + 30 * 60_000, cap.getTime()));
  await db.order.update({ where: { id: orderId }, data: { paymentProvider: provider, ...(order.paymentDueAt && due > order.paymentDueAt ? { paymentDueAt: due } : {}) } });

  if (provider === "ESEWA") {
    const { action, fields } = buildEsewaForm({
      reference,
      total: order.total,
      deliveryCharge: order.shippingFee,
      successUrl: `${siteUrl()}/api/payments/esewa/success/${reference}`,
      failureUrl: `${siteUrl()}/api/payments/esewa/failure/${reference}`,
    });
    return { kind: "form", action, fields };
  }

  const addr = order.shippingAddress as { fullName?: string };
  const r = await khaltiInitiate({
    reference,
    orderName: `${formatOrderNumber(order.number)}`,
    amount: order.total,
    returnUrl: `${siteUrl()}/api/payments/khalti/return`,
    websiteUrl: siteUrl(),
    customer: { name: addr?.fullName ?? "Customer", email: order.email, phone: order.phone },
  });
  if (!r.ok) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", raw: { initiateError: r.error ?? null, httpStatus: r.status } as Prisma.InputJsonValue } });
    console.error("Khalti initiate failed", r.status, r.error);
    return { kind: "error", message: "We couldn't reach Khalti. Please try again or choose another payment method." };
  }
  await db.payment.update({ where: { id: payment.id }, data: { providerRef: r.data.pidx } });
  return { kind: "redirect", url: r.data.payment_url };
}

/** Idempotently record a verified payment against its order. */
export async function settlePaid(paymentId: string, opts: { amount: number; providerTxn: string | null; raw: unknown }) {
  return db.$transaction(async (tx) => {
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
    if (opts.amount !== p.order.total || opts.amount !== p.amount) {
      // Amount mismatch = possible tampering. Never mark paid; flag for a human.
      await tx.payment.update({ where: { id: p.id }, data: { status: "AMBIGUOUS", raw: opts.raw as Prisma.InputJsonValue } });
      await tx.orderEvent.create({ data: { orderId: p.orderId, actor: "system", message: `⚠ ${PROVIDER_LABEL[p.provider]} reported ${opts.amount / 100} but order total is ${p.order.total / 100}. Not marked paid — review.` } });
      return { ok: false as const, orderId: p.orderId };
    }
    const changed = await tx.payment.updateMany({ where: { id: p.id, status: { not: "COMPLETED" } }, data: { status: "COMPLETED", providerTxn: opts.providerTxn, raw: opts.raw as Prisma.InputJsonValue } });
    if (changed.count === 0) return { ok: true as const, orderId: p.orderId }; // already settled
    const upd = await tx.order.updateMany({ where: { id: p.orderId, paymentStatus: "PENDING" }, data: { paymentStatus: "PAID", paymentMethod: "ONLINE", paymentProvider: p.provider, paymentRef: opts.providerTxn, paymentDueAt: null } });
    const label = PROVIDER_LABEL[p.provider];
    if (upd.count === 0) {
      await tx.orderEvent.create({ data: { orderId: p.orderId, actor: "system", message: `⚠ ${label} payment ${opts.providerTxn ?? ""} received but order was already ${p.order.paymentStatus.toLowerCase()} — refund the duplicate.` } });
    } else if (p.order.status === "CANCELLED") {
      await tx.orderEvent.create({ data: { orderId: p.orderId, actor: "system", message: `⚠ ${label} payment ${opts.providerTxn ?? ""} arrived after the order was cancelled — refund required.` } });
    } else {
      await tx.orderEvent.create({ data: { orderId: p.orderId, actor: "system", message: `Paid via ${label}${opts.providerTxn ? ` (ref ${opts.providerTxn})` : ""}` } });
    }
    return { ok: true as const, orderId: p.orderId };
  });
}

export async function settleFailed(paymentId: string, status: "FAILED" | "AMBIGUOUS", raw: unknown) {
  await db.payment.updateMany({ where: { id: paymentId, status: { in: ["INITIATED", "AMBIGUOUS"] } }, data: { status, raw: raw as Prisma.InputJsonValue } });
}

/** Ask the provider what really happened to an attempt and record it. */
export async function reconcile(p: Payment): Promise<"COMPLETED" | "FAILED" | "AMBIGUOUS" | "UNKNOWN"> {
  if (p.status === "COMPLETED") return "COMPLETED";
  if (p.provider === "ESEWA") {
    const s = await esewaStatus(p.reference, p.amount);
    if (s.status === "COMPLETE") { await settlePaid(p.id, { amount: s.amount ?? p.amount, providerTxn: s.refId, raw: s }); return "COMPLETED"; }
    if (s.status === "NOT_FOUND" || s.status === "CANCELED") { await settleFailed(p.id, "FAILED", s); return "FAILED"; }
    if (s.status === "UNKNOWN") return "UNKNOWN";
    await settleFailed(p.id, "AMBIGUOUS", s); // PENDING / AMBIGUOUS / refunds — hold
    return "AMBIGUOUS";
  }
  if (!p.providerRef) { await settleFailed(p.id, "FAILED", { reason: "never initiated" }); return "FAILED"; }
  const s = await khaltiLookup(p.providerRef);
  if (s.status === "Completed") { await settlePaid(p.id, { amount: s.amount ?? -1, providerTxn: s.transactionId, raw: s.raw }); return "COMPLETED"; }
  if (s.status === "Expired" || s.status === "User canceled") { await settleFailed(p.id, "FAILED", s.raw); return "FAILED"; }
  if (s.status === "UNKNOWN") return "UNKNOWN";
  if (s.status === "Initiated") return "UNKNOWN"; // customer may still be paying
  await settleFailed(p.id, "AMBIGUOUS", s.raw); // Pending / refunds — hold and review
  return "AMBIGUOUS";
}

/**
 * Release stock held by online orders that were never paid. Safe to run often (cron every ~5 min).
 * Orders with an ambiguous attempt are left for a human instead of being auto-cancelled.
 */
export async function expireUnpaidOrders(limit = 50) {
  const stale = await db.order.findMany({
    where: { paymentMethod: "ONLINE", paymentStatus: "PENDING", status: "PENDING", paymentDueAt: { lt: new Date() } },
    include: { payments: true },
    take: limit,
    orderBy: { paymentDueAt: "asc" },
  });
  let cancelled = 0, paid = 0, held = 0;
  for (const o of stale) {
    const results = await Promise.all(o.payments.filter((p) => p.status !== "FAILED").map(reconcile));
    if (results.includes("COMPLETED")) { paid++; continue; }
    if (results.includes("AMBIGUOUS") || results.includes("UNKNOWN")) {
      held++;
      if (results.includes("AMBIGUOUS")) await db.order.update({ where: { id: o.id }, data: { paymentDueAt: null } }); // stop retrying; needs review
      continue;
    }
    try {
      await transitionOrder({ orderId: o.id, to: "CANCELLED", actor: "system", message: "Cancelled automatically — online payment was not completed" });
      cancelled++;
    } catch (e) {
      if (!(e instanceof TransitionError)) throw e;
    }
  }
  return { checked: stale.length, cancelled, paid, held };
}
