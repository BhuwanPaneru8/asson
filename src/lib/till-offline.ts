// The offline till, browser side: pure rules for selling from the saved price list, the queue of sales
// waiting to reach the server, and sending them. No browser APIs here (IndexedDB lives in till-db.ts), so
// all of it is unit-tested. Client-safe: no server imports.
import { store as storeConfig } from "./config";

export type TillRow = { variantId: string; sku: string; name: string; color: string; size: string; price: number; stock: number; issuedAt: string; sig: string };
export type PriceList = { storeId: string; savedAt: string; rows: TillRow[] };

/** What the till needs to keep selling after a reload with no internet. Saved when the page loads online. */
export type TillSession = {
  cashierId: string;
  cashierName: string;
  discountLimit: number;
  shift: { id: string; storeId: string; store: string; openedAt: string; openingFloat: number; expectedCash: number; sales: number; total: number };
};

export const OFFLINE_METHODS = ["CASH", "ESEWA_QR", "KHALTI_QR", "FONEPAY_QR", "CARD"] as const;
export type OfflineMethod = (typeof OFFLINE_METHODS)[number];
export type OfflineTender = { method: OfflineMethod; amount: number; tendered?: number; reference?: string };
export type OfflineLine = { variantId: string; sku: string; name: string; color: string; size: string; price: number; issuedAt: string; sig: string; quantity: number };
export type Discount = { type: "PERCENT" | "AMOUNT"; value: number; reason: string };

export type QueuedSale = {
  clientRef: string;
  seq: number;
  soldAt: string;
  cashierId: string;
  cashierName: string;
  shiftId: string;
  storeId: string;
  store: string;
  lines: OfflineLine[];
  discount: Discount | null;
  subtotal: number;
  discountAmount: number;
  total: number;
  change: number;
  tenders: OfflineTender[];
  customer?: { name?: string; phone: string; pan?: string };
  status: "pending" | "failed" | "synced";
  error?: string;
  orderId?: string;
  number?: string;
  syncedAt?: string;
};

const H = 3_600_000;

/** Same rounding as the server: percent discounts round down to whole rupees; amounts never exceed the bag. */
export function discountAmount(subtotal: number, d: { type: "PERCENT" | "AMOUNT"; value: number } | null) {
  if (!d || !(d.value > 0)) return 0;
  return d.type === "PERCENT" ? Math.floor((subtotal * Math.min(d.value, 100)) / 100 / 100) * 100 : Math.min(Math.round(d.value * 100), subtotal);
}

/** The most a cashier may give offline, where no manager PIN can be checked. */
export const offlineDiscountLimit = (ownLimit: number) => Math.min(ownLimit, storeConfig.posOffline.maxDiscountPercent);

/** Why the saved price list can't be used for this shop right now, or null when it can. */
export function priceListProblem(list: PriceList | null | undefined, storeId: string, at = Date.now()) {
  if (!list || !list.rows.length) return "This till has no saved price list yet. It saves one while online.";
  if (list.storeId !== storeId) return "The saved price list is for another shop.";
  const age = at - Date.parse(list.savedAt);
  if (!(age <= storeConfig.posOffline.snapshotMaxAgeHours * H)) return `The saved price list is more than ${storeConfig.posOffline.snapshotMaxAgeHours} hours old. Connect to the internet to refresh it.`;
  return null;
}

/** Scanner first (exact SKU, which is what the barcode holds), then name or colour. */
export function searchPriceList(list: PriceList, query: string, take = 40): TillRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exact = list.rows.find((r) => r.sku.toLowerCase() === q);
  if (exact) return [exact];
  const words = q.split(/\s+/);
  return list.rows.filter((r) => { const hay = `${r.name} ${r.color} ${r.size}`.toLowerCase(); return words.every((w) => hay.includes(w)); }).slice(0, take);
}

/** Units of a variant already sold offline and not yet on the server, so the till doesn't sell the same unit twice. */
export function unitsQueued(queue: QueuedSale[], variantId: string) {
  return queue.filter((s) => s.status !== "synced").reduce((n, s) => n + s.lines.filter((l) => l.variantId === variantId).reduce((m, l) => m + l.quantity, 0), 0);
}

/** Everything the server would refuse about an offline sale, checked before it's saved. Null when it's fine. */
export function offlineSaleProblem(s: { lines: OfflineLine[]; discount: Discount | null; tenders: { method: string; amount: number; tendered?: number; reference?: string }[]; ownLimit: number }) {
  if (!s.lines.length) return "Add an item first.";
  const subtotal = s.lines.reduce((n, l) => n + l.price * l.quantity, 0);
  const off = discountAmount(subtotal, s.discount);
  if (off > 0) {
    if (!s.discount?.reason) return "Add a reason for the discount.";
    const limit = offlineDiscountLimit(s.ownLimit);
    if ((off / subtotal) * 100 > limit) return `Offline, discounts can be at most ${limit}% (no manager PIN can be checked).`;
  }
  for (const t of s.tenders) {
    if (!(OFFLINE_METHODS as readonly string[]).includes(t.method)) return "Store credit and bank transfers can't be taken offline. Use cash, QR or card.";
    if (t.method === "CASH" && (t.tendered ?? t.amount) < t.amount) return "Cash received is less than the cash amount.";
    if (t.method !== "CASH" && !t.reference?.trim()) return "Offline, enter the transaction ID from the QR or card slip, so the payment can be checked later.";
  }
  const paid = s.tenders.reduce((n, t) => n + t.amount, 0);
  if (paid !== subtotal - off) return "Payments must equal the total.";
  return null;
}

