"use server";

import { reportError } from "@/lib/errors";
import { refresh, revalidateTag } from "next/cache";
import { earnForOrder } from "@/lib/loyalty";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, verifyPassword, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { can, discountLimitPercent, type Role } from "@/lib/permissions";
import { buildDaySummary, expectedCashForShift, getOpenShift, getShop, isDayLocked, ktmDate, lookupVariants } from "@/lib/pos";
import { allocateOrder, StockError, stockByLocation } from "@/lib/stock";
import { findApproverByPin } from "@/lib/approvals";
import { scopeFor } from "@/lib/scope";
import { transitionOrder, TransitionError } from "@/lib/orders";
import { formatOrderNumber, formatPrice } from "@/lib/utils";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const rupeesToPaisa = (n: number) => Math.round(n * 100);

// ---------- Product lookup (scan or search) ----------

export type PosItem = { variantId: string; sku: string; name: string; color: string; size: string; price: number; stock: number; image: string | null };

export async function posLookup(query: string): Promise<PosItem[]> {
  const me = await requirePermission("pos.sell");
  // the till sells from its own shop, so show that shop's count (never the purchase cost)
  const [hits, shift] = await Promise.all([lookupVariants(query), getOpenShift(me.id)]);
  const here = shift ? await stockByLocation(hits.map((h) => h.variantId)) : null;
  return hits.map((v) => ({ variantId: v.variantId, sku: v.sku, name: v.name, color: v.color, size: v.size, price: v.price, stock: here ? here.get(v.variantId)?.get(shift!.storeId) ?? 0 : v.stock, image: v.image }));
}

// ---------- Shifts ----------

export async function openShift(openingFloatRupees: number, storeId?: string): Promise<R> {
  const me = await requirePermission("pos.sell");
  const float = rupeesToPaisa(openingFloatRupees);
  if (!Number.isFinite(float) || float < 0 || float > 50_000_00) return { ok: false, error: "Enter the cash in the drawer (Rs. 0 – 50,000)." };
  if (await getOpenShift(me.id)) return { ok: false, error: "You already have an open shift." };
  // only at a shop this cashier works at
  const store = await getShop(storeId, await scopeFor(me));
  if (!store) return { ok: false, error: "You're not assigned to a shop yet. Ask the owner to add you under Customers & team." };
  if (storeId && store.id !== storeId) return { ok: false, error: "You can only open a shift at a shop you work at." };
  if (await isDayLocked(store.id, ktmDate())) return { ok: false, error: `Today has already been closed and locked at ${store.name}. Ask the owner to reopen tomorrow.` };
  await db.$transaction(async (tx) => {
    const s = await tx.shift.create({ data: { storeId: store.id, cashierId: me.id, openingFloat: float } });
    await audit(tx, me, { action: "shift.open", entity: ["Shift", s.id], summary: `${me.name} opened a shift at ${store.name} with ${formatPrice(float)} in the drawer` });
  });
  refresh();
  return { ok: true };
}

export async function closeShift(countedCashRupees: number, note?: string): Promise<R<{ expected: number; counted: number; difference: number }>> {
  const me = await requirePermission("pos.sell");
  const shift = await getOpenShift(me.id);
  if (!shift) return { ok: false, error: "No open shift." };
  const counted = rupeesToPaisa(countedCashRupees);
  if (!Number.isFinite(counted) || counted < 0) return { ok: false, error: "Enter the cash you counted." };
  const expected = await expectedCashForShift(shift.id);
  const difference = counted - expected;
  if (difference !== 0 && !note?.trim()) return { ok: false, error: `Cash is ${difference > 0 ? "over" : "short"} by ${formatPrice(Math.abs(difference))}. Add a note explaining why.` };
  const res = await db.shift.updateMany({
    where: { id: shift.id, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date(), expectedCash: expected, countedCash: counted, difference, closeNote: note?.trim().slice(0, 300) || null, closedById: me.id },
  });
  if (!res.count) return { ok: false, error: "This shift was already closed." };
  await audit(db, me, { action: "shift.close", entity: ["Shift", shift.id], summary: `${me.name} closed the shift: counted ${formatPrice(counted)}, expected ${formatPrice(expected)}${difference ? ` — ${difference > 0 ? "over" : "SHORT"} ${formatPrice(Math.abs(difference))}: ${note?.trim().slice(0, 120)}` : " — balanced"}`, changes: { expected, counted, difference } });
  refresh();
  return { ok: true, expected, counted, difference };
}

