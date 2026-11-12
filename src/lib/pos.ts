import "server-only";
import type { RefundMethod, TenderMethod } from "@prisma/client";
import { db } from "./db";
import { store as storeConfig } from "./config";
import { formatPrice } from "./utils";
import { ensureFlagship } from "./stock";
import { storeFilter, type Scope } from "./scope";

export const TENDER_LABEL: Record<TenderMethod, string> = {
  CASH: "Cash",
  ESEWA_QR: "eSewa QR",
  KHALTI_QR: "Khalti QR",
  FONEPAY_QR: "Fonepay QR",
  CARD: "Card",
  BANK: "Bank transfer",
  VOUCHER: "Store credit",
};

export const REFUND_LABEL: Record<RefundMethod, string> = {
  CASH: "Cash", ESEWA_QR: "eSewa", KHALTI_QR: "Khalti", FONEPAY_QR: "Fonepay", CARD: "Card", BANK: "Bank transfer", STORE_CREDIT: "Store credit", EXCHANGE: "Size exchange (no refund)",
};

/** Calendar date (YYYY-MM-DD) in Nepal for a moment in time. */
export function ktmDate(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: storeConfig.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** UTC bounds of a Nepal calendar day. */
export function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00+05:45`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

/** Active shops (locations with a till), in priority order. */
export async function getShops(scope?: Scope) {
  const shops = await db.store.findMany({ where: { active: true, kind: "SHOP", ...(scope ? storeFilter(scope) : {}) }, select: { id: true, code: true, name: true }, orderBy: [{ priority: "asc" }, { name: "asc" }] });
  if (shops.length || (scope && !scope.all)) return shops; // a staff member with no shops gets none, never a default
  return [await ensureFlagship()];
}

/** A shop by id, or the first shop (within the user's locations when a scope is given). Undefined if they have none. */
export async function getShop(id?: string | null, scope?: Scope) {
  const shops = await getShops(scope);
  return shops.find((s) => s.id === id) ?? shops[0];
}

export async function getOpenShift(cashierId: string) {
  return db.shift.findFirst({ where: { cashierId, status: "OPEN" }, orderBy: { openedAt: "desc" } });
}

/** Cash that should be in the drawer: opening float + cash sales − cash refunds on this shift. */
export async function expectedCashForShift(shiftId: string) {
  const [shift, cash, refunds] = await Promise.all([
    db.shift.findUniqueOrThrow({ where: { id: shiftId } }),
    db.tender.aggregate({ where: { method: "CASH", order: { shiftId } }, _sum: { amount: true } }),
    db.return.aggregate({ where: { shiftId, refundMethod: "CASH" }, _sum: { refundAmount: true } }),
  ]);
  return shift.openingFloat + (cash._sum.amount ?? 0) - (refunds._sum.refundAmount ?? 0);
}

export async function isDayLocked(storeId: string, date: string) {
  return !!(await db.dayClose.findUnique({ where: { storeId_date: { storeId, date } }, select: { id: true } }));
}

export type DaySummary = Awaited<ReturnType<typeof buildDaySummary>>;

/** Everything the owner needs to close a day: sales, tenders, cash, discounts, exceptions. */
export async function buildDaySummary(storeId: string, date: string) {
  const { start, end } = dayBounds(date);
  const storeSales = { channel: "STORE" as const, shift: { storeId }, createdAt: { gte: start, lt: end } };

  const [sales, units, tenders, discounted, shifts, online, cancelled, adjustments, staff, returns, soldItems, pickups] = await Promise.all([
    db.order.aggregate({ where: storeSales, _count: { _all: true }, _sum: { subtotal: true, discount: true, total: true } }),
    db.orderItem.aggregate({ where: { order: storeSales }, _sum: { quantity: true } }),
    db.tender.groupBy({ by: ["method"], where: { order: storeSales }, _sum: { amount: true }, _count: { _all: true } }),
    db.order.findMany({
      where: { ...storeSales, discount: { gt: 0 } },
      select: { id: true, number: true, subtotal: true, discount: true, discountReason: true, cashierId: true, discountApprovedById: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.shift.findMany({ where: { storeId, openedAt: { gte: start, lt: end } }, orderBy: { openedAt: "asc" } }),
    db.order.aggregate({ where: { channel: "ONLINE", createdAt: { gte: start, lt: end }, status: { not: "CANCELLED" } }, _count: { _all: true }, _sum: { total: true } }),
    db.order.count({ where: { updatedAt: { gte: start, lt: end }, status: { in: ["CANCELLED", "RETURNED"] } } }),
    db.inventoryLog.findMany({
      where: { storeId, createdAt: { gte: start, lt: end }, reason: { in: ["MANUAL_ADJUST", "DAMAGED", "RECEIVED", "PRODUCED", "RETURN_RESTOCK", "TRANSFER_LOSS"] } },
      include: { variant: { select: { sku: true, product: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    db.user.findMany({ where: { role: { not: "CUSTOMER" } }, select: { id: true, name: true } }),
    // only returns taken at this shop (cash refunds also sit on its shifts); exchanges refund nothing
    db.return.findMany({ where: { storeId, createdAt: { gte: start, lt: end }, refundMethod: { not: "EXCHANGE" } }, select: { id: true, number: true, refundAmount: true, refundMethod: true, reason: true, processedById: true, approvedById: true, voucherCode: true, items: { select: { quantity: true, condition: true } } }, orderBy: { createdAt: "asc" } }),
    db.orderItem.findMany({ where: { order: storeSales }, select: { unitPrice: true, unitCost: true, quantity: true, order: { select: { subtotal: true, discount: true } } } }),
    // click-and-collect orders paid at this shop's counter (online orders, so not in store sales)
    db.tender.findMany({ where: { createdAt: { gte: start, lt: end }, order: { channel: "ONLINE", shift: { storeId } } }, select: { method: true, amount: true } }),
  ]);

  const name = (id: string | null | undefined) => staff.find((s) => s.id === id)?.name ?? (id ? "Unknown" : "—");

  // Live expected cash for shifts that are still open
  const shiftRows = await Promise.all(
    shifts.map(async (s) => ({
      id: s.id,
      cashier: name(s.cashierId),
      status: s.status,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      openingFloat: s.openingFloat,
      expectedCash: s.status === "CLOSED" ? s.expectedCash ?? 0 : await expectedCashForShift(s.id),
      countedCash: s.countedCash,
      difference: s.difference,
      closeNote: s.closeNote,
    })),
  );

  const discounts = discounted.map((o) => ({
    orderId: o.id,
    number: o.number,
    amount: o.discount,
    percent: o.subtotal ? Math.round((o.discount / o.subtotal) * 1000) / 10 : 0,
    reason: o.discountReason,
    cashier: name(o.cashierId),
    approver: o.discountApprovedById ? name(o.discountApprovedById) : null,
  }));

  const cashDifference = shiftRows.reduce((s, r) => s + (r.difference ?? 0), 0);
  const alerts: string[] = [];
  if (shiftRows.some((r) => r.status === "OPEN")) alerts.push("Some shifts are still open — close them before locking the day.");
  if (shiftRows.some((r) => r.difference)) alerts.push(`Cash is ${cashDifference < 0 ? "short" : "over"} by ${formatPrice(Math.abs(cashDifference))} across today's shifts.`);
  const bigDiscounts = discounts.filter((d) => d.percent > 15);
  if (bigDiscounts.length) alerts.push(`${bigDiscounts.length} discount${bigDiscounts.length > 1 ? "s" : ""} above 15%.`);
  if (adjustments.length) alerts.push(`${adjustments.length} manual stock movement${adjustments.length > 1 ? "s" : ""} today.`);
  if (cancelled) alerts.push(`${cancelled} order${cancelled > 1 ? "s" : ""} cancelled or returned today.`);
  const damagedUnits = returns.flatMap((r) => r.items).filter((i) => i.condition === "DAMAGED").reduce((s, i) => s + i.quantity, 0);
  if (returns.length) alerts.push(`${returns.length} store return${returns.length > 1 ? "s" : ""} (${formatPrice(returns.reduce((s, r) => s + r.refundAmount, 0))})${damagedUnits ? ` · ${damagedUnits} damaged unit${damagedUnits > 1 ? "s" : ""} quarantined` : ""}.`);
  const storeRevenue = soldItems.reduce((s, i) => s + Math.round(i.unitPrice * i.quantity * (i.order.subtotal ? (i.order.subtotal - i.order.discount) / i.order.subtotal : 1)), 0);
  const storeCogs = soldItems.reduce((s, i) => s + (i.unitCost ?? 0) * i.quantity, 0);

  return {
    date,
    store: { transactions: sales._count._all, units: units._sum.quantity ?? 0, gross: sales._sum.subtotal ?? 0, discounts: sales._sum.discount ?? 0, net: sales._sum.total ?? 0 },
    online: { orders: online._count._all, total: online._sum.total ?? 0 },
    tenders: tenders.map((t) => ({ method: t.method, label: TENDER_LABEL[t.method], amount: t._sum.amount ?? 0, count: t._count._all })),
    shifts: shiftRows,
    discounts,
    adjustments: adjustments.map((a) => ({ sku: a.variant.sku, product: a.variant.product.name, delta: a.delta, reason: a.reason, note: a.note, by: name(a.actorId), at: a.createdAt.toISOString() })),
    cancelled,
    cash: {
      floats: shiftRows.reduce((s, r) => s + r.openingFloat, 0),
      sales: tenders.find((t) => t.method === "CASH")?._sum.amount ?? 0,
      pickups: pickups.filter((t) => t.method === "CASH").reduce((s, t) => s + t.amount, 0),
      refunds: returns.filter((r) => r.refundMethod === "CASH").reduce((s, r) => s + r.refundAmount, 0),
      expected: shiftRows.reduce((s, r) => s + r.expectedCash, 0),
      counted: shiftRows.every((r) => r.countedCash != null) ? shiftRows.reduce((s, r) => s + (r.countedCash ?? 0), 0) : null,
      difference: cashDifference,
    },
    returns: returns.map((r) => ({ id: r.id, number: r.number, amount: r.refundAmount, method: r.refundMethod, reason: r.reason, voucher: r.voucherCode, by: name(r.processedById), approver: name(r.approvedById), units: r.items.reduce((s, i) => s + i.quantity, 0) })),
    refunds: { total: returns.reduce((s, r) => s + r.refundAmount, 0), cash: returns.filter((r) => r.refundMethod === "CASH").reduce((s, r) => s + r.refundAmount, 0), credit: returns.filter((r) => r.refundMethod === "STORE_CREDIT").reduce((s, r) => s + r.refundAmount, 0), damagedUnits },
    profit: { revenue: storeRevenue, cogs: storeCogs, gross: storeRevenue - storeCogs, uncosted: soldItems.filter((i) => i.unitCost == null).reduce((s, i) => s + i.quantity, 0) },
    pickups: { count: pickups.length, total: pickups.reduce((s, t) => s + t.amount, 0) },
    alerts,
    allShiftsClosed: shiftRows.every((r) => r.status === "CLOSED"),
  };
}

