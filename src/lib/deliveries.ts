import "server-only";
import type { DeliveryFailReason, Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store as storeCfg } from "./config";
import { requireAnyStoreAccess, requireStoreAccess, type Scope } from "./scope";
import { transitionOrder, TransitionError } from "./orders";
import { queueOrderNotice } from "./notifications";
import { moveStock } from "./stock";
import { formatOrderNumber, formatPrice, parseOrderNumber } from "./utils";

// After the courier has the parcel. Failed attempts are recorded as the courier reports them (the customer gets
// an SMS to call us). A parcel that won't be delivered comes back: Returning to us, then received at a location,
// where its units go back on sale (or are quarantined if damaged), with the courier's return fee recorded. A
// parcel the courier lost is closed with a claim for the goods' value. Either way the order ends Cancelled, so it
// never counts as a sale, and the return-to-origin rate by courier and district shows where COD is going wrong.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class DeliveryError extends Error {}

export const REASON_LABEL: Record<DeliveryFailReason, string> = {
  CUSTOMER_REFUSED: "Customer refused", NOT_REACHABLE: "Phone not reachable", NOT_HOME: "Nobody home", WRONG_ADDRESS: "Wrong or incomplete address",
  COD_NOT_READY: "Cash not ready", RESCHEDULED: "Customer asked for another day", OTHER: "Other",
};
export const REASONS = Object.keys(REASON_LABEL) as DeliveryFailReason[];
const ON_THE_WAY = ["SHIPPED", "OUT_FOR_DELIVERY"] as const;

/** Orders whose parcels left from one of these locations (by manifest, else by where they were allocated). */
const fromLocations = (ids: string[]): Prisma.OrderWhereInput => ({ OR: [{ manifestOrder: { manifest: { storeId: { in: ids } } } }, { allocations: { some: { storeId: { in: ids } } } }] });
export const deliveryScope = (scope: Scope): Prisma.OrderWhereInput => (scope.all ? {} : fromLocations(scope.storeIds));

async function loadForDesk(tx: Tx, user: Actor, orderId: string, checkAccess = true) {
  const o = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, status: true, carrier: true, pickupStoreId: true, total: true, shippingFee: true,
    items: { select: { variantId: true, quantity: true } }, manifestOrder: { select: { manifest: { select: { storeId: true } } } }, allocations: { select: { storeId: true } }, rto: true } });
  if (!o) throw new DeliveryError("Order not found.");
  if (checkAccess) await requireAnyStoreAccess(user, [...(o.manifestOrder ? [o.manifestOrder.manifest.storeId] : []), ...o.allocations.map((a) => a.storeId)], tx);
  return o;
}
const onTheWay = (status: string) => (ON_THE_WAY as readonly string[]).includes(status);
const wrap = async <T>(f: () => Promise<T>) => { try { return await f(); } catch (e) { if (e instanceof TransitionError) throw new DeliveryError(e.message); throw e; } };

/** The courier couldn't deliver today. The customer is asked to call (unless they asked for another day). */
export async function recordAttempt(tx: Tx, user: Actor, d: { orderId: string; reason: DeliveryFailReason; note?: string }) {
  const o = await loadForDesk(tx, user, d.orderId);
  if (!onTheWay(o.status)) throw new DeliveryError(`${formatOrderNumber(o.number)} isn't with a courier.`);
  if (!REASONS.includes(d.reason)) throw new DeliveryError("Choose what happened.");
  const note = d.note?.trim().slice(0, 300) ?? "";
  await tx.deliveryAttempt.create({ data: { orderId: o.id, reason: d.reason, note, recordedById: user.id } });
  const n = await tx.deliveryAttempt.count({ where: { orderId: o.id } });
  await tx.orderEvent.create({ data: { orderId: o.id, actor: user.name, message: `Delivery attempt ${n} failed: ${REASON_LABEL[d.reason].toLowerCase()}${note ? ` (${note})` : ""}` } });
  if (d.reason !== "RESCHEDULED") await queueOrderNotice(tx, o.id, "delivery_failed");
  await audit(tx, user, { action: "delivery.attempt", entity: ["Order", o.id], summary: `${formatOrderNumber(o.number)}: attempt ${n} failed (${REASON_LABEL[d.reason]})` });
  return { attempts: n };
}