// ---------- Sale ----------

const saleSchema = z.object({
  clientRef: z.string().min(8).max(64),
  lines: z.array(z.object({ variantId: z.string(), quantity: z.number().int().min(1).max(50) })).min(1).max(100),
  discount: z.object({ type: z.enum(["PERCENT", "AMOUNT"]), value: z.number().min(0), reason: z.string().trim().max(120) }).nullable(),
  approverPin: z.string().regex(/^\d{4,6}$/).optional(),
  tenders: z.array(z.object({
    method: z.enum(["CASH", "ESEWA_QR", "KHALTI_QR", "FONEPAY_QR", "CARD", "BANK", "VOUCHER"]),
    amount: z.number().int().positive(),
    tendered: z.number().int().positive().optional(),
    reference: z.string().trim().max(60).optional(),
  })).min(1).max(6),
  customer: z.object({ name: z.string().trim().max(80).optional(), phone: z.string().trim().regex(/^9[678]\d{8}$/).optional().or(z.literal("")) }).optional(),
});

export type PosSaleInput = z.input<typeof saleSchema>;

class SaleError extends Error {}

export async function createPosSale(input: PosSaleInput): Promise<R<{ orderId: string; number: string; change: number }>> {
  const me = await requirePermission("pos.sell");
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some sale details are invalid. Check items and payments." };
  const d = parsed.data;

  // Idempotency: a double-tap or a retried request returns the original sale
  const existing = await db.order.findUnique({ where: { clientRef: d.clientRef }, select: { id: true, number: true } });
  if (existing) return { ok: true, orderId: existing.id, number: formatOrderNumber(existing.number), change: 0 };

  const shift = await getOpenShift(me.id);
  if (!shift) return { ok: false, error: "Open your shift before selling." };

  // Merge duplicate scans of the same variant
  const qty = new Map<string, number>();
  for (const l of d.lines) qty.set(l.variantId, (qty.get(l.variantId) ?? 0) + l.quantity);
  const variants = await db.variant.findMany({
    where: { id: { in: [...qty.keys()] } },
    include: { product: { select: { id: true, name: true, slug: true, price: true, status: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } } },
  });
  if (variants.length !== qty.size) return { ok: false, error: "An item in this sale no longer exists. Remove it and rescan." };

  // Prices always come from the database, never from the till
  const subtotal = variants.reduce((s, v) => s + v.product.price * qty.get(v.id)!, 0);

  // Discount with accountability: employee + amount + reason + approver
  let discount = 0;
  let approverId: string | null = null;
  if (d.discount && d.discount.value > 0) {
    discount = d.discount.type === "PERCENT" ? Math.floor((subtotal * Math.min(d.discount.value, 100)) / 100 / 100) * 100 : Math.min(rupeesToPaisa(d.discount.value), subtotal);
    if (!d.discount.reason) return { ok: false, error: "Add a reason for the discount." };
    const percent = (discount / subtotal) * 100;
    if (percent > discountLimitPercent(me.role as Role)) {
      if (!d.approverPin) return { ok: false, error: `A ${percent.toFixed(1)}% discount needs a ${percent > 15 ? "owner" : "manager"}'s PIN.` };
      const found = await findApproverByPin(me.id, d.approverPin);
      if (!found.ok) return { ok: false, error: found.error };
      if (percent > discountLimitPercent(found.approver.role)) return { ok: false, error: "Discounts above 15% need the owner's PIN." };
      approverId = found.approver.id;
    }
  }
  const total = subtotal - discount;

  // Tenders must cover the sale exactly; cash may be over-tendered (we give change)
  const paid = d.tenders.reduce((s, t) => s + t.amount, 0);
  if (paid !== total) return { ok: false, error: `Payments (${formatPrice(paid)}) must equal the total (${formatPrice(total)}).` };
  let change = 0;
  for (const t of d.tenders) {
    if (t.method === "CASH" && t.tendered != null) {
      if (t.tendered < t.amount) return { ok: false, error: "Cash received is less than the cash amount." };
      change += t.tendered - t.amount;
    }
  }

  // Store-credit vouchers: must exist, be active and cover the amount applied
  const voucherTenders = d.tenders.filter((t) => t.method === "VOUCHER");
  for (const t of voucherTenders) {
    const code = t.reference?.trim().toUpperCase();
    if (!code) return { ok: false, error: "Enter the voucher code." };
    const v = await db.coupon.findUnique({ where: { code } });
    if (!v || !v.isCredit || !v.active || (v.endsAt && v.endsAt < new Date())) return { ok: false, error: `Voucher ${code} isn't valid.` };
    if (v.value < t.amount) return { ok: false, error: `Voucher ${code} has only ${formatPrice(v.value)} left.` };
    t.reference = code;
  }

  // Link a known customer by phone (counts toward their history)
  const phone = d.customer?.phone || "";
  const customer = phone ? await db.user.findFirst({ where: { phone, role: "CUSTOMER" }, select: { id: true, email: true } }) : null;
  const store = await db.store.findUniqueOrThrow({ where: { id: shift.storeId }, select: { id: true, name: true } });
  const inactive = variants.find((v) => v.product.status !== "ACTIVE");
  if (inactive) return { ok: false, error: `${inactive.product.name} is not for sale.` };

  try {
    const order = await db.$transaction(async (tx) => {
      for (const t of voucherTenders) {
        const res = await tx.coupon.updateMany({ where: { code: t.reference!, active: true, isCredit: true, value: { gte: t.amount } }, data: { value: { decrement: t.amount }, usedCount: { increment: 1 } } });
        if (!res.count) throw new SaleError(`Voucher ${t.reference} was just used. Check its balance.`);
        await tx.coupon.updateMany({ where: { code: t.reference!, value: 0 }, data: { active: false } });
      }
      const o = await tx.order.create({
        data: {
          channel: "STORE",
          clientRef: d.clientRef,
          userId: customer?.id,
          email: customer?.email ?? "",
          phone,
          status: "DELIVERED",
          paymentStatus: "PAID",
          paymentMethod: "IN_STORE",
          subtotal, discount, shippingFee: 0, total,
          discountReason: discount ? d.discount!.reason : null,
          discountApprovedById: approverId,
          cashierId: me.id,
          shiftId: shift.id,
          shippingMethod: "store",
          shippingAddress: { store: store.name, fullName: d.customer?.name || "Walk-in customer", phone } as Prisma.InputJsonValue,
          items: {
            create: variants.map((v) => ({
              variantId: v.id, productId: v.product.id, name: v.product.name, slug: v.product.slug, sku: v.sku,
              color: v.color, size: v.size, image: v.product.images[0]?.url ?? "", unitPrice: v.product.price, quantity: qty.get(v.id)!,
              unitCost: v.costPrice,
            })),
          },
          tenders: { create: d.tenders.map((t) => ({ method: t.method, amount: t.amount, tendered: t.method === "CASH" ? t.tendered ?? t.amount : null, reference: t.reference || null })) },
          events: { create: { status: "DELIVERED", actor: me.email, message: `Sold in store by ${me.name}${discount ? ` · discount ${formatPrice(discount)} (${d.discount!.reason})` : ""}` } },
        },
        select: { id: true, number: true, items: { select: { id: true, variantId: true, quantity: true } } },
      });
      // stock comes from this shop only, handed over on the spot (picked)
      await allocateOrder(tx, { orderId: o.id, only: store.id, picked: true, actorId: me.id, note: `Store sale · ${store.name}`, lines: o.items.map((i) => ({ orderItemId: i.id, variantId: i.variantId!, quantity: i.quantity, label: i.variantId! })) });
      for (const v of variants) await tx.product.update({ where: { id: v.product.id }, data: { soldCount: { increment: qty.get(v.id)! } } });
      if (customer) await earnForOrder(tx, o.id); // a store sale is delivered on the spot
      if (discount) {
        const approver = approverId ? await tx.user.findUnique({ where: { id: approverId }, select: { name: true } }) : null;
        await audit(tx, me, { action: "pos.discount", entity: ["Order", o.id], summary: `${formatOrderNumber(o.number)}: ${formatPrice(discount)} discount (${((discount / subtotal) * 100).toFixed(1)}%) on ${formatPrice(subtotal)} — ${d.discount!.reason}${approver ? ` · approved by ${approver.name}` : ""}`, changes: { subtotal, discount, approverId } });
      }
      return o;
    });
    revalidateTag("products", { expire: 60 });
    refresh(); // shift totals on the till
    return { ok: true, orderId: order.id, number: formatOrderNumber(order.number), change };
  } catch (e) {
    if (e instanceof SaleError) return { ok: false, error: e.message };
    if (e instanceof StockError) {
      const v = variants.find((x) => x.id === e.variantId);
      const here = v ? (await stockByLocation([v.id])).get(v.id)?.get(store.id) ?? 0 : 0;
      return { ok: false, error: v ? `${v.product.name} (${v.color} ${v.size}): the system shows only ${here} at ${store.name}. Recount, or ask a manager to adjust or transfer stock.` : e.message };
    }
    // a concurrent duplicate submit hit the unique clientRef — return the sale that won
    const dup = await db.order.findUnique({ where: { clientRef: d.clientRef }, select: { id: true, number: true } });
    if (dup) return { ok: true, orderId: dup.id, number: formatOrderNumber(dup.number), change };
    void reportError("createPosSale", e);
    return { ok: false, error: "The sale didn't go through and no stock was taken. Please try again." };
  }
}

