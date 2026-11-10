"use server";

import { refresh, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, getCurrentUser } from "@/lib/auth";
import { addressFields, fieldErrors, phoneSchema, withProvince } from "@/lib/validators";
import { CUSTOMER_CANCELLABLE, TransitionError, transitionOrder } from "@/lib/orders";
import { store } from "@/lib/config";
import { after } from "next/server";
import { dispatchNotifications } from "@/lib/notifications";
import { localiseResult } from "@/lib/i18n/server";

type R = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

async function saveAddressImpl(input: unknown, id?: string): Promise<R & { id?: string }> {
  const user = await requireUser();
  const parsed = addressFields.extend({ isDefault: z.boolean().optional() }).transform(withProvince).safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const { isDefault, ...a } = parsed.data;
  const count = await db.address.count({ where: { userId: user.id } });
  const makeDefault = isDefault || count === 0;
  const saved = await db.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    if (id) {
      const own = await tx.address.findFirst({ where: { id, userId: user.id } });
      if (!own) throw new Error("not found");
      return tx.address.update({ where: { id }, data: { ...a, line2: a.line2 || null, postalCode: a.postalCode || null, ...(makeDefault ? { isDefault: true } : {}) } });
    }
    return tx.address.create({ data: { ...a, line2: a.line2 || null, postalCode: a.postalCode || null, userId: user.id, isDefault: makeDefault } });
  });
  refresh();
  return { ok: true, id: saved.id };
}

async function deleteAddressImpl(id: string): Promise<R> {
  const user = await requireUser();
  const a = await db.address.findFirst({ where: { id, userId: user.id } });
  if (!a) return { ok: false, error: "Address not found." };
  await db.address.delete({ where: { id } });
  if (a.isDefault) {
    const next = await db.address.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    if (next) await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  refresh();
  return { ok: true };
}

async function setDefaultAddressImpl(id: string): Promise<R> {
  const user = await requireUser();
  await db.$transaction([
    db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    db.address.updateMany({ where: { id, userId: user.id }, data: { isDefault: true } }),
  ]);
  refresh();
  return { ok: true };
}

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema.or(z.literal("")),
  // "MM-DD", no year: we only need the day to say happy birthday
  birthday: z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Choose a valid day").refine((d) => !["02-30", "02-31", "04-31", "06-31", "09-31", "11-31"].includes(d), "Choose a valid day").optional().or(z.literal("")),
});

async function updateProfileImpl(input: unknown): Promise<R> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name, phone: parsed.data.phone || null, ...(parsed.data.birthday !== undefined ? { birthday: parsed.data.birthday || null } : {}) } });
  refresh();
  return { ok: true };
}

async function ownOrder(orderId: string) {
  const user = await getCurrentUser();
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, userId: true, email: true, status: true, updatedAt: true, events: { where: { status: "DELIVERED" }, select: { createdAt: true } } } });
  if (!order) return null;
  // signed-in owners, or guests holding the unguessable order link
  if (order.userId && order.userId !== user?.id) return null;
  return { order, actor: user?.email ?? order.email };
}

async function cancelOrderImpl(orderId: string, reason?: string): Promise<R> {
  const o = await ownOrder(orderId);
  if (!o) return { ok: false, error: "Order not found." };
  if (!CUSTOMER_CANCELLABLE.includes(o.order.status)) return { ok: false, error: "This order has already been packed and can't be cancelled. You can return it after delivery." };
  try {
    await transitionOrder({ orderId, to: "CANCELLED", actor: o.actor, message: `Cancelled by customer${reason ? `: ${reason.slice(0, 200)}` : ""}` });
  } catch (e) {
    return { ok: false, error: e instanceof TransitionError ? e.message : "Couldn't cancel. Please contact support." };
  }
  revalidateTag("products", { expire: 60 });
  after(() => dispatchNotifications().catch(() => {}));
  refresh();
  return { ok: true };
}

async function requestReturnImpl(orderId: string, reason: string): Promise<R> {
  const o = await ownOrder(orderId);
  if (!o) return { ok: false, error: "Order not found." };
  if (o.order.status !== "DELIVERED") return { ok: false, error: "Only delivered orders can be returned." };
  const deliveredAt = o.order.events[0]?.createdAt ?? o.order.updatedAt;
  if (Date.now() - deliveredAt.getTime() > store.returnWindowDays * 86400000) return { ok: false, error: `The ${store.returnWindowDays}-day return window for this order has closed.` };
  try {
    await transitionOrder({ orderId, to: "RETURN_REQUESTED", actor: o.actor, message: `Return requested: ${reason.slice(0, 200) || "No reason given"}` });
  } catch (e) {
    return { ok: false, error: e instanceof TransitionError ? e.message : "Couldn't request a return." };
  }
  refresh();
  return { ok: true };
}

const reviewSchema = z.object({
  productId: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(2, "Add a short title").max(80),
  body: z.string().trim().min(10, "Tell us a little more (10+ characters)").max(2000),
  fit: z.enum(["Runs small", "True to size", "Runs large"]).optional(),
});

async function submitReviewImpl(input: unknown): Promise<R> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to write a review." };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const purchased = await db.orderItem.findFirst({ where: { productId: d.productId, order: { userId: user.id, status: "DELIVERED" } }, select: { id: true } });
  await db.$transaction(async (tx) => {
    await tx.review.upsert({
      where: { productId_userId: { productId: d.productId, userId: user.id } },
      update: { rating: d.rating, title: d.title, body: d.body, fit: d.fit, verified: !!purchased },
      create: { ...d, userId: user.id, verified: !!purchased },
    });
    const agg = await tx.review.aggregate({ where: { productId: d.productId, status: "PUBLISHED" }, _avg: { rating: true }, _count: { _all: true } });
    await tx.product.update({ where: { id: d.productId }, data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count._all } });
  });
  revalidateTag("products", { expire: 0 });
  refresh();
  return { ok: true };
}

// Shoppers see these messages in their language (see lib/i18n localise).
export async function saveAddress(...args: Parameters<typeof saveAddressImpl>) { return localiseResult(await saveAddressImpl(...args)); }
export async function deleteAddress(...args: Parameters<typeof deleteAddressImpl>) { return localiseResult(await deleteAddressImpl(...args)); }
export async function setDefaultAddress(...args: Parameters<typeof setDefaultAddressImpl>) { return localiseResult(await setDefaultAddressImpl(...args)); }
export async function updateProfile(...args: Parameters<typeof updateProfileImpl>) { return localiseResult(await updateProfileImpl(...args)); }
export async function cancelOrder(...args: Parameters<typeof cancelOrderImpl>) { return localiseResult(await cancelOrderImpl(...args)); }
export async function requestReturn(...args: Parameters<typeof requestReturnImpl>) { return localiseResult(await requestReturnImpl(...args)); }
export async function submitReview(...args: Parameters<typeof submitReviewImpl>) { return localiseResult(await submitReviewImpl(...args)); }
