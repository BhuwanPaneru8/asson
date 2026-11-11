import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { requireStoreAccess } from "./scope";
import { transitionOrder, TransitionError } from "./orders";
import { formatOrderNumber, formatPrice, parseOrderNumber } from "./utils";
import { ktmDate } from "./pos";

// Courier hand-over manifests. Packed parcels are scanned onto the open manifest of the courier collecting them
// (one open manifest per courier per location), each with its tracking number. When the rider arrives they
// count the parcels; the count must match, their name is recorded, and every order on the manifest moves to
// Shipped in one transaction: all of them or none. The printed manifest is the signed receipt, with the cash
// the rider collects at the door (COD) totalled, which is what the courier's remittance must later add up to.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class ManifestError extends Error {}

export const manifestRef = (n: number) => `M-${n}`;
export const MAX_PARCELS = 300;
type Addr = { fullName?: string; phone?: string; line1?: string; city?: string; district?: string };

/** Cash collected at the door: the order total for unpaid cash-on-delivery orders, otherwise nothing. */
export const codOf = (o: { paymentMethod: string; paymentStatus: string; total: number }) => (o.paymentMethod === "COD" && o.paymentStatus !== "PAID" ? o.total : 0);

async function lockOpen(tx: Tx, user: Actor, id: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Manifest" WHERE "id" = ${id} FOR UPDATE`;
  if (!row) throw new ManifestError("Manifest not found.");
  const m = await tx.manifest.findUniqueOrThrow({ where: { id } });
  await requireStoreAccess(user, m.storeId, tx);
  if (m.status !== "OPEN") throw new ManifestError(`${manifestRef(m.number)} is ${m.status === "HANDED_OVER" ? "already handed over" : "cancelled"}.`);
  return m;
}