// ---------- Click-and-collect hand-over ----------

export type PickupRow = { orderId: string; number: string; name: string; phone: string; units: number; due: number; readyAt: string | null };

/** Orders waiting at this till's shop. Search by order number (AS001234 / 1234) or phone. */
export async function listPickups(query = ""): Promise<{ ok: true; rows: PickupRow[] } | { ok: false; error: string }> {
  const me = await requirePermission("pos.sell");
  const shift = await getOpenShift(me.id);
  if (!shift) return { ok: false, error: "Open your shift first." };
  const q = query.trim();
  const num = Number(q.replace(/^AS0*/i, ""));
  const rows = await db.order.findMany({
    where: {
      pickupStoreId: shift.storeId, status: "PACKED",
      ...(q ? { OR: [...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []), { phone: { contains: q.replace(/\D/g, "") || q } }] } : {}),
    },
    select: { id: true, number: true, phone: true, total: true, paymentStatus: true, shippingAddress: true, items: { select: { quantity: true } }, events: { where: { status: "PACKED" }, select: { createdAt: true }, take: 1 } },
    orderBy: { updatedAt: "asc" },
    take: 50,
  });
  return {
    ok: true,
    rows: rows.map((o) => ({
      orderId: o.id, number: formatOrderNumber(o.number), name: (o.shippingAddress as { fullName?: string }).fullName ?? "", phone: o.phone,
      units: o.items.reduce((s, i) => s + i.quantity, 0), due: o.paymentStatus === "PAID" ? 0 : o.total, readyAt: o.events[0]?.createdAt.toISOString() ?? null,
    })),
  };
}

