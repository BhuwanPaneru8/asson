"use server";

import { reportError, reportErrorSoon } from "@/lib/errors";
import { refresh, revalidateTag } from "next/cache";
import { queueBackInStock } from "@/lib/stock-alerts";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { findApproverByPin } from "@/lib/approvals";
import { getOpenShift, getShop } from "@/lib/pos";
import { moveStock } from "@/lib/stock";
import { scopeFor } from "@/lib/scope";
import { reverseReferral } from "@/lib/referrals";
import { store } from "@/lib/config";
import { refundPerUnit } from "@/lib/costing";
import { audit } from "@/lib/audit";
import { dispatchNotifications, queueOrderNotice } from "@/lib/notifications";
import { after } from "next/server";
import { reverseForReturn } from "@/lib/loyalty";
import { formatOrderNumber, formatPrice, parseOrderNumber } from "@/lib/utils";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type ReturnableLine = {
  orderItemId: string;
  name: string;
  sku: string;
  color: string;
  size: string;
  image: string;
  sold: number;
  returned: number;
  returnable: number;
  refundPerUnit: number; // after the order's discount share
};

export type ReturnableOrder = {
  orderId: string;
  number: string;
  channel: "ONLINE" | "STORE";
  soldAt: string;
  customer: string;
  paidWith: string[];
  withinWindow: boolean;
  daysSince: number;
  lines: ReturnableLine[];
};

export async function findReturnableOrder(numberInput: string): Promise<R<{ order: ReturnableOrder }>> {
  await requirePermission("pos.sell");
  const n = parseOrderNumber(numberInput);
  if (!n) return { ok: false, error: "Enter the receipt or order number, e.g. AS000123." };
  const order = await db.order.findUnique({
    where: { number: n },
    include: {
      items: { include: { returnItems: { select: { quantity: true } } } },
      tenders: { select: { method: true } },
      events: { where: { status: "DELIVERED" }, select: { createdAt: true }, take: 1 },
    },
  });
  if (!order) return { ok: false, error: "No order with that number." };
  if (order.status !== "DELIVERED") return { ok: false, error: `This order is ${order.status.toLowerCase().replace(/_/g, " ")} — only delivered orders can be returned here.` };
  const soldAt = order.channel === "STORE" ? order.createdAt : order.events[0]?.createdAt ?? order.updatedAt;
  const daysSince = Math.floor((Date.now() - soldAt.getTime()) / 86_400_000);
  const lines = order.items.map((i) => {
    const returned = i.returnItems.reduce((s, r) => s + r.quantity, 0);
    return {
      orderItemId: i.id, name: i.name, sku: i.sku, color: i.color, size: i.size, image: i.image,
      sold: i.quantity, returned, returnable: Math.max(0, i.quantity - returned),
      refundPerUnit: refundPerUnit(i.unitPrice, order.subtotal, order.discount + order.pointsDiscount),
    };
  });
  if (lines.every((l) => l.returnable === 0)) return { ok: false, error: "Everything on this order has already been returned." };
  const addr = order.shippingAddress as { fullName?: string };
  return {
    ok: true,
    order: {
      orderId: order.id,
      number: formatOrderNumber(order.number),
      channel: order.channel,
      soldAt: soldAt.toISOString(),
      customer: addr?.fullName ?? (order.email || "Walk-in customer"),
      paidWith: order.channel === "STORE" ? [...new Set(order.tenders.map((t) => t.method))] : [order.paymentMethod === "COD" ? "Cash on delivery" : "Online"],
      withinWindow: daysSince <= store.returnWindowDays,
      daysSince,
      lines,
    },
  };
}

const returnSchema = z.object({
  clientRef: z.string().min(8).max(64),
  orderId: z.string(),
  lines: z.array(z.object({ orderItemId: z.string(), quantity: z.number().int().min(1).max(50), condition: z.enum(["RESELLABLE", "DAMAGED"]) })).min(1).max(100),
  reason: z.string().trim().min(2).max(120),
  refundMethod: z.enum(["CASH", "ESEWA_QR", "KHALTI_QR", "FONEPAY_QR", "CARD", "BANK", "STORE_CREDIT"]),
  reference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(300).optional(),
  approverPin: z.string().optional(),
});

