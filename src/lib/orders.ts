import "server-only";
import { queueBackInStock } from "./stock-alerts";
import { restockOrder } from "./stock";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "./db";
import { NOTICE_FOR_STATUS, queueOrderNotice } from "./notifications";
import { earnForOrder, refundRedeemed, reverseForReturn } from "./loyalty";
import { audit } from "./audit";
import { formatOrderNumber, formatPrice } from "./utils";

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

    // packing implies picking: clear anything still on a pick list
    if (to === "PACKED") await tx.orderAllocation.updateMany({ where: { orderId, pickedAt: null }, data: { pickedAt: new Date(), pickedById: actorId ?? null } });

    if (to === "CANCELLED" || to === "RETURNED") {
      // units already handled by a store return were restocked (or quarantined) there
      const back = order.items.map((it) => ({ id: it.id, variantId: it.variantId, productId: it.productId, quantity: it.quantity - it.returnItems.reduce((s, r) => s + r.quantity, 0) }));
      await restockOrder(tx, { orderId, items: back, reason: to === "CANCELLED" ? "CANCEL_RESTOCK" : "RETURN_RESTOCK", actorId });
      for (const it of back) if (it.variantId && it.quantity > 0) await tx.product.update({ where: { id: it.productId }, data: { soldCount: { decrement: it.quantity } } });
      await queueBackInStock(tx, order.items.flatMap((i) => (i.variantId ? [i.variantId] : [])));
    }

    const shipNote = to === "SHIPPED" && (data.carrier || data.trackingNumber) ? ` via ${data.carrier ?? "courier"}${data.trackingNumber ? ` (${data.trackingNumber})` : ""}` : "";
    await tx.orderEvent.create({ data: { orderId, status: to, actor, message: opts.message || `${STATUS_LABEL[to]}${shipNote}` } });
    // staff changes go to the audit trail too (customers' own cancellations are on the order timeline)
    if (actorId) {
      const who = await tx.user.findUnique({ where: { id: actorId }, select: { id: true, name: true, role: true } });
      await audit(tx, who, { action: "order.status", entity: ["Order", orderId], summary: `${formatOrderNumber(order.number)} (${formatPrice(order.total)}): ${STATUS_LABEL[order.status]} → ${STATUS_LABEL[to]}${shipNote}${opts.message ? ` — ${opts.message.slice(0, 120)}` : ""}`, changes: { status: [order.status, to] } });
    }
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