const collectSchema = z.object({
  orderId: z.string(),
  method: z.enum(["CASH", "ESEWA_QR", "KHALTI_QR", "FONEPAY_QR", "CARD", "BANK"]).optional(),
  tendered: z.number().int().positive().optional(),
  reference: z.string().trim().max(60).optional(),
});

/**
 * Hand a ready pickup order to the customer. Anything still due is taken here and recorded as a
 * tender on this cashier's shift, so it's in the drawer count and the day's closing.
 */
export async function collectPickup(input: z.input<typeof collectSchema>): Promise<R<{ change: number }>> {
  const me = await requirePermission("pos.sell");
  const p = collectSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the payment details." };
  const d = p.data;
  const shift = await getOpenShift(me.id);
  if (!shift) return { ok: false, error: "Open your shift before handing over orders." };
  const order = await db.order.findUnique({ where: { id: d.orderId }, select: { number: true, status: true, total: true, paymentStatus: true, pickupStoreId: true, pickupStore: { select: { name: true } } } });
  if (!order?.pickupStoreId) return { ok: false, error: "This isn't a pickup order." };
  if (order.pickupStoreId !== shift.storeId) return { ok: false, error: `This order is for pickup at ${order.pickupStore?.name}, not this shop.` };
  if (order.status !== "PACKED") return { ok: false, error: "This order isn't ready for pickup." };
  const due = order.paymentStatus === "PAID" ? 0 : order.total;
  let change = 0;
  if (due > 0) {
    if (!d.method) return { ok: false, error: `Take ${formatPrice(due)} before handing it over.` };
    if (d.method === "CASH") {
      const given = d.tendered ?? due;
      if (given < due) return { ok: false, error: "Cash received is less than the amount due." };
      change = given - due;
    } else if (!d.reference) return { ok: false, error: "Enter the payment reference." };
  }
  try {
    await transitionOrder({
      orderId: d.orderId, to: "DELIVERED", actor: me.email, actorId: me.id, handover: true,
      message: `Collected at ${order.pickupStore?.name}${due ? ` · paid ${formatPrice(due)} at the counter` : ""}`,
      within: async (tx) => {
        await tx.order.update({ where: { id: d.orderId }, data: { shiftId: shift.id, cashierId: me.id } });
        if (due > 0) await tx.tender.create({ data: { orderId: d.orderId, method: d.method!, amount: due, tendered: d.method === "CASH" ? d.tendered ?? due : null, reference: d.reference || null } });
      },
    });
  } catch (e) {
    if (e instanceof TransitionError) return { ok: false, error: e.message };
    void reportError("collectPickup", e);
    return { ok: false, error: "Couldn't record the hand-over. Nothing was saved — please try again." };
  }
  refresh();
  return { ok: true, change };
}

