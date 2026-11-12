import "server-only";
import type { ItemCondition, Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { SIZE_ORDER, store as storeCfg } from "./config";
import { allocateOrder, moveStock, StockError } from "./stock";
import { quarantine } from "./damage";
import { queueOrderNotice } from "./notifications";
import { requireStoreAccess } from "./scope";
import { formatOrderNumber, parseOrderNumber } from "./utils";

// Online size exchanges. Within the return window a delivered order's items can be swapped for other sizes of
// the same product, at the price paid. A free replacement order reserves the new sizes and ships like any order
// (no confirmation call); the courier collects the old items at the door. When they arrive at a location they're
// received as a zero-refund return (refund method EXCHANGE): back on sale there, or quarantined if damaged. So
// revenue is counted once (the original sale), the replacement's cost is matched by the returned units' cost,
// and the original order stays Delivered and paid. If the replacement never reaches the customer (cancelled or
// returned to us undelivered), the exchange is cancelled and they keep the original.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class ExchangeError extends Error {}

export const exchangeRef = (n: number) => `EX-${n}`;
const DAY = 86_400_000;

/** What can still be exchanged on an order: per item, units not returned or already in an exchange, and the sizes on offer. */
export async function exchangeOptions(orderId: string, now = new Date()) {
  const o = await db.order.findUnique({ where: { id: orderId }, select: {
    id: true, status: true, channel: true, pickupStoreId: true, exchangeFor: { select: { id: true } },
    events: { where: { status: "DELIVERED" }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    items: { select: { id: true, productId: true, variantId: true, name: true, color: true, size: true, quantity: true, returnItems: { where: { return: { refundMethod: { not: "EXCHANGE" } } }, select: { quantity: true } }, exchangeItems: { where: { exchange: { status: { not: "CANCELLED" } } }, select: { quantity: true } } } },
    exchanges: { where: { status: "OPEN" }, select: { number: true } } } });
  if (!o) return null;
  const deliveredAt = o.events[0]?.createdAt;
  const reason = o.status !== "DELIVERED" ? "Only delivered orders can be exchanged."
    : o.channel !== "ONLINE" ? "Shop sales are exchanged at the shop."
    : !deliveredAt || now.getTime() - deliveredAt.getTime() > storeCfg.returnWindowDays * DAY ? `The ${storeCfg.returnWindowDays}-day exchange window has closed.`
    : null;
  const variants = await db.variant.findMany({ where: { productId: { in: [...new Set(o.items.map((i) => i.productId))] }, product: { status: "ACTIVE" } }, orderBy: { position: "asc" }, select: { id: true, productId: true, color: true, size: true, stock: true } });
  const items = o.items.map((i) => {
    const left = i.quantity - i.returnItems.reduce((s, r) => s + r.quantity, 0) - i.exchangeItems.reduce((s, x) => s + x.quantity, 0);
    const sizes = variants.filter((v) => v.productId === i.productId && v.id !== i.variantId && v.color === i.color && v.stock > 0).map((v) => ({ variantId: v.id, size: v.size, stock: v.stock }));
    return { orderItemId: i.id, name: i.name, color: i.color, size: i.size, left, sizes };
  });
  return { order: o, blocked: reason, items, open: o.exchanges.map((e) => exchangeRef(e.number)) };
}

/**
 * Start an exchange: validate every line, create the replacement order (free, confirmed, stock reserved from the
 * nearest location), and tell the customer. All in one transaction.
 */
export async function createExchange(tx: Tx, d: { orderId: string; lines: { orderItemId: string; quantity: number; newVariantId: string }[]; reason: string; actor: string; staff?: Actor | null }, now = new Date()) {
  const opts = await exchangeOptions(d.orderId, now);
  if (!opts) throw new ExchangeError("Order not found.");
  if (opts.blocked) throw new ExchangeError(opts.blocked);
  const lines = d.lines.filter((l) => l.quantity > 0);
  if (!lines.length) throw new ExchangeError("Choose the new size for at least one item.");
  // one exchange built at a time per order, so two tabs can't swap the same units twice
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`exchange:${d.orderId}`}))`;
  const fresh = await exchangeOptions(d.orderId, now);
  const original = await tx.order.findUniqueOrThrow({ where: { id: d.orderId }, select: { id: true, number: true, userId: true, email: true, phone: true, locale: true, shippingAddress: true, items: true } });
  const ref = formatOrderNumber(original.number);
  const want = new Map<string, number>();
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new ExchangeError("Quantities are whole units.");
    const it = fresh!.items.find((i) => i.orderItemId === l.orderItemId);
    if (!it) throw new ExchangeError("An item doesn't belong to this order.");
    if (!it.sizes.some((s) => s.variantId === l.newVariantId)) throw new ExchangeError(`${it.name}: that size isn't available in ${it.color}.`);
    want.set(l.orderItemId, (want.get(l.orderItemId) ?? 0) + l.quantity);
    if (want.get(l.orderItemId)! > it.left) throw new ExchangeError(`${it.name}: only ${it.left} can be exchanged.`);
  }
  const newVariants = await tx.variant.findMany({ where: { id: { in: lines.map((l) => l.newVariantId) } }, select: { id: true, sku: true, size: true, color: true, costPrice: true, product: { select: { id: true, name: true, slug: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } } } });
  const reason = d.reason.trim().slice(0, 300) || "Size exchange";
  const rows = lines.map((l) => { const it = original.items.find((i) => i.id === l.orderItemId)!; const v = newVariants.find((x) => x.id === l.newVariantId)!; return { l, it, v }; });
  const subtotal = rows.reduce((s, r) => s + r.it.unitPrice * r.l.quantity, 0);
  const swap = rows.map((r) => `${r.it.name} ${r.it.size} → ${r.v.size}${r.l.quantity > 1 ? ` ×${r.l.quantity}` : ""}`).join(", ");
  const replacement = await tx.order.create({
    data: {
      userId: original.userId, email: original.email, phone: original.phone, locale: original.locale, channel: "ONLINE",
      status: "CONFIRMED", paymentMethod: "ONLINE", paymentStatus: "PAID", paymentRef: `exchange of ${ref}`,
      subtotal, discount: subtotal, shippingFee: 0, total: 0, shippingMethod: "standard", shippingAddress: original.shippingAddress as Prisma.InputJsonValue,
      customerNote: `Exchange for ${ref}: collect the old item${rows.length > 1 || rows[0].l.quantity > 1 ? "s" : ""} at the door`,
      items: { create: rows.map((r) => ({ variantId: r.v.id, productId: r.v.product.id, name: r.v.product.name, slug: r.v.product.slug, sku: r.v.sku, color: r.v.color, size: r.v.size, image: r.v.product.images[0]?.url ?? r.it.image, unitPrice: r.it.unitPrice, quantity: r.l.quantity, unitCost: r.v.costPrice })) },
      events: { create: [{ status: "CONFIRMED", actor: d.actor, message: `Exchange for ${ref}: ${swap}` }] },
    },
    select: { id: true, number: true, items: { select: { id: true, variantId: true, quantity: true, name: true, size: true } } },
  });
  try {
    await allocateOrder(tx, { orderId: replacement.id, lines: replacement.items.map((i) => ({ orderItemId: i.id, variantId: i.variantId!, quantity: i.quantity, label: `${i.name} (${i.size})` })), actorId: d.staff?.id ?? original.userId, toDistrict: (original.shippingAddress as { district?: string } | null)?.district ?? null, note: `Exchange for ${ref}` });
  } catch (e) {
    if (e instanceof StockError) throw new ExchangeError(`${e.message} Choose another size.`);
    throw e;
  }
  const ex = await tx.exchange.create({ data: { orderId: original.id, replacementId: replacement.id, reason, requestedBy: d.actor, items: { create: rows.map((r) => ({ orderItemId: r.it.id, quantity: r.l.quantity, newVariantId: r.v.id })) } } });
  await tx.orderEvent.create({ data: { orderId: original.id, actor: d.actor, message: `${exchangeRef(ex.number)}: ${swap}. New size${rows.length > 1 ? "s" : ""} on ${formatOrderNumber(replacement.number)}; the courier collects the old one${rows.length > 1 ? "s" : ""}.` } });
  await queueOrderNotice(tx, replacement.id, "exchange");
  if (d.staff) await audit(tx, d.staff, { action: "exchange.create", entity: ["Order", original.id], summary: `${exchangeRef(ex.number)} for ${ref}: ${swap} (${formatOrderNumber(replacement.number)})` });
  return { exchange: ex, replacement };
}

