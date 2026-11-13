import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { binMap, byBin } from "./bins";
import { can, type Role } from "./permissions";
import { requireStoreAccess } from "./scope";
import { transitionOrder, TransitionError } from "./orders";
import { formatOrderNumber } from "./utils";
import { ktmDate } from "./pos";

// Waves and packing. A wave takes the oldest confirmed orders waiting at a location (express first), gives each a
// slot (tote or shelf number) and makes one pick list in bin order that says which slot every unit goes to.
// The packing station then checks each order item by item: scan the order, scan its items; wrong or extra
// items are refused as they're scanned, and the order can only be packed when everything matches (or a manager
// overrides with a reason). Packing goes through transitionOrder, so the status change, the pick marks, the
// customer notice and the scan record land together.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class FulfilmentError extends Error {}

export const waveRef = (n: number) => `W-${n}`;

/** Confirmed orders with units still to pick here, not already in an open wave: oldest first, express first. */
async function waitingOrders(tx: Tx | typeof db, storeId: string, max: number) {
  return tx.order.findMany({
    where: { status: "CONFIRMED", allocations: { some: { storeId, pickedAt: null } }, waveOrder: null },
    orderBy: [{ createdAt: "asc" }], take: max * 3, select: { id: true, number: true, shippingMethod: true, createdAt: true },
  }).then((rows) => rows.sort((a, b) => Number(b.shippingMethod === "express") - Number(a.shippingMethod === "express") || +a.createdAt - +b.createdAt).slice(0, max));
}

export async function createWave(tx: Tx, user: Actor, d: { storeId: string; maxOrders: number }) {
  await requireStoreAccess(user, d.storeId, tx);
  if (!Number.isInteger(d.maxOrders) || d.maxOrders < 1 || d.maxOrders > 60) throw new FulfilmentError("A wave is 1 to 60 orders.");
  // one wave built at a time per location, so two people can't grab the same orders
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wave:${d.storeId}`}))`;
  const orders = await waitingOrders(tx, d.storeId, d.maxOrders);
  if (!orders.length) throw new FulfilmentError("No confirmed orders waiting to be picked here.");
  const w = await tx.pickWave.create({ data: { storeId: d.storeId, createdById: user.id, orders: { create: orders.map((o, i) => ({ orderId: o.id, slot: i + 1 })) } } });
  await audit(tx, user, { action: "wave.create", entity: ["PickWave", w.id], summary: `${waveRef(w.number)}: ${orders.length} order(s) (${orders.map((o) => formatOrderNumber(o.number)).join(", ")})` });
  return w;
}

/** The wave's pick list: each size once, in bin order, with how many go into which slot. */
export async function wavePickList(waveId: string) {
  const w = await db.pickWave.findUnique({ where: { id: waveId }, include: { store: { select: { name: true } }, orders: { orderBy: { slot: "asc" }, include: { order: { select: { id: true, number: true, shippingMethod: true, status: true } } } } } });
  if (!w) return null;
  const slotOf = new Map(w.orders.map((o) => [o.orderId, o.slot]));
  const allocs = await db.orderAllocation.findMany({
    where: { storeId: w.storeId, orderId: { in: w.orders.map((o) => o.orderId) } },
    select: { orderId: true, quantity: true, variantId: true, pickedAt: true, orderItem: { select: { sku: true, name: true, color: true, size: true } } },
  });
  const bins = await binMap(w.storeId, [...new Set(allocs.map((a) => a.variantId).filter((v): v is string => !!v))]);
  const lines = new Map<string, { sku: string; name: string; color: string; size: string; quantity: number; slots: { slot: number; quantity: number }[]; bin: { code: string; sortKey: string } | null }>();
  for (const a of allocs) {
    const k = a.orderItem.sku;
    const l = lines.get(k) ?? { sku: k, name: a.orderItem.name, color: a.orderItem.color, size: a.orderItem.size, quantity: 0, slots: [], bin: a.variantId ? bins.get(a.variantId) ?? null : null };
    l.quantity += a.quantity;
    const slot = slotOf.get(a.orderId)!;
    const s = l.slots.find((x) => x.slot === slot);
    if (s) s.quantity += a.quantity; else l.slots.push({ slot, quantity: a.quantity });
    lines.set(k, l);
  }
  for (const l of lines.values()) l.slots.sort((a, b) => a.slot - b.slot);
  return { wave: w, lines: byBin([...lines.values()]), units: allocs.reduce((s, a) => s + a.quantity, 0) };
}

