import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { CONSENT_COOKIE, parseConsent, parseIds, rupees, type Consent, type MarketingIds } from "./marketing-shared";

// Ad measurement on the server: which trackers are switched on (from the server's environment, so
// adding an ID needs a restart, not a rebuild), the shopper's choice, and Meta's Conversions API,
// which reports a purchase from our server so it still counts when a browser blocks the pixel.
// Nothing is sent unless the shopper chose "Accept all".

export function marketingIds(): MarketingIds {
  return parseIds({ meta: process.env.META_PIXEL_ID, tiktok: process.env.TIKTOK_PIXEL_ID, ga4: process.env.GA4_MEASUREMENT_ID });
}

export async function readConsent(): Promise<Consent | null> {
  return parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
}

/** Meta's Conversions API is on when there's a pixel and an access token for it. */
export const metaCapiOn = () => !!(marketingIds().meta && process.env.META_CAPI_TOKEN);

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Meta's matching rules: emails trimmed and lower-cased, phones as digits with the country code. */
export function normaliseEmail(email: string | null | undefined) {
  const e = email?.trim().toLowerCase();
  return e && e.includes("@") ? e : null;
}
export function normalisePhone(phone: string | null | undefined) {
  const d = phone?.replace(/\D/g, "") ?? "";
  if (/^9\d{9}$/.test(d)) return `977${d}`; // Nepali mobile
  if (/^9779\d{9}$/.test(d)) return d;
  return null;
}

export type PurchaseContext = { ip?: string | null; userAgent?: string | null; fbp?: string | null; fbc?: string | null; url?: string | null };

type OrderForCapi = {
  id: string; email: string | null; phone: string | null; userId: string | null; total: number; createdAt: Date;
  items: { productId: string | null; quantity: number; unitPrice: number }[];
};

/** The Conversions API body for one order (pure apart from hashing; tested). */
export function capiPurchase(order: OrderForCapi, ctx: PurchaseContext, testCode?: string | null) {
  const em = normaliseEmail(order.email), ph = normalisePhone(order.phone);
  const user_data: Record<string, unknown> = {};
  if (em) user_data.em = [sha256(em)];
  if (ph) user_data.ph = [sha256(ph)];
  if (order.userId) user_data.external_id = [sha256(order.userId)];
  if (ctx.ip) user_data.client_ip_address = ctx.ip;
  if (ctx.userAgent) user_data.client_user_agent = ctx.userAgent;
  if (ctx.fbp) user_data.fbp = ctx.fbp;
  if (ctx.fbc) user_data.fbc = ctx.fbc;
  const items = order.items.filter((i) => i.productId);
  return {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(order.createdAt.getTime() / 1000),
      event_id: order.id, // the browser pixel sends the same id, so Meta counts the purchase once
      action_source: "website",
      ...(ctx.url ? { event_source_url: ctx.url } : {}),
      user_data,
      custom_data: {
        currency: "NPR",
        value: rupees(order.total),
        content_type: "product",
        content_ids: items.map((i) => i.productId),
        contents: items.map((i) => ({ id: i.productId, quantity: i.quantity, item_price: rupees(i.unitPrice) })),
        order_id: order.id,
      },
    }],
    ...(testCode ? { test_event_code: testCode } : {}),
  };
}

const GRAPH = "https://graph.facebook.com/v21.0";

/** Job `ads.purchase`: send one order to Meta. Safe to repeat: Meta drops a second event with the same id. */
export async function sendMetaPurchase(payload: { orderId?: unknown } & PurchaseContext) {
  const pixel = marketingIds().meta, token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return { skipped: "Meta Conversions API is not set up" };
  const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
  if (!orderId) return { skipped: "no order" };
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, email: true, phone: true, userId: true, total: true, createdAt: true, items: { select: { productId: true, quantity: true, unitPrice: true } } },
  });
  if (!order) return { skipped: "order not found" };
  const body = capiPurchase(order, payload, process.env.META_TEST_EVENT_CODE || null);
  const res = await fetch(`${GRAPH}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Meta Conversions API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { sent: orderId };
}