/** The courier's open manifest here, or a new one. */
export async function openManifest(tx: Tx, user: Actor, d: { storeId: string; carrier: string }) {
  await requireStoreAccess(user, d.storeId, tx);
  const carrier = d.carrier.trim().slice(0, 60);
  if (carrier.length < 2) throw new ManifestError("Choose the courier.");
  const store = await tx.store.findUnique({ where: { id: d.storeId }, select: { active: true } });
  if (!store?.active) throw new ManifestError("That location isn't open.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`manifest:${d.storeId}:${carrier.toLowerCase()}`}))`;
  const existing = await tx.manifest.findFirst({ where: { storeId: d.storeId, carrier: { equals: carrier, mode: "insensitive" }, status: "OPEN" } });
  if (existing) return { manifest: existing, created: false };
  const m = await tx.manifest.create({ data: { storeId: d.storeId, carrier, createdById: user.id } });
  await audit(tx, user, { action: "manifest.open", entity: ["Manifest", m.id], summary: `${manifestRef(m.number)} opened for ${carrier}` });
  return { manifest: m, created: true };
}

/**
 * Scan a parcel onto a manifest: by order number, with the courier's tracking number (or the one already on the
 * order). The order must be packed here, going by courier, and not on another manifest.
 */
export async function addParcel(tx: Tx, user: Actor, manifestId: string, d: { order: string; trackingNumber?: string | null }) {
  const m = await lockOpen(tx, user, manifestId);
  const n = parseOrderNumber(d.order);
  const o = n ? await tx.order.findUnique({ where: { number: n }, select: { id: true, number: true, status: true, pickupStoreId: true, trackingNumber: true, carrier: true, paymentMethod: true, paymentStatus: true, total: true,
    packCheck: { select: { storeId: true } }, allocations: { select: { storeId: true } }, manifestOrder: { select: { manifest: { select: { number: true, carrier: true } } } } } }) : null;
  if (!o) throw new ManifestError("No order with that number.");
  const ref = formatOrderNumber(o.number);
  if (o.manifestOrder) throw new ManifestError(`${ref} is already on ${manifestRef(o.manifestOrder.manifest.number)} (${o.manifestOrder.manifest.carrier}).`);
  if (o.pickupStoreId) throw new ManifestError(`${ref} is collected from a shop, not sent by courier.`);
  if (o.status !== "PACKED") throw new ManifestError(`${ref} is ${o.status.toLowerCase().replace(/_/g, " ")}: only packed orders go on a manifest.`);
  const packedHere = o.packCheck?.storeId ? o.packCheck.storeId === m.storeId : o.allocations.some((a) => a.storeId === m.storeId);
  if (!packedHere) throw new ManifestError(`${ref} wasn't packed at this location.`);
  const tracking = (d.trackingNumber?.trim() || o.trackingNumber?.trim() || "").toUpperCase().replace(/\s+/g, "");
  if (!tracking) throw new ManifestError(`Scan or type ${m.carrier}'s tracking number for ${ref}.`);
  if (!/^[A-Z0-9-]{4,40}$/.test(tracking)) throw new ManifestError("A tracking number is 4 to 40 letters, numbers or dashes.");
  const clash = await tx.manifestOrder.findFirst({ where: { trackingNumber: tracking, manifest: { carrier: { equals: m.carrier, mode: "insensitive" }, status: { not: "CANCELLED" } } }, select: { order: { select: { number: true } } } });
  if (clash) throw new ManifestError(`Tracking number ${tracking} is already on ${formatOrderNumber(clash.order.number)}.`);
  if ((await tx.manifestOrder.count({ where: { manifestId } })) >= MAX_PARCELS) throw new ManifestError(`A manifest holds up to ${MAX_PARCELS} parcels: hand this one over and start another.`);
  try {
    await tx.manifestOrder.create({ data: { manifestId, orderId: o.id, trackingNumber: tracking, cod: codOf(o), addedById: user.id } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ManifestError(`${ref} has just been put on a manifest.`);
    throw e;
  }
  return { orderNumber: o.number, trackingNumber: tracking, cod: codOf(o) };
}

export async function removeParcel(tx: Tx, user: Actor, manifestId: string, orderId: string) {
  await lockOpen(tx, user, manifestId);
  const r = await tx.manifestOrder.deleteMany({ where: { manifestId, orderId } });
  if (!r.count) throw new ManifestError("That parcel isn't on this manifest.");
}

export async function cancelManifest(tx: Tx, user: Actor, manifestId: string) {
  const m = await lockOpen(tx, user, manifestId);
  const r = await tx.manifestOrder.deleteMany({ where: { manifestId } });
  await tx.manifest.update({ where: { id: manifestId }, data: { status: "CANCELLED" } });
  await audit(tx, user, { action: "manifest.cancel", entity: ["Manifest", manifestId], summary: `${manifestRef(m.number)} (${m.carrier}) cancelled; ${r.count} parcel(s) back to ready to ship` });
}

/**
 * The rider collects: their count must match the manifest, and every order moves to Shipped with its tracking
 * number in this transaction. If any order can't ship (cancelled meanwhile), nothing ships and it's named.
 */
export async function handOver(tx: Tx, user: Actor, manifestId: string, d: { riderName: string; riderPhone?: string | null; parcels: number }, now = new Date()) {
  const m = await lockOpen(tx, user, manifestId);
  const riderName = d.riderName.trim().slice(0, 80);
  if (riderName.length < 2) throw new ManifestError("Enter the rider's name.");
  const riderPhone = d.riderPhone?.replace(/[^\d+]/g, "").slice(0, 20) || null;
  const rows = await tx.manifestOrder.findMany({ where: { manifestId }, include: { order: { select: { number: true } } }, orderBy: { addedAt: "asc" } });
  if (!rows.length) throw new ManifestError("Nothing is on this manifest yet.");
  if (!Number.isInteger(d.parcels) || d.parcels !== rows.length) throw new ManifestError(`The rider counted ${d.parcels} but the manifest has ${rows.length}. Recount before handing over.`);
  const actor = user.name;
  for (const r of rows) {
    try {
      await transitionOrder({ orderId: r.orderId, to: "SHIPPED", actor, actorId: user.id, message: `Handed to ${m.carrier} (${r.trackingNumber}) on ${manifestRef(m.number)}, rider ${riderName}`, shipping: { carrier: m.carrier, trackingNumber: r.trackingNumber } }, tx);
    } catch (e) {
      if (e instanceof TransitionError) throw new ManifestError(`${formatOrderNumber(r.order.number)} can't ship: ${e.message} Take it off the manifest and try again.`);
      throw e;
    }
  }
  const codTotal = rows.reduce((s, r) => s + r.cod, 0);
  await tx.manifest.update({ where: { id: manifestId }, data: { status: "HANDED_OVER", riderName, riderPhone, handedAt: now, handedById: user.id, parcels: rows.length, codTotal } });
  await audit(tx, user, { action: "manifest.handover", entity: ["Manifest", manifestId], summary: `${manifestRef(m.number)}: ${rows.length} parcel(s) to ${m.carrier}, rider ${riderName}${riderPhone ? ` (${riderPhone})` : ""}; COD to collect ${formatPrice(codTotal)}` });
  return { parcels: rows.length, codTotal };
}

// ---------- reading ----------

/** A manifest with its parcels, and (once handed over) how many have been delivered and paid for by the courier. */
export async function manifestView(id: string) {
  const m = await db.manifest.findUnique({ where: { id }, include: { store: { select: { name: true, address: true, phone: true } },
    orders: { orderBy: { addedAt: "asc" }, include: { order: { select: { id: true, number: true, status: true, shippingAddress: true, codRemittanceId: true, _count: { select: { items: true } } } } } } } });
  if (!m) return null;
  const people = await db.user.findMany({ where: { id: { in: [m.createdById, m.handedById].filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const parcels = m.orders.map((r) => { const a = r.order.shippingAddress as Addr; return { orderId: r.orderId, number: r.order.number, status: r.order.status, trackingNumber: r.trackingNumber, cod: r.cod, name: a?.fullName ?? "", phone: a?.phone ?? "", place: [a?.city, a?.district].filter(Boolean).join(", "), remitted: !!r.order.codRemittanceId }; });
  return {
    manifest: m, parcels, cod: parcels.reduce((s, p) => s + p.cod, 0),
    delivered: parcels.filter((p) => p.status === "DELIVERED").length, remitted: parcels.filter((p) => p.remitted).length,
    createdBy: people.find((p) => p.id === m.createdById)?.name ?? "—", handedBy: people.find((p) => p.id === m.handedById)?.name ?? null,
  };
}

/** Packed courier orders at a location that aren't on a manifest yet (by packing location, else allocation). */
const readyWhere = (storeId: string): Prisma.OrderWhereInput => ({
  status: "PACKED", pickupStoreId: null, manifestOrder: null,
  OR: [{ packCheck: { storeId } }, { packCheck: null, allocations: { some: { storeId } } }],
});

export async function manifestOverview(storeId: string, now = new Date()) {
  const dayStart = new Date(`${ktmDate(now)}T00:00:00+05:45`);
  const [open, ready, readyOrders, today] = await Promise.all([
    db.manifest.findMany({ where: { storeId, status: "OPEN" }, orderBy: { number: "asc" }, include: { orders: { select: { cod: true } } } }),
    db.order.count({ where: readyWhere(storeId) }),
    db.order.findMany({ where: readyWhere(storeId), orderBy: { updatedAt: "asc" }, take: 30, select: { id: true, number: true, shippingMethod: true, trackingNumber: true, updatedAt: true } }),
    db.manifest.findMany({ where: { storeId, status: "HANDED_OVER", handedAt: { gte: dayStart } }, orderBy: { handedAt: "desc" }, select: { id: true, number: true, carrier: true, riderName: true, parcels: true, codTotal: true, handedAt: true } }),
  ]);
  return { open: open.map(({ orders, ...m }) => ({ ...m, parcels: orders.length, cod: orders.reduce((s, o) => s + o.cod, 0) })), ready, readyOrders, today };
}