/** Everything collected: the wave's units here are marked picked. */
export async function finishWave(tx: Tx, user: Actor, waveId: string, now = new Date()) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "PickWave" WHERE "id" = ${waveId} FOR UPDATE`;
  if (!row) throw new FulfilmentError("Wave not found.");
  const w = await tx.pickWave.findUniqueOrThrow({ where: { id: waveId }, include: { orders: { select: { orderId: true } } } });
  await requireStoreAccess(user, w.storeId, tx);
  if (w.status !== "OPEN") throw new FulfilmentError(`This wave is ${w.status.toLowerCase()}.`);
  const r = await tx.orderAllocation.updateMany({ where: { storeId: w.storeId, orderId: { in: w.orders.map((o) => o.orderId) }, pickedAt: null }, data: { pickedAt: now, pickedById: user.id } });
  await tx.pickWave.update({ where: { id: waveId }, data: { status: "PICKED", pickedAt: now, pickedById: user.id } });
  await audit(tx, user, { action: "wave.picked", entity: ["PickWave", waveId], summary: `${waveRef(w.number)} picked: ${r.count} line(s) across ${w.orders.length} order(s)` });
}

/** Give the orders back to the queue (wrong location, picker called away). */
export async function cancelWave(tx: Tx, user: Actor, waveId: string) {
  const w = await tx.pickWave.findUnique({ where: { id: waveId } });
  if (!w) throw new FulfilmentError("Wave not found.");
  await requireStoreAccess(user, w.storeId, tx);
  if (w.status !== "OPEN") throw new FulfilmentError("Only an open wave can be cancelled.");
  await tx.waveOrder.deleteMany({ where: { waveId } });
  await tx.pickWave.update({ where: { id: waveId }, data: { status: "CANCELLED" } });
  await audit(tx, user, { action: "wave.cancel", entity: ["PickWave", waveId], summary: `${waveRef(w.number)} cancelled: its orders are back in the queue` });
}

// ---------- packing ----------

/** What a packer must find in the parcel: every item of the order (by SKU), and where its units came from. */
export async function packingView(orderNumber: number) {
  const o = await db.order.findUnique({
    where: { number: orderNumber },
    select: { id: true, number: true, status: true, shippingMethod: true, shippingAddress: true, pickupStore: { select: { name: true } }, packCheck: { select: { createdAt: true } },
      items: { select: { sku: true, name: true, color: true, size: true, quantity: true, variantId: true } },
      allocations: { select: { storeId: true, quantity: true, pickedAt: true, store: { select: { name: true } } } },
      waveOrder: { select: { slot: true, wave: { select: { number: true } } } } },
  });
  if (!o) return null;
  const expected = new Map<string, { sku: string; name: string; color: string; size: string; quantity: number }>();
  for (const i of o.items) { const e = expected.get(i.sku); if (e) e.quantity += i.quantity; else expected.set(i.sku, { sku: i.sku, name: i.name, color: i.color, size: i.size, quantity: i.quantity }); }
  const from = [...new Set(o.allocations.map((a) => a.store.name))];
  return { ...o, expected: [...expected.values()], from, unpicked: o.allocations.filter((a) => !a.pickedAt).reduce((s, a) => s + a.quantity, 0) };
}

export type Scan = { sku: string; quantity: number };

/** Compare what was scanned with the order: missing, extra (wrong items) and over-scanned. */
export function compareScans(expected: { sku: string; quantity: number }[], scans: Scan[]) {
  const want = new Map(expected.map((e) => [e.sku.toUpperCase(), e.quantity]));
  const got = new Map<string, number>();
  for (const s of scans) got.set(s.sku.toUpperCase(), (got.get(s.sku.toUpperCase()) ?? 0) + s.quantity);
  const missing = [...want].filter(([k, q]) => (got.get(k) ?? 0) < q).map(([sku, q]) => ({ sku, quantity: q - (got.get(sku) ?? 0) }));
  const extra = [...got].filter(([k, q]) => q > (want.get(k) ?? 0)).map(([sku, q]) => ({ sku, quantity: q - (want.get(sku) ?? 0) }));
  return { matched: !missing.length && !extra.length, missing, extra };
}

/**
 * Pack an order after scanning. Everything must match; otherwise a manager (inventory.adjust) can override with a
 * reason. The order moves to PACKED with the scans, weight and box recorded in the same transaction.
 */
export async function packOrder(user: Actor, d: { orderId: string; storeId?: string | null; scans: Scan[]; weightGrams?: number | null; box?: string | null; override?: string }) {
  const o = await db.order.findUnique({ where: { id: d.orderId }, select: { number: true, status: true, items: { select: { sku: true, quantity: true } } } });
  if (!o) throw new FulfilmentError("Order not found.");
  if (o.status !== "CONFIRMED") throw new FulfilmentError(`${formatOrderNumber(o.number)} is ${o.status.toLowerCase().replace(/_/g, " ")}, not waiting to be packed.`);
  const cmp = compareScans(o.items, d.scans);
  const override = d.override?.trim() ?? "";
  if (!cmp.matched) {
    if (!override) throw new FulfilmentError(`Doesn't match the order: ${[...cmp.missing.map((m) => `${m.quantity} × ${m.sku} missing`), ...cmp.extra.map((m) => `${m.quantity} × ${m.sku} not in the order`)].join("; ")}.`);
    if (!can(user, "inventory.adjust")) throw new FulfilmentError("Only a manager can pack an order that doesn't match the scan.");
  }
  if (d.weightGrams != null && (!Number.isInteger(d.weightGrams) || d.weightGrams < 1 || d.weightGrams > 100_000)) throw new FulfilmentError("Weight is in grams, 1 to 100,000.");
  try {
    await transitionOrder({
      orderId: d.orderId, to: "PACKED", actor: user.name, actorId: user.id,
      message: cmp.matched ? "Packed: every item scanned" : `Packed with an override: ${override}`,
      within: async (tx) => {
        await tx.packCheck.create({ data: { orderId: d.orderId, storeId: d.storeId ?? null, scans: d.scans as Prisma.InputJsonValue, matched: cmp.matched, override: cmp.matched ? "" : override.slice(0, 300), weightGrams: d.weightGrams ?? null, box: d.box?.trim().slice(0, 40) || null, packedById: user.id } });
      },
    });
  } catch (e) {
    if (e instanceof TransitionError) throw new FulfilmentError(e.message);
    if ((e as { code?: string }).code === "P2002") throw new FulfilmentError("Someone has just packed this order.");
    throw e;
  }
  return cmp;
}

/** The fulfilment desk: open waves, orders waiting, and today's packing at a location. */
export async function fulfilmentOverview(storeId: string, now = new Date()) {
  const dayStart = new Date(`${ktmDate(now)}T00:00:00+05:45`);
  const [waves, waiting, packedToday, overrides] = await Promise.all([
    db.pickWave.findMany({ where: { storeId, status: { in: ["OPEN", "PICKED"] } }, orderBy: { number: "desc" }, take: 20, include: { _count: { select: { orders: true } }, orders: { select: { order: { select: { status: true } } } } } }),
    db.order.count({ where: { status: "CONFIRMED", allocations: { some: { storeId, pickedAt: null } }, waveOrder: null } }),
    db.packCheck.count({ where: { storeId, createdAt: { gte: dayStart } } }),
    db.packCheck.count({ where: { storeId, createdAt: { gte: dayStart }, matched: false } }),
  ]);
  return { waves: waves.map((w) => ({ ...w, packed: w.orders.filter((o) => o.order.status !== "CONFIRMED").length })), waiting, packedToday, overrides };
}