/** The old items have arrived back (scan the original, the replacement or EX- number) at a location. */
export async function receiveExchange(tx: Tx, user: Actor, d: { ref: string; storeId: string; conditions: Record<string, ItemCondition> }, now = new Date()) {
  await requireStoreAccess(user, d.storeId, tx);
  const raw = d.ref.trim().toUpperCase();
  const exNo = /^EX-?\d+$/.test(raw) ? Number(raw.replace(/\D/g, "")) : null;
  const orderNo = exNo ? null : parseOrderNumber(raw);
  const found = exNo ? await tx.exchange.findUnique({ where: { number: exNo }, select: { id: true } })
    : orderNo ? await tx.exchange.findFirst({ where: { OR: [{ order: { number: orderNo } }, { replacement: { number: orderNo } }], status: "OPEN" }, orderBy: { createdAt: "asc" }, select: { id: true } }) : null;
  if (!found) throw new ExchangeError("No open exchange for that number.");
  await tx.$queryRaw`SELECT "id" FROM "Exchange" WHERE "id" = ${found.id} FOR UPDATE`;
  const ex = await tx.exchange.findUniqueOrThrow({ where: { id: found.id }, include: { order: { select: { id: true, number: true } }, replacement: { select: { number: true, status: true } }, items: { include: { orderItem: { select: { id: true, name: true, size: true, variantId: true, productId: true } } } } } });
  if (ex.status !== "OPEN") throw new ExchangeError(`${exchangeRef(ex.number)} is already ${ex.status === "DONE" ? "received" : "cancelled"}.`);
  if (!["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(ex.replacement.status)) throw new ExchangeError(`The new size (${formatOrderNumber(ex.replacement.number)}) hasn't gone out yet: the old items come back when it's delivered.`);
  const here = await tx.store.findUniqueOrThrow({ where: { id: d.storeId }, select: { name: true } });
  const ret = await tx.return.create({ data: {
    orderId: ex.order.id, storeId: d.storeId, processedById: user.id, reason: `${exchangeRef(ex.number)}: size exchange, received at ${here.name}`, refundMethod: "EXCHANGE", refundAmount: 0,
    items: { create: ex.items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity, condition: d.conditions[i.id] ?? "RESELLABLE", amount: 0 })) },
  }, select: { id: true, number: true } });
  let damaged = 0;
  for (const i of ex.items) {
    if (!i.orderItem.variantId) continue;
    const ok = (d.conditions[i.id] ?? "RESELLABLE") === "RESELLABLE";
    if (!ok) damaged += i.quantity;
    await moveStock(tx, { variantId: i.orderItem.variantId, storeId: d.storeId, delta: ok ? i.quantity : 0, reason: ok ? "RETURN_RESTOCK" : "DAMAGED", orderId: ex.order.id, actorId: user.id, note: ok ? `${exchangeRef(ex.number)}: exchanged item back (R${ret.number})` : `${exchangeRef(ex.number)}: exchanged item back damaged ×${i.quantity}, quarantined (R${ret.number})` });
    if (!ok) await quarantine(tx, { storeId: d.storeId, variantId: i.orderItem.variantId, quantity: i.quantity, source: `${exchangeRef(ex.number)} old item`, actorId: user.id, ledger: false });
  }
  await tx.exchange.update({ where: { id: ex.id }, data: { status: "DONE", returnId: ret.id, closedAt: now } });
  await tx.orderEvent.create({ data: { orderId: ex.order.id, actor: user.name, message: `${exchangeRef(ex.number)}: old item${ex.items.length > 1 ? "s" : ""} received back at ${here.name}${damaged ? ` (${damaged} damaged)` : ""}` } });
  await audit(tx, user, { action: "exchange.received", entity: ["Order", ex.order.id], summary: `${exchangeRef(ex.number)}: old items for ${formatOrderNumber(ex.order.number)} received at ${here.name}${damaged ? `, ${damaged} damaged` : ""}` });
  return { number: ex.number, damaged };
}

