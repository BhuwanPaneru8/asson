import "server-only";
import type { NotificationChannel, OrderStatus, Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { store } from "./config";
import { formatOrderNumber, formatPrice } from "./utils";

/**
 * Customer notifications use an OUTBOX: the message is written in the same transaction as the event
 * that caused it, then a dispatcher sends it through a provider. Nothing is lost if the SMS gateway is
 * down — it retries — and every message is auditable in Admin → Notifications.
 *
 * Providers (NOTIFY_SMS_PROVIDER):
 *   "log"  — development: prints the SMS to the server log and marks it sent (never used in production)
 *   unset  — production without a gateway yet: messages stay QUEUED (visible to staff, sent later)
 *   Real gateways (Sparrow SMS, Aakash SMS, WhatsApp Business) plug in at `providers` below once the
 *   merchant account and API keys exist — implement them against the provider's official docs.
 */

export type OrderNotice = "placed" | "confirmed" | "ready_for_pickup" | "collected" | "shipped" | "out_for_delivery" | "delivered" | "cancelled" | "return_requested" | "returned" | "refund";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

type OrderForMessage = { id: string; number: number; phone: string; total: number; paymentMethod: string; paymentStatus?: string; carrier: string | null; trackingNumber: string | null; shippingAddress: unknown };

/** SMS copy: short (aim for one 160-char segment), specific, with the order link. */
export function renderSms(notice: OrderNotice, o: OrderForMessage, extra: { amount?: number } = {}) {
  const n = formatOrderNumber(o.number);
  const name = ((o.shippingAddress as { fullName?: string })?.fullName ?? "").split(" ")[0];
  const hi = name ? `Hi ${name}, ` : "";
  const link = `${siteUrl()}/orders/${o.id}`;
  const cod = o.paymentMethod === "COD" ? ` Please keep ${formatPrice(o.total)} ready.` : "";
  switch (notice) {
    case "placed": return `${hi}thanks for shopping with ${store.name}! Order ${n} (${formatPrice(o.total)}) is placed. We'll call to confirm shortly. ${link}`;
    case "ready_for_pickup": {
      const p = o.shippingAddress as { store?: string; storeAddress?: string; hours?: string | null };
      const due = o.paymentStatus === "PAID" ? "" : ` Pay ${formatPrice(o.total)} at the counter.`;
      return `${store.name}: order ${n} is ready for pickup at ${p.store}, ${p.storeAddress}${p.hours ? ` (${p.hours})` : ""}.${due} Show this SMS. We hold it ${store.pickup.holdDays} days.`;
    }
    case "collected": return `${store.name}: thanks for collecting ${n}! Love it? Leave a review: ${link} Size swap? Bring it back within ${store.returnWindowDays} days.`;
    case "confirmed": return `${store.name}: order ${n} is confirmed and being packed. Track: ${link}`;
    case "shipped": return `${store.name}: order ${n} is on its way${o.carrier ? ` with ${o.carrier}` : ""}${o.trackingNumber ? ` (${o.trackingNumber})` : ""}.${cod} ${link}`;
    case "out_for_delivery": return `${store.name}: order ${n} is out for delivery today.${cod} Rider will call you.`;
    case "delivered": return `${store.name}: order ${n} delivered. Love it? Leave a review: ${link} Need a size swap? Returns within ${store.returnWindowDays} days.`;
    case "cancelled": return `${store.name}: order ${n} has been cancelled. If you paid online, the refund is on its way. Questions? ${store.supportPhone}`;
    case "return_requested": return `${store.name}: return for ${n} received. We'll arrange pickup and update you. ${link}`;
    case "returned": return `${store.name}: your return for ${n} is complete. ${link}`;
    case "refund": return `${store.name}: refund of ${formatPrice(extra.amount ?? 0)} for ${n} has been issued. Thank you for shopping with us.`;
  }
}

export const NOTICE_FOR_STATUS: Partial<Record<OrderStatus, OrderNotice>> = {
  CONFIRMED: "confirmed", SHIPPED: "shipped", OUT_FOR_DELIVERY: "out_for_delivery", DELIVERED: "delivered",
  CANCELLED: "cancelled", RETURN_REQUESTED: "return_requested", RETURNED: "returned",
};

/** Click-and-collect orders: "packed" means waiting at the shop; "delivered" means handed over. */
export const PICKUP_NOTICE_FOR_STATUS: Partial<Record<OrderStatus, OrderNotice>> = { PACKED: "ready_for_pickup", DELIVERED: "collected" };

type Tx = Prisma.TransactionClient | PrismaClient;

/** Write the message to the outbox (inside the caller's transaction when given). Store sales are skipped. */
export async function queueOrderNotice(tx: Tx, orderId: string, notice: OrderNotice, extra: { amount?: number } = {}) {
  const o = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, phone: true, total: true, paymentMethod: true, paymentStatus: true, carrier: true, trackingNumber: true, shippingAddress: true, channel: true } });
  if (!o || (o.channel === "STORE" && notice !== "refund")) return;
  const valid = /^9[678]\d{8}$/.test(o.phone);
  await tx.notification.create({
    data: {
      orderId: o.id, channel: "SMS", template: notice, to: o.phone,
      body: renderSms(notice, o, extra),
      status: valid ? "QUEUED" : "SKIPPED",
      error: valid ? null : "No valid Nepali mobile number",
    },
  });
}