export type ProcessReturnInput = z.input<typeof returnSchema>;

export async function processReturn(input: ProcessReturnInput): Promise<R<{ returnId: string; refund: number; voucherCode: string | null }>> {
  const me = await requirePermission("pos.sell");
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some return details are missing." };
  const d = parsed.data;

  const dup = await db.return.findUnique({ where: { clientRef: d.clientRef }, select: { id: true, refundAmount: true, voucherCode: true } });
  if (dup) return { ok: true, returnId: dup.id, refund: dup.refundAmount, voucherCode: dup.voucherCode };

  // Returns are always approved by a manager or owner — cashiers ask for a PIN
  let approverId: string | null = can(me.role, "approve.return") ? me.id : null;
  if (!approverId) {
    const found = await findApproverByPin(me.id, d.approverPin);
    if (!found.ok) return { ok: false, error: `A manager must approve returns. ${found.error}` };
    approverId = found.approver.id;
  }

  const shift = await getOpenShift(me.id);
  if (d.refundMethod === "CASH" && !shift) return { ok: false, error: "Open your shift before giving a cash refund — it comes out of your drawer." };

  const order = await db.order.findUnique({ where: { id: d.orderId }, include: { items: { include: { returnItems: { select: { quantity: true } } } } } });
  if (!order || order.status !== "DELIVERED") return { ok: false, error: "This order can't be returned." };

  // Validate quantities against what's still returnable, and price each line from the original sale
  const want = new Map<string, { quantity: number; condition: "RESELLABLE" | "DAMAGED" }[]>();
  for (const l of d.lines) want.set(l.orderItemId, [...(want.get(l.orderItemId) ?? []), l]);
  const rows: { item: (typeof order.items)[number]; quantity: number; condition: "RESELLABLE" | "DAMAGED"; amount: number }[] = [];
  for (const [itemId, parts] of want) {
    const item = order.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, error: "An item doesn't belong to this order." };
    const already = item.returnItems.reduce((s, r) => s + r.quantity, 0);
    const total = parts.reduce((s, p) => s + p.quantity, 0);
    if (already + total > item.quantity) return { ok: false, error: `${item.name}: only ${item.quantity - already} can be returned.` };
    for (const p of parts) rows.push({ item, quantity: p.quantity, condition: p.condition, amount: refundPerUnit(item.unitPrice, order.subtotal, order.discount + order.pointsDiscount) * p.quantity });
  }
  const refund = rows.reduce((s, r) => s + r.amount, 0);
  // a return goes back on the shelf of the shop taking it: the cashier's shift, else their first shop
  const shop = await getShop(shift?.storeId, await scopeFor(me));
  if (!shop) return { ok: false, error: "You're not assigned to a shop yet, so there's nowhere to put the return." };
  const voucherCode = d.refundMethod === "STORE_CREDIT" ? `CR-${randomBytes(4).toString("hex").toUpperCase()}` : null;

  try {
    const ret = await db.$transaction(async (tx) => {
      const created = await tx.return.create({
        data: {
          clientRef: d.clientRef, orderId: order.id, shiftId: d.refundMethod === "CASH" ? shift!.id : shift?.id ?? null,
          processedById: me.id, approvedById: approverId, reason: d.reason, refundMethod: d.refundMethod, refundAmount: refund,
          voucherCode, reference: d.reference || null, note: d.note || null,
          items: { create: rows.map((r) => ({ orderItemId: r.item.id, quantity: r.quantity, condition: r.condition, amount: r.amount })) },
        },
        select: { id: true, number: true },
      });
      for (const r of rows) {
        // back on the shelf of the shop taking the return; damaged units are only recorded (quarantined)
        if (r.item.variantId) {
          const resellable = r.condition === "RESELLABLE";
          await moveStock(tx, {
            variantId: r.item.variantId, storeId: shop.id, delta: resellable ? r.quantity : 0, reason: resellable ? "RETURN_RESTOCK" : "DAMAGED",
            note: resellable ? `Store return R${created.number}` : `Returned damaged ×${r.quantity} — quarantined (R${created.number})`, orderId: order.id, actorId: me.id,
          });
        }
        await tx.product.update({ where: { id: r.item.productId }, data: { soldCount: { decrement: r.quantity } } });
      }
      if (voucherCode) {
        const ends = new Date(); ends.setFullYear(ends.getFullYear() + 1);
        await tx.coupon.create({ data: { code: voucherCode, description: `Store credit from return R${created.number}`, type: "FIXED", value: refund, isCredit: true, endsAt: ends } });
      }
      // If every unit has now come back, the order is fully returned and refunded
      const fully = order.items.every((i) => i.returnItems.reduce((s, x) => s + x.quantity, 0) + rows.filter((r) => r.item.id === i.id).reduce((s, r) => s + r.quantity, 0) >= i.quantity);
      await tx.order.update({ where: { id: order.id }, data: fully ? { status: "RETURNED", paymentStatus: "REFUNDED" } : {} });
      await reverseForReturn(tx, order.id, refund);
      if (fully) await reverseReferral(tx, order.id); // the friend's first order came back
      await queueBackInStock(tx, rows.filter((r) => r.condition === "RESELLABLE" && r.item.variantId).map((r) => r.item.variantId!));
      if (order.channel === "ONLINE") await queueOrderNotice(tx, order.id, "refund", { amount: refund });
      await tx.orderEvent.create({
        data: {
          orderId: order.id, status: fully ? "RETURNED" : null, actor: me.email,
          message: `Return R${created.number}: ${rows.reduce((s, r) => s + r.quantity, 0)} item(s), ${d.reason}. Refunded ${formatPrice(refund)} by ${d.refundMethod === "STORE_CREDIT" ? `store credit ${voucherCode}` : d.refundMethod.replace("_QR", "").toLowerCase()}.`,
        },
      });
      const approver = approverId && approverId !== me.id ? await tx.user.findUnique({ where: { id: approverId }, select: { name: true } }) : null;
      await audit(tx, me, {
        action: "return.process", entity: ["Order", order.id],
        summary: `Return R${created.number} on ${formatOrderNumber(order.number)}: ${rows.reduce((s, r) => s + r.quantity, 0)} item(s), refunded ${formatPrice(refund)} by ${d.refundMethod === "STORE_CREDIT" ? `store credit ${voucherCode}` : d.refundMethod.replace("_QR", "").toLowerCase()} — ${d.reason}${approver ? ` · approved by ${approver.name}` : ""}`,
        changes: { returnId: created.id, refund, method: d.refundMethod, damaged: rows.filter((r) => r.condition !== "RESELLABLE").reduce((s, r) => s + r.quantity, 0) },
      });
      return created;
    });
    revalidateTag("products", { expire: 60 });
    after(() => dispatchNotifications().catch(reportErrorSoon("dispatchNotifications")));
    refresh();
    return { ok: true, returnId: ret.id, refund, voucherCode };
  } catch (e) {
    const again = await db.return.findUnique({ where: { clientRef: d.clientRef }, select: { id: true, refundAmount: true, voucherCode: true } });
    if (again) return { ok: true, returnId: again.id, refund: again.refundAmount, voucherCode: again.voucherCode };
    void reportError("processReturn", e);
    return { ok: false, error: "The return didn't go through. Nothing was changed — please try again." };
  }
}

export async function checkVoucher(code: string): Promise<R<{ balance: number }>> {
  await requirePermission("pos.sell");
  const v = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!v || !v.isCredit || !v.active || (v.endsAt && v.endsAt < new Date())) return { ok: false, error: "Voucher not found or already used." };
  return { ok: true, balance: v.value };
}
