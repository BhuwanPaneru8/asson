import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { formatOrderNumber } from "./utils";
import { binMap, byBin } from "./bins";

// Pick lists: units allocated to a location for confirmed online orders that nobody has picked yet.
// Packing an order (status PACKED) also marks its units picked, so the list never goes stale.

export async function getPickList(storeId: string) {
  const rows = await db.orderAllocation.findMany({
    where: { storeId, pickedAt: null, order: { status: "CONFIRMED" } },
    select: {
      id: true, quantity: true, variantId: true,
      order: { select: { id: true, number: true, createdAt: true, shippingMethod: true, shippingAddress: true, pickupStore: { select: { id: true, name: true } } } },
      orderItem: { select: { name: true, sku: true, color: true, size: true, image: true } },
    },
    orderBy: [{ order: { createdAt: "asc" } }],
    take: 500,
  });
  // batch view: walk the shelves once per SKU, in bin order (lib/bins.ts)
  const bins = await binMap(storeId, [...new Set(rows.map((r) => r.variantId).filter((v): v is string => !!v))]);
  const binOf = (variantId: string | null) => (variantId ? bins.get(variantId) ?? null : null);
  const bySku = new Map<string, { sku: string; name: string; color: string; size: string; image: string; quantity: number; orders: number[]; bin: { code: string; sortKey: string } | null }>();
  for (const r of rows) {
    const k = r.orderItem.sku;
    const cur = bySku.get(k) ?? { sku: k, name: r.orderItem.name, color: r.orderItem.color, size: r.orderItem.size, image: r.orderItem.image, quantity: 0, orders: [], bin: binOf(r.variantId) };
    cur.quantity += r.quantity;
    if (!cur.orders.includes(r.order.number)) cur.orders.push(r.order.number);
    bySku.set(k, cur);
  }
  const byOrder = new Map<string, { id: string; number: number; createdAt: Date; shippingMethod: string; district: string | null; pickup: { id: string; name: string } | null; lines: { sku: string; name: string; color: string; size: string; quantity: number; bin: string | null }[] }>();
  for (const r of rows) {
    const addr = r.order.shippingAddress as { district?: string } | null;
    const cur = byOrder.get(r.order.id) ?? { id: r.order.id, number: r.order.number, createdAt: r.order.createdAt, shippingMethod: r.order.shippingMethod, district: addr?.district ?? null, pickup: r.order.pickupStore, lines: [] };
    cur.lines.push({ sku: r.orderItem.sku, name: r.orderItem.name, color: r.orderItem.color, size: r.orderItem.size, quantity: r.quantity, bin: binOf(r.variantId)?.code ?? null });
    byOrder.set(r.order.id, cur);
  }
  return {
    skus: byBin([...bySku.values()]),
    orders: [...byOrder.values()],
    units: rows.reduce((s, r) => s + r.quantity, 0),
  };
}

/** Units waiting to be picked, per location (for badges and the location picker). */
export async function pickCounts() {
  const g = await db.orderAllocation.groupBy({ by: ["storeId"], where: { pickedAt: null, order: { status: "CONFIRMED" } }, _sum: { quantity: true } });
  return new Map(g.map((r) => [r.storeId, r._sum.quantity ?? 0]));
}

export async function markPicked(tx: Prisma.TransactionClient, actor: NonNullable<AuditActor>, orderId: string, storeId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { number: true, status: true } });
  if (!order || order.status !== "CONFIRMED") return { ok: false as const, error: "Only confirmed orders can be picked." };
  const res = await tx.orderAllocation.updateMany({ where: { orderId, storeId, pickedAt: null }, data: { pickedAt: new Date(), pickedById: actor.id } });
  if (!res.count) return { ok: false as const, error: "Already picked." };
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { name: true } });
  const left = await tx.orderAllocation.count({ where: { orderId, pickedAt: null } });
  await audit(tx, actor, { action: "order.pick", entity: ["Order", orderId], summary: `${formatOrderNumber(order.number)} picked at ${store.name}${left ? `; ${left} line(s) still to pick elsewhere` : ""}` });
  return { ok: true as const, remaining: left };
}