async function begin(tx: Tx, user: Actor, o: Awaited<ReturnType<typeof loadForDesk>>, reason: DeliveryFailReason | null, note: string) {
  const last = reason ?? (await tx.deliveryAttempt.findFirst({ where: { orderId: o.id }, orderBy: { createdAt: "desc" }, select: { reason: true } }))?.reason ?? "OTHER";
  await wrap(() => transitionOrder({ orderId: o.id, to: "RETURNING", actor: user.name, actorId: user.id, rto: { restockTo: null }, message: `Not delivered (${REASON_LABEL[last].toLowerCase()}): ${o.carrier ?? "the courier"} is bringing it back${note ? `. ${note}` : ""}` }, tx));
  await tx.returnToOrigin.create({ data: { orderId: o.id, reason: last, carrier: o.carrier ?? "Courier", startedById: user.id, note } });
}

/** Give up on delivering: the courier brings the parcel back. */
export async function startReturn(tx: Tx, user: Actor, d: { orderId: string; reason?: DeliveryFailReason | null; note?: string }) {
  const o = await loadForDesk(tx, user, d.orderId);
  if (!onTheWay(o.status)) throw new DeliveryError(`${formatOrderNumber(o.number)} isn't with a courier.`);
  await begin(tx, user, o, d.reason ?? null, d.note?.trim().slice(0, 300) ?? "");
}

/**
 * The parcel is back (scanned at a location). Units go back on sale there, or are quarantined if damaged; the
 * order is closed as Cancelled. A parcel the courier returns without warning is accepted too.
 */