// ---------- Dispatch ----------

type SendResult = { ok: true; ref?: string } | { ok: false; error: string; retry: boolean };
type Provider = { name: string; send: (to: string, body: string) => Promise<SendResult> };

/** SMS gateways by name (NOTIFY_SMS_PROVIDER). Exported so tests can register a controllable one. */
export const providers: Record<string, Provider> = {
  log: {
    name: "log",
    async send(to, body) {
      console.info(`[sms:log] → ${to}: ${body}`);
      return { ok: true, ref: `log-${Date.now()}` };
    },
  },
};

export function smsProvider(): Provider | null {
  const name = process.env.NOTIFY_SMS_PROVIDER ?? (process.env.NODE_ENV === "production" ? "" : "log");
  if (name === "log" && process.env.NODE_ENV === "production") return null; // never fake-send in production
  return providers[name] ?? null;
}

const MAX_ATTEMPTS = 5;
const CLAIM_TIMEOUT_MS = 10 * 60_000;

/** Send queued messages (and retry failures with backoff). Safe to call often and concurrently. */
export async function dispatchNotifications(limit = 50) {
  const provider = smsProvider();
  if (!provider) return { sent: 0, failed: 0, waiting: await db.notification.count({ where: { status: "QUEUED" } }) };
  const now = Date.now();
  const staleClaim = new Date(now - CLAIM_TIMEOUT_MS);
  const due = await db.notification.findMany({
    where: {
      channel: "SMS" satisfies NotificationChannel,
      OR: [
        { status: "QUEUED" },
        { status: "FAILED", attempts: { lt: MAX_ATTEMPTS } },
        // the dispatcher that claimed it died mid-send: retry (at-least-once after a crash)
        { status: "SENDING", claimedAt: { lt: staleClaim }, attempts: { lt: MAX_ATTEMPTS } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0, failed = 0;
  for (const n of due) {
    // exponential backoff for retries: 1, 2, 4, 8 minutes
    if (n.status === "FAILED" && now - n.createdAt.getTime() < 60_000 * 2 ** (n.attempts - 1)) continue;
    // claim it so two dispatchers never send the same SMS: compare-and-swap on (status, attempts),
    // and move it to SENDING so a dispatcher that reads it mid-send can't claim it again
    const claimed = await db.notification.updateMany({
      where: { id: n.id, status: n.status, attempts: n.attempts },
      data: { status: "SENDING", claimedAt: new Date(), attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    const r = await provider.send(n.to, n.body).catch((e): SendResult => ({ ok: false, error: String(e), retry: true }));
    if (r.ok) {
      sent++;
      await db.notification.update({ where: { id: n.id }, data: { status: "SENT", sentAt: new Date(), provider: provider.name, providerRef: r.ref ?? null, error: null } });
    } else {
      failed++;
      // permanent errors (bad number, blocked) stop retrying immediately
      await db.notification.update({ where: { id: n.id }, data: { status: "FAILED", provider: provider.name, error: r.error.slice(0, 300), ...(r.retry ? {} : { attempts: MAX_ATTEMPTS }) } });
    }
  }
  return { sent, failed, waiting: 0 };
}