// ---------- Daily closing ----------

export async function lockDay(date: string, note?: string, storeId?: string): Promise<R> {
  const me = await requirePermission("closing");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > ktmDate()) return { ok: false, error: "Invalid date." };
  const store = await getShop(storeId, await scopeFor(me));
  if (!store || (storeId && store.id !== storeId)) return { ok: false, error: "You can only close the day at a shop you manage." };
  if (await isDayLocked(store.id, date)) return { ok: false, error: "This day is already locked." };
  const summary = await buildDaySummary(store.id, date);
  if (!summary.allShiftsClosed) return { ok: false, error: "Close every shift before locking the day." };
  if (summary.cash.difference !== 0 && !note?.trim()) return { ok: false, error: "There is a cash difference. Add a closing note before locking." };
  await db.$transaction(async (tx) => {
    const dc = await tx.dayClose.create({ data: { storeId: store.id, date, summary: summary as unknown as Prisma.InputJsonValue, note: note?.trim().slice(0, 500) || null, lockedById: me.id } });
    await audit(tx, me, { action: "day.lock", entity: ["DayClose", dc.id], summary: `Locked ${date} at ${store.name}${summary.cash.difference ? ` with cash difference ${formatPrice(summary.cash.difference)}: ${note?.trim().slice(0, 120)}` : " (cash balanced)"}` });
  });
  refresh();
  return { ok: true };
}

// ---------- Approval PIN ----------

export async function setApprovalPin(password: string, pin: string): Promise<R> {
  const me = await getCurrentUser();
  if (!me || !can(me.role, "approve.discount")) return { ok: false, error: "Only managers and owners can set an approval PIN." };
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "PIN must be 4–6 digits." };
  if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) return { ok: false, error: "Choose a less guessable PIN (no repeats or sequences)." };
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, error: "Your password is incorrect." };
  // PINs must be unique across approvers so the till knows who approved
  const others = await db.user.findMany({ where: { id: { not: me.id }, approvalPinHash: { not: null } }, select: { approvalPinHash: true } });
  for (const o of others) if (await bcrypt.compare(pin, o.approvalPinHash!)) return { ok: false, error: "Choose a different PIN." };
  await db.user.update({ where: { id: me.id }, data: { approvalPinHash: await bcrypt.hash(pin, 10) } });
  await audit(db, me, { action: "auth.pin_set", entity: ["User", me.id], summary: `${me.name} set a new approval PIN` });
  return { ok: true };
}
