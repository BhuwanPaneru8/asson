import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { pointsToEarn, tierFor } from "./loyalty-shared";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Delivered/kept spend over the last 12 months, excluding one order (the one being credited). */
export async function spendLast12Months(tx: Tx, userId: string, excludeOrderId?: string) {
  const since = new Date(Date.now() - 365 * 86_400_000);
  const agg = await tx.order.aggregate({
    where: { userId, status: "DELIVERED", createdAt: { gte: since }, ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}) },
    _sum: { total: true, shippingFee: true },
  });
  return (agg._sum.total ?? 0) - (agg._sum.shippingFee ?? 0);
}

/** Credit points once an order is delivered (store sales: at the till). Idempotent per order. */
export async function earnForOrder(tx: Tx, orderId: string) {
  const o = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, userId: true, total: true, shippingFee: true, pointsEarned: true } });
  if (!o?.userId || o.pointsEarned > 0) return 0;
  const tier = tierFor(await spendLast12Months(tx, o.userId, o.id));
  const pts = pointsToEarn(o.total - o.shippingFee, tier);
  if (!pts) return 0;
  const claimed = await tx.order.updateMany({ where: { id: o.id, pointsEarned: 0 }, data: { pointsEarned: pts } });
  if (!claimed.count) return 0;
  await tx.user.update({ where: { id: o.userId }, data: { points: { increment: pts } } });
  await tx.pointsEntry.create({ data: { userId: o.userId, delta: pts, reason: "EARN", orderId: o.id, note: `${tier.name} tier` } });
  return pts;
}

/** Take back points earned on goods that came back (share = refunded / paid for goods). */
export async function reverseForReturn(tx: Tx, orderId: string, refunded: number) {
  const o = await tx.order.findUnique({ where: { id: orderId }, select: { userId: true, total: true, shippingFee: true, pointsEarned: true } });
  if (!o?.userId || !o.pointsEarned) return 0;
  const goods = Math.max(1, o.total - o.shippingFee);
  const taken = await tx.pointsEntry.aggregate({ where: { orderId, reason: "RETURN_REVERSE" }, _sum: { delta: true } });
  const left = o.pointsEarned + (taken._sum.delta ?? 0); // reversals are negative
  const pts = Math.min(left, Math.ceil((o.pointsEarned * refunded) / goods));
  if (pts <= 0) return 0;
  // balance may go negative if points were already spent — that blocks redemption until it recovers
  await tx.user.update({ where: { id: o.userId }, data: { points: { decrement: pts } } });
  await tx.pointsEntry.create({ data: { userId: o.userId, delta: -pts, reason: "RETURN_REVERSE", orderId } });
  return pts;
}

/** Give back points that were spent on an order that got cancelled. Idempotent. */
export async function refundRedeemed(tx: Tx, orderId: string) {
  const o = await tx.order.findUnique({ where: { id: orderId }, select: { userId: true, pointsRedeemed: true } });
  if (!o?.userId || !o.pointsRedeemed) return 0;
  const already = await tx.pointsEntry.count({ where: { orderId, reason: "REDEEM_REFUND" } });
  if (already) return 0;
  await tx.user.update({ where: { id: o.userId }, data: { points: { increment: o.pointsRedeemed } } });
  await tx.pointsEntry.create({ data: { userId: o.userId, delta: o.pointsRedeemed, reason: "REDEEM_REFUND", orderId } });
  return o.pointsRedeemed;
}