/** Builds the queue entry for a sale the till is saving offline. */
export function queueSale(input: {
  clientRef: string; queue: QueuedSale[]; session: TillSession; lines: OfflineLine[]; discount: Discount | null;
  tenders: OfflineTender[]; customer?: { name?: string; phone: string; pan?: string }; soldAt?: Date;
}): QueuedSale {
  const subtotal = input.lines.reduce((n, l) => n + l.price * l.quantity, 0);
  const off = discountAmount(subtotal, input.discount);
  return {
    clientRef: input.clientRef,
    seq: Math.max(0, ...input.queue.map((s) => s.seq)) + 1,
    soldAt: (input.soldAt ?? new Date()).toISOString(),
    cashierId: input.session.cashierId,
    cashierName: input.session.cashierName,
    shiftId: input.session.shift.id,
    storeId: input.session.shift.storeId,
    store: input.session.shift.store,
    lines: input.lines,
    discount: off > 0 ? input.discount : null,
    subtotal,
    discountAmount: off,
    total: subtotal - off,
    change: input.tenders.reduce((n, t) => n + (t.method === "CASH" && t.tendered ? t.tendered - t.amount : 0), 0),
    tenders: input.tenders,
    customer: input.customer,
    status: "pending",
  };
}

/** The sale as createPosSale takes it: the same idempotent path as a sale made online, keyed by clientRef. */
export function saleInput(s: QueuedSale) {
  return {
    clientRef: s.clientRef,
    lines: s.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    discount: s.discount,
    tenders: s.tenders.map((t) => ({ method: t.method, amount: t.amount, tendered: t.tendered, reference: t.reference?.trim() || undefined })),
    customer: s.customer,
    offline: { soldAt: s.soldAt, shiftId: s.shiftId, prices: s.lines.map((l) => ({ variantId: l.variantId, price: l.price, issuedAt: l.issuedAt, sig: l.sig })) },
  };
}

/** Sales not yet on the server, oldest first. */
export const unsent = (queue: QueuedSale[]) => queue.filter((s) => s.status !== "synced").sort((a, b) => a.seq - b.seq);

export function queueStats(queue: QueuedSale[], shiftId?: string) {
  const open = unsent(queue).filter((s) => !shiftId || s.shiftId === shiftId);
  return {
    pending: open.length,
    failed: open.filter((s) => s.status === "failed").length,
    oldestAt: open[0]?.soldAt ?? null,
    cash: open.reduce((n, s) => n + s.tenders.filter((t) => t.method === "CASH").reduce((m, t) => m + t.amount, 0), 0),
    total: open.reduce((n, s) => n + s.total, 0),
  };
}

export type SendResult = { kind: "ok"; orderId: string; number: string } | { kind: "rejected"; error: string } | { kind: "network" };

/**
 * Sends waiting sales one at a time, oldest first. A network failure stops the run (the rest wait for the
 * next one); a sale the server refuses is kept, marked failed with the reason, and the run moves on. Only
 * the cashier who made a sale can send it, so other people's sales wait. Safe to run twice: the server
 * records each clientRef once.
 */
export async function syncQueue(deps: {
  queue: QueuedSale[];
  cashierId: string;
  send: (s: QueuedSale) => Promise<SendResult>;
  save: (s: QueuedSale) => Promise<void>;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  const result = { sent: 0, failed: 0, waitingForOthers: 0, stopped: false };
  for (const sale of unsent(deps.queue)) {
    if (sale.cashierId !== deps.cashierId) { result.waitingForOthers++; continue; }
    const r = await deps.send(sale);
    if (r.kind === "network") { result.stopped = true; break; }
    if (r.kind === "ok") {
      await deps.save({ ...sale, status: "synced", orderId: r.orderId, number: r.number, error: undefined, syncedAt: now().toISOString() });
      result.sent++;
    } else {
      await deps.save({ ...sale, status: "failed", error: r.error });
      result.failed++;
    }
  }
  return result;
}

/** Synced sales are kept a day (to reprint a receipt), then dropped from the device. */
export const expired = (queue: QueuedSale[], at = Date.now()) => queue.filter((s) => s.status === "synced" && at - Date.parse(s.syncedAt ?? s.soldAt) > 24 * H);

/** Short code printed on an offline receipt until the sale has its order number. */
export const offlineCode = (clientRef: string) => `OFF-${clientRef.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}`;