/** Called when a replacement order is cancelled: the customer keeps the original. */
export async function cancelExchangeFor(tx: Tx, replacementId: string, now = new Date()) {
  const ex = await tx.exchange.findUnique({ where: { replacementId }, select: { id: true, number: true, status: true, orderId: true } });
  if (!ex || ex.status !== "OPEN") return;
  await tx.exchange.update({ where: { id: ex.id }, data: { status: "CANCELLED", closedAt: now } });
  await tx.orderEvent.create({ data: { orderId: ex.orderId, actor: "system", message: `${exchangeRef(ex.number)} cancelled: the new size didn't reach the customer, so they keep this order's items` } });
}

/** The exchanges desk: open ones (oldest first) and the last 30 days' numbers. */
export async function exchangesDesk(now = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY);
  const [open, recent, why] = await Promise.all([
    db.exchange.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, take: 200, include: { order: { select: { id: true, number: true, shippingAddress: true } }, replacement: { select: { id: true, number: true, status: true, trackingNumber: true, carrier: true } }, items: { include: { orderItem: { select: { name: true, size: true } } } } } }),
    db.exchange.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.$queryRaw<{ name: string; from: string; to: string; n: number }[]>`
      SELECT oi."name", oi."size" AS "from", v."size" AS "to", SUM(ei."quantity")::int AS "n"
      FROM "ExchangeItem" ei JOIN "Exchange" e ON e."id" = ei."exchangeId" JOIN "OrderItem" oi ON oi."id" = ei."orderItemId" JOIN "Variant" v ON v."id" = ei."newVariantId"
      WHERE e."createdAt" >= ${since} AND e."status" <> 'CANCELLED' GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 10`,
  ]);
  const count = (s: string) => recent.find((r) => r.status === s)?._count._all ?? 0;
  return { open: open.map((e) => ({ ...e, days: Math.floor((now.getTime() - e.createdAt.getTime()) / DAY), name: (e.order.shippingAddress as { fullName?: string } | null)?.fullName ?? "" })), last30: { total: count("OPEN") + count("DONE") + count("CANCELLED"), done: count("DONE"), cancelled: count("CANCELLED") }, swaps: why };
}