export async function receiveReturn(tx: Tx, user: Actor, d: { order: string; storeId: string; damaged: boolean; courierCharge: number; note?: string }, now = new Date()) {
  await requireStoreAccess(user, d.storeId, tx);
  const n = parseOrderNumber(d.order);
  const found = n ? await tx.order.findUnique({ where: { number: n }, select: { id: true } }) : null;
  if (!found) throw new DeliveryError("No order with that number.");
  // one receipt at a time per parcel
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${found.id} FOR UPDATE`;
  // a parcel can come back to any of our locations: being able to act where it arrived is enough
  const o = await loadForDesk(tx, user, found.id, false);
  const ref = formatOrderNumber(o.number);
  if (!Number.isInteger(d.courierCharge) || d.courierCharge < 0 || d.courierCharge > 10_000_00) throw new DeliveryError("Enter the courier's return fee (0 if none).");
  const note = d.note?.trim().slice(0, 300) ?? "";
  const unannounced = onTheWay(o.status);
  if (unannounced) await begin(tx, user, o, null, "Arrived back without notice");
  else if (o.status !== "RETURNING") throw new DeliveryError(o.rto && o.rto.state !== "IN_TRANSIT" ? `${ref} has already been ${o.rto.state === "LOST" ? "reported lost" : "received back"}.` : `${ref} is ${o.status.toLowerCase().replace(/_/g, " ")}, not coming back from a courier.`);
  const here = await tx.store.findUniqueOrThrow({ where: { id: d.storeId }, select: { name: true } });
  await wrap(() => transitionOrder({ orderId: o.id, to: "CANCELLED", actor: user.name, actorId: user.id, rto: { restockTo: d.damaged ? null : d.storeId }, message: `Came back undelivered: received at ${here.name}${d.damaged ? ", damaged (not back on sale)" : ", back on sale"}` }, tx));
  if (d.damaged) for (const it of o.items) if (it.variantId && it.quantity > 0) await moveStock(tx, { variantId: it.variantId, storeId: d.storeId, delta: 0, reason: "DAMAGED", orderId: o.id, actorId: user.id, note: `${ref} came back damaged from the courier (${it.quantity} unit${it.quantity > 1 ? "s" : ""})` });
  await tx.returnToOrigin.update({ where: { orderId: o.id }, data: { state: "RECEIVED", storeId: d.storeId, closedAt: now, closedById: user.id, damaged: d.damaged, courierCharge: d.courierCharge, note: [unannounced ? "Arrived back without notice" : o.rto?.note, note].filter(Boolean).join(" · ").slice(0, 300) } });
  await audit(tx, user, { action: "delivery.received", entity: ["Order", o.id], summary: `${ref} back from ${o.carrier ?? "the courier"} at ${here.name}${d.damaged ? " (damaged)" : ""}${d.courierCharge ? `; return fee ${formatPrice(d.courierCharge)}` : ""}` });
  return { number: o.number, damaged: d.damaged };
}

/** The courier lost the parcel: closed with a claim for the goods' value. Nothing goes back on sale. */
export async function reportLost(tx: Tx, user: Actor, d: { orderId: string; note: string }, now = new Date()) {
  const o = await loadForDesk(tx, user, d.orderId);
  const note = d.note.trim().slice(0, 300);
  if (note.length < 3) throw new DeliveryError("Say what the courier told you (their reference, if any).");
  if (onTheWay(o.status)) await begin(tx, user, o, "OTHER", "");
  else if (o.status !== "RETURNING") throw new DeliveryError(`${formatOrderNumber(o.number)} isn't with a courier.`);
  const claim = Math.max(0, o.total - o.shippingFee);
  await wrap(() => transitionOrder({ orderId: o.id, to: "CANCELLED", actor: user.name, actorId: user.id, rto: { restockTo: null }, message: `Lost by ${o.carrier ?? "the courier"}: claiming ${formatPrice(claim)}. ${note}` }, tx));
  await tx.returnToOrigin.update({ where: { orderId: o.id }, data: { state: "LOST", closedAt: now, closedById: user.id, claimAmount: claim, note } });
  await audit(tx, user, { action: "delivery.lost", entity: ["Order", o.id], summary: `${formatOrderNumber(o.number)} lost by ${o.carrier ?? "the courier"}; claim ${formatPrice(claim)} (${note})` });
}

// ---------- the desk ----------

type Addr = { fullName?: string; phone?: string; city?: string; district?: string };