export type VariantHit = { variantId: string; sku: string; name: string; color: string; size: string; price: number; stock: number; cost: number | null; image: string | null };

/** Exact SKU (scanner) first, then name/brand search. Used by the till and purchasing. */
export async function lookupVariants(query: string, opts: { activeOnly?: boolean } = {}): Promise<VariantHit[]> {
  const q = query.trim().slice(0, 60);
  if (!q) return [];
  const status = opts.activeOnly === false ? undefined : ("ACTIVE" as const);
  const select = {
    id: true, sku: true, color: true, size: true, stock: true, costPrice: true,
    product: { select: { name: true, price: true, images: { take: 1, orderBy: { position: "asc" as const }, select: { url: true } } } },
  };
  const exact = await db.variant.findFirst({ where: { sku: { equals: q, mode: "insensitive" }, ...(status ? { product: { status } } : {}) }, select });
  const rows = exact
    ? [exact]
    : await db.variant.findMany({
        where: { product: { ...(status ? { status } : {}), OR: [{ name: { contains: q, mode: "insensitive" } }, { brand: { contains: q, mode: "insensitive" } }] } },
        select,
        orderBy: [{ product: { name: "asc" } }, { position: "asc" }],
        take: 40,
      });
  return rows.map((v) => ({ variantId: v.id, sku: v.sku, name: v.product.name, color: v.color, size: v.size, price: v.product.price, stock: v.stock, cost: v.costPrice, image: v.product.images[0]?.url ?? null }));
}