/**
 * Fit advice for a product page from what customers swapped in the last 180 days: if at least 5 units were
 * exchanged and 70% or more went the same way (a bigger or a smaller size), say so. Sizes compare in the store's
 * size order (S < M < L, 28 < 30, 6-7Y < 8-9Y); unknown sizes are left out. An exchange is always within one colour.
 */
export async function exchangeFit(productId: string, now = new Date()): Promise<{ direction: "up" | "down"; units: number } | null> {
  const since = new Date(now.getTime() - 180 * DAY);
  const rows = await db.$queryRaw<{ from: string; to: string; n: number }[]>`
    SELECT oi."size" AS "from", nv."size" AS "to", SUM(ei."quantity")::int AS "n"
    FROM "ExchangeItem" ei
    JOIN "Exchange" e ON e."id" = ei."exchangeId"
    JOIN "OrderItem" oi ON oi."id" = ei."orderItemId"
    JOIN "Variant" nv ON nv."id" = ei."newVariantId"
    WHERE oi."productId" = ${productId} AND e."status" <> 'CANCELLED' AND e."createdAt" >= ${since}
    GROUP BY 1, 2`;
  let up = 0, down = 0;
  for (const r of rows) {
    const a = SIZE_ORDER.indexOf(r.from), b = SIZE_ORDER.indexOf(r.to);
    if (a < 0 || b < 0 || a === b) continue;
    if (b > a) up += r.n; else down += r.n;
  }
  const total = up + down;
  if (total < 5) return null;
  if (up / total >= 0.7) return { direction: "up", units: total };
  if (down / total >= 0.7) return { direction: "down", units: total };
  return null;
}
