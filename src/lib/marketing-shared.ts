// Ad measurement (Meta pixel, TikTok pixel, Google Analytics 4): the parts shared by the server and
// the browser. Nothing here loads a tracker; that happens only after the shopper chooses "Accept all".

export const CONSENT_COOKIE = "asson_consent";
/** How long a choice is remembered before we ask again (about six months). */
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60;

/** "all" = analytics and advertising allowed; "essential" = only what the shop needs to work. */
export type Consent = "all" | "essential";

export type MarketingIds = { meta: string | null; tiktok: string | null; ga4: string | null };

export const anyTracker = (ids: MarketingIds) => !!(ids.meta || ids.tiktok || ids.ga4);

export function parseConsent(value: string | null | undefined): Consent | null {
  return value === "all" || value === "essential" ? value : null;
}

/** IDs from the environment, each checked against its real format so a typo can't inject script. */
export function parseIds(env: { meta?: string; tiktok?: string; ga4?: string }): MarketingIds {
  const clean = (v: string | undefined, re: RegExp) => {
    const s = v?.trim();
    return s && re.test(s) ? s : null;
  };
  return {
    meta: clean(env.meta, /^\d{6,20}$/),
    tiktok: clean(env.tiktok, /^[A-Z0-9]{8,30}$/),
    ga4: clean(env.ga4, /^G-[A-Z0-9]{4,16}$/),
  };
}

/** `price` in rupees (the database keeps paisa; convert with `rupees`). */
export type TrackItem = { id: string; name: string; price: number; quantity: number };

export const rupees = (paisa: number) => Math.round(paisa) / 100;

/** The events we report, in the shape each platform's standard event expects. */
export type TrackEvent =
  | { name: "view_item"; item: TrackItem }
  | { name: "add_to_cart"; items: TrackItem[] }
  | { name: "begin_checkout"; items: TrackItem[]; value: number }
  | { name: "purchase"; orderId: string; items: TrackItem[]; value: number };

type CartLineLike = { variantId: string; productId: string; name: string; unitPrice: number; quantity: number };

/**
 * What was added to the bag between two snapshots of it (any add button anywhere on the site ends
 * as a new bag, so watching the bag catches them all). Only increases count; removals don't.
 */
export function cartAdds(before: CartLineLike[], after: CartLineLike[]): TrackItem[] {
  const had = new Map(before.map((l) => [l.variantId, l.quantity]));
  const adds: TrackItem[] = [];
  for (const l of after) {
    const more = l.quantity - (had.get(l.variantId) ?? 0);
    if (more > 0) adds.push({ id: l.productId, name: l.name, price: rupees(l.unitPrice), quantity: more });
  }
  return adds;
}

export const totalValue = (items: TrackItem[]) => Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;

/** Meta pixel standard event name and parameters (prices in NPR). */
export function metaEvent(e: TrackEvent): [string, Record<string, unknown>] {
  const items = e.name === "view_item" ? [e.item] : e.items;
  const base = { content_type: "product", content_ids: items.map((i) => i.id), contents: items.map((i) => ({ id: i.id, quantity: i.quantity })), currency: "NPR" };
  switch (e.name) {
    case "view_item": return ["ViewContent", { ...base, content_name: e.item.name, value: e.item.price }];
    case "add_to_cart": return ["AddToCart", { ...base, value: totalValue(e.items) }];
    case "begin_checkout": return ["InitiateCheckout", { ...base, value: e.value, num_items: e.items.reduce((s, i) => s + i.quantity, 0) }];
    case "purchase": return ["Purchase", { ...base, value: e.value }];
  }
}

/** TikTok pixel standard event name and parameters. */
export function tiktokEvent(e: TrackEvent): [string, Record<string, unknown>] {
  const items = e.name === "view_item" ? [e.item] : e.items;
  const params = {
    contents: items.map((i) => ({ content_id: i.id, content_name: i.name, price: i.price, quantity: i.quantity })),
    content_type: "product",
    currency: "NPR",
    value: e.name === "view_item" ? e.item.price : e.name === "add_to_cart" ? totalValue(e.items) : e.value,
  };
  const name = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "CompletePayment" }[e.name];
  return [name, params];
}

/** Google Analytics 4 recommended e-commerce event. */
export function ga4Event(e: TrackEvent): [string, Record<string, unknown>] {
  const items = e.name === "view_item" ? [e.item] : e.items;
  const params: Record<string, unknown> = {
    currency: "NPR",
    value: e.name === "view_item" ? e.item.price : e.name === "add_to_cart" ? totalValue(e.items) : e.value,
    items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
  };
  if (e.name === "purchase") params.transaction_id = e.orderId;
  return [e.name, params];
}
