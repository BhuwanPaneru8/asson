import "server-only";
import { queueBackInStock } from "./stock-alerts";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "./db";
import { NOTICE_FOR_STATUS, queueOrderNotice } from "./notifications";
import { earnForOrder, refundRedeemed, reverseForReturn } from "./loyalty";

export { STATUS_LABEL, TRANSITIONS, CUSTOMER_CANCELLABLE } from "./order-status";
import { STATUS_LABEL, TRANSITIONS } from "./order-status";

export class TransitionError extends Error {}

export async function transitionOrder(opts: {
  orderId: string;
  to: OrderStatus;
  actor: string;
  actorId?: string;
  message?: string;
  shipping?: { carrier?: string; trackingNumber?: string };
}) {
  const { orderId, to, actor, actorId } = opts;
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { include: { returnItems: { select: { quantity: true } } } } } });
    if (!order) throw new TransitionError("Order not found.");
    if (!TRANSITIONS[order.status].includes(to)) throw new TransitionError(`Can't move an order from ${STATUS_LABEL[order.status]} to ${STATUS_LABEL[to]}.`);

    const data: Prisma.OrderUpdateManyMutationInput = { status: to };
    if (to === "SHIPPED" && opts.shipping) {
      data.carrier = opts.shipping.carrier || order.carrier;
      data.trackingNumber = opts.shipping.trackingNumber || order.trackingNumber;
    }
    if (to === "DELIVERED" && order.paymentMethod === "COD") data.paymentStatus = "PAID";
    if ((to === "CANCELLED" || to === "RETURNED") && order.paymentStatus === "PAID") data.paymentStatus = "REFUNDED";

    // optimistic concurrency: only succeeds if nobody else moved the order meanwhile
    const res = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data });
    if (res.count === 0) throw new TransitionError("This order was just updated by someone else. Refresh and try again.");

    if (to === "CANCELLED" || to === "RETURNED") {
      for (const it of order.items) {
        // units already handled by a store return were restocked (or quarantined) there
        const qty = it.quantity - it.returnItems.reduce((s, r) => s + r.quantity, 0);
        if (!it.variantId || qty <= 0) continue;
        await tx.variant.update({ where: { id: it.variantId }, data: { stock: { increment: qty } } });
        await tx.inventoryLog.create({
          data: { variantId: it.variantId, delta: qty, reason: to === "CANCELLED" ? "CANCEL_RESTOCK" : "RETURN_RESTOCK", orderId, actorId },
        });
        await tx.product.update({ where: { id: it.productId }, data: { soldCount: { decrement: qty } } });
      }
      await queueBackInStock(tx, order.items.flatMap((i) => (i.variantId ? [i.variantId] : [])));
    }

    const shipNote = to === "SHIPPED" && (data.carrier || data.trackingNumber) ? ` via ${data.carrier ?? "courier"}${data.trackingNumber ? ` (${data.trackingNumber})` : ""}` : "";
    await tx.orderEvent.create({ data: { orderId, status: to, actor, message: opts.message || `${STATUS_LABEL[to]}${shipNote}` } });
    // loyalty: earn on delivery, give back spent points on cancel, take back earned points on return
    if (to === "DELIVERED") await earnForOrder(tx, orderId);
    if (to === "CANCELLED") await refundRedeemed(tx, orderId);
    if (to === "RETURNED") {
      const alreadyRefunded = await tx.returnItem.aggregate({ where: { orderItem: { orderId } }, _sum: { amount: true } });
      await reverseForReturn(tx, orderId, Math.max(0, order.total - order.shippingFee - (alreadyRefunded._sum.amount ?? 0)));
    }
    const notice = NOTICE_FOR_STATUS[to];
    if (notice) await queueOrderNotice(tx, orderId, notice);
    return { from: order.status, to };
  });
}