export async function deliveriesDesk(scope: Scope, now = new Date()) {
  const ids = scope.all ? null : scope.storeIds;
  const scopeSql = (alias: string) => ids
    ? `AND (EXISTS (SELECT 1 FROM "ManifestOrder" mo JOIN "Manifest" m ON m."id" = mo."manifestId" WHERE mo."orderId" = ${alias}."id" AND m."storeId" = ANY($1)) OR EXISTS (SELECT 1 FROM "OrderAllocation" al WHERE al."orderId" = ${alias}."id" AND al."storeId" = ANY($1)))`
    : "";
  const p = ids ? [ids] : [];
  const stuckBefore = new Date(now.getTime() - storeCfg.delivery.stuckDays * 86_400_000);
  const chaseBefore = new Date(now.getTime() - storeCfg.delivery.chaseReturnDays * 86_400_000);
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const [onWay, returning, byCarrier, byDistrict, reasons, money] = await Promise.all([
    db.$queryRawUnsafe<{ id: string; number: number; status: string; carrier: string | null; trackingNumber: string | null; paymentMethod: string; paymentStatus: string; total: number; shippingAddress: Addr; shippedAt: Date | null; attempts: number; lastReason: DeliveryFailReason | null }[]>(`
      SELECT o."id", o."number", o."status"::text, o."carrier", o."trackingNumber", o."paymentMethod"::text, o."paymentStatus"::text, o."total", o."shippingAddress",
        (SELECT MAX(e."createdAt") FROM "OrderEvent" e WHERE e."orderId" = o."id" AND e."status" = 'SHIPPED') AS "shippedAt",
        (SELECT COUNT(*)::int FROM "DeliveryAttempt" a WHERE a."orderId" = o."id") AS "attempts",
        (SELECT a."reason" FROM "DeliveryAttempt" a WHERE a."orderId" = o."id" ORDER BY a."createdAt" DESC LIMIT 1) AS "lastReason"
      FROM "Order" o WHERE o."status" IN ('SHIPPED', 'OUT_FOR_DELIVERY') ${scopeSql("o")}
      ORDER BY "shippedAt" ASC NULLS FIRST LIMIT 300`, ...p),
    db.returnToOrigin.findMany({ where: { state: "IN_TRANSIT", order: deliveryScope(scope) }, orderBy: { startedAt: "asc" }, take: 300, include: { order: { select: { number: true, trackingNumber: true, shippingAddress: true } } } }),
    db.$queryRawUnsafe<{ carrier: string; shipped: number; returned: number }[]>(`
      SELECT COALESCE(o."carrier", 'Unknown') AS "carrier", COUNT(*)::int AS "shipped", COUNT(r."orderId")::int AS "returned"
      FROM "Order" o LEFT JOIN "ReturnToOrigin" r ON r."orderId" = o."id"
      WHERE EXISTS (SELECT 1 FROM "OrderEvent" e WHERE e."orderId" = o."id" AND e."status" = 'SHIPPED' AND e."createdAt" >= $${p.length + 1}) ${scopeSql("o")}
      GROUP BY 1 ORDER BY 2 DESC`, ...p, since),
    db.$queryRawUnsafe<{ district: string; shipped: number; returned: number }[]>(`
      SELECT COALESCE(NULLIF(o."shippingAddress"->>'district', ''), 'Unknown') AS "district", COUNT(*)::int AS "shipped", COUNT(r."orderId")::int AS "returned"
      FROM "Order" o LEFT JOIN "ReturnToOrigin" r ON r."orderId" = o."id"
      WHERE EXISTS (SELECT 1 FROM "OrderEvent" e WHERE e."orderId" = o."id" AND e."status" = 'SHIPPED' AND e."createdAt" >= $${p.length + 1}) ${scopeSql("o")}
      GROUP BY 1 HAVING COUNT(r."orderId") > 0 ORDER BY COUNT(r."orderId")::float / COUNT(*) DESC, 3 DESC LIMIT 15`, ...p, since),
    db.returnToOrigin.groupBy({ by: ["reason"], where: { startedAt: { gte: since }, order: deliveryScope(scope) }, _count: { _all: true } }),
    db.returnToOrigin.aggregate({ where: { startedAt: { gte: since }, order: deliveryScope(scope) }, _sum: { courierCharge: true, claimAmount: true }, _count: { _all: true } }),
  ]);
  const parcels = onWay.map((o) => ({ ...o, cod: o.paymentMethod === "COD" && o.paymentStatus !== "PAID" ? o.total : 0, name: o.shippingAddress?.fullName ?? "", district: o.shippingAddress?.district ?? o.shippingAddress?.city ?? "", stuck: !!o.shippedAt && o.shippedAt < stuckBefore, days: o.shippedAt ? Math.floor((now.getTime() - o.shippedAt.getTime()) / 86_400_000) : null }));
  const shipped = byCarrier.reduce((s, c) => s + c.shipped, 0), returned = byCarrier.reduce((s, c) => s + c.returned, 0);
  return {
    parcels, stuck: parcels.filter((p) => p.stuck).length,
    returning: returning.map((r) => ({ ...r, chase: r.startedAt < chaseBefore, days: Math.floor((now.getTime() - r.startedAt.getTime()) / 86_400_000) })),
    byCarrier, byDistrict, reasons: reasons.map((r) => ({ reason: r.reason, count: r._count._all })).sort((a, b) => b.count - a.count),
    rate: { shipped, returned, pct: shipped ? Math.round((returned / shipped) * 1000) / 10 : 0 },
    fees: money._sum.courierCharge ?? 0, claims: money._sum.claimAmount ?? 0,
  };
}
