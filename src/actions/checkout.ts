"use server";

import { reportError, reportErrorSoon } from "@/lib/errors";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth";
import { store, type ShippingMethodId } from "@/lib/config";
import { computeTotals, evaluateCoupon, type Totals } from "@/lib/pricing";
import { getDeliveryRates } from "@/lib/delivery";
import { rateFor, etaLabel } from "@/lib/delivery-shared";
import { addressSchema, fieldErrors, phoneSchema, type AddressInput } from "@/lib/validators";
import { onlinePaymentsEnabled } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import { after } from "next/server";
import { dispatchNotifications, queueOrderNotice } from "@/lib/notifications";
import { formatPrice } from "@/lib/utils";
import { maxRedeemable, pointsValue } from "@/lib/loyalty-shared";
import { clientIp } from "@/lib/client-ip";
import { allocateOrder, StockError } from "@/lib/stock";
import { resolveReferral } from "@/lib/referrals";
import { localiseResult } from "@/lib/i18n/server";

const methodIds = ["standard", "express"] as [ShippingMethodId, ...ShippingMethodId[]];

type Delivery = { known: boolean; serviceable: boolean; codAvailable: boolean; expressAvailable: boolean; eta: string | null };
export type Quote =
  | { ok: true; totals: Totals; delivery: Delivery; points: PointsQuote; coupon?: { code: string; description: string | null } }
  | { ok: false; error: string; totals: Totals; delivery: Delivery; points: PointsQuote };

/** balance: the shopper's points; usable: how many can go on this bag; used: applied now */
type PointsQuote = { balance: number; usable: number; used: number };

async function pointsFor(userId: string | undefined, bagAfterCoupon: number, want: boolean): Promise<PointsQuote> {
  if (!userId) return { balance: 0, usable: 0, used: 0 };
  const u = await db.user.findUnique({ where: { id: userId }, select: { points: true } });
  const balance = u?.points ?? 0;
  const usable = maxRedeemable(balance, bagAfterCoupon);
  return { balance, usable, used: want ? usable : 0 };
}

/** Live price quote for the checkout summary. Always recomputed on the server. */
async function quoteCheckoutImpl(input: { couponCode?: string; shippingMethod: string; district?: string; usePoints?: boolean; pickup?: boolean }): Promise<Quote> {
  const [cart, user] = await Promise.all([getCart(), getCurrentUser()]);
  // click-and-collect has no delivery fee
  const rate = input.pickup ? null : rateFor(await getDeliveryRates(), input.district);
  const wanted = (methodIds as string[]).includes(input.shippingMethod) ? (input.shippingMethod as ShippingMethodId) : "standard";
  const method = wanted === "express" && !rate?.expressAvailable ? "standard" : wanted;
  const delivery: Delivery = rate
    ? { known: true, serviceable: rate.serviceable, codAvailable: rate.codAvailable, expressAvailable: rate.expressAvailable, eta: etaLabel(rate, method) }
    : { known: false, serviceable: true, codAvailable: true, expressAvailable: false, eta: null };
  const code = input.couponCode?.trim().toUpperCase();
  const lines = cart.lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity }));
  const coupon = code ? await db.coupon.findUnique({ where: { code } }) : null;
  // not a coupon? it may be a friend's referral code (first orders only; re-checked with phone and email at order time)
  const referral = code && !coupon ? await resolveReferral(db, code, { userId: user?.id, email: user?.email }, cart.subtotal) : null;
  const check = referral ? referral.check : code ? evaluateCoupon(coupon, cart.subtotal) : null;
  const couponDiscount = check?.ok ? check.discount : 0;
  const points = await pointsFor(user?.id, cart.subtotal - couponDiscount, !!input.usePoints);
  const totals = computeTotals(lines, { method, rate, coupon: check, pointsDiscount: pointsValue(points.used) });
  if (check && !check.ok) return { ok: false, error: check.reason, totals, delivery, points };
  return { ok: true, totals, delivery, points, ...(check?.ok ? { coupon: { code: check.coupon.code, description: check.coupon.description } } : {}) };
}

const orderSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: phoneSchema,
  addressId: z.string().optional(),
  address: addressSchema.optional(),
  saveAddress: z.boolean().default(false),
  shippingMethod: z.enum(methodIds),
  paymentMethod: z.enum(["COD", "ONLINE"]),
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
  note: z.string().trim().max(500).optional(),
  usePoints: z.boolean().default(false),
  /** click-and-collect instead of courier delivery */
  pickupStoreId: z.string().optional(),
  pickupName: z.string().trim().min(2, "Enter the name of the person collecting").max(80).optional(),
});

export type PlaceOrderState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

class CheckoutError extends Error {}

async function placeOrderImpl(input: z.input<typeof orderSchema>): Promise<PlaceOrderState> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const data = parsed.data;
  const user = await getCurrentUser();

  const h = await headers();
  const ip = clientIp(h);
  if (!rateLimit(`order:${ip}`, 20, 60 * 60_000)) return { error: "Too many orders from this network. Please try again later." };

  const cart = await getCart();
  if (!cart.id || cart.lines.length === 0) return { error: "Your bag is empty." };
  const unavailable = cart.lines.find((l) => !l.available);
  if (unavailable) return { error: `${unavailable.name} (${unavailable.size}) ${unavailable.stock > 0 ? `has only ${unavailable.stock} left` : "is sold out"}. Please update your bag.` };
  if (data.paymentMethod === "ONLINE" && !(store.onlinePaymentsLive && onlinePaymentsEnabled())) return { error: "Online payment isn't available right now. Please choose Cash on Delivery." };

  // Where it goes: a shop counter (click-and-collect, free) or an address (courier)
  let address: AddressInput | undefined;
  let rate: ReturnType<typeof rateFor> = null;
  let shop: { id: string; name: string; address: string; hours: string | null; phone: string | null } | null = null;
  if (data.pickupStoreId) {
    shop = await db.store.findFirst({ where: { id: data.pickupStoreId, active: true, pickup: true, kind: "SHOP" }, select: { id: true, name: true, address: true, hours: true, phone: true } });
    if (!shop) return { error: "That shop isn't taking pickup orders right now. Please choose another one." };
    if (!data.pickupName) return { error: "Tell us who will collect the order.", fieldErrors: { pickupName: "Enter the name of the person collecting" } };
  } else {
    address = data.address;
    if (data.addressId) {
      if (!user) return { error: "Please sign in to use a saved address." };
      const saved = await db.address.findFirst({ where: { id: data.addressId, userId: user.id } });
      if (!saved) return { error: "That address is no longer available." };
      address = { fullName: saved.fullName, phone: saved.phone, line1: saved.line1, line2: saved.line2 ?? "", city: saved.city, district: saved.district, state: saved.state, postalCode: saved.postalCode ?? "" };
    }
    if (!address) return { error: "Add a delivery address.", fieldErrors: { "address.line1": "Required" } };
    rate = rateFor(await getDeliveryRates(), address.district)!;
    if (!rate.serviceable) return { error: `Sorry, we don't deliver to ${address.district} yet. Call us and we'll arrange it.` };
    if (data.shippingMethod === "express" && !rate.expressAvailable) return { error: `Express delivery isn't available in ${address.district}. Please choose standard delivery.` };
    if (data.paymentMethod === "COD" && !rate.codAvailable) return { error: `Cash on delivery isn't available in ${address.district} yet.` };
  }

  const coupon = data.couponCode ? await db.coupon.findUnique({ where: { code: data.couponCode } }) : null;
  const referral = data.couponCode && !coupon ? await resolveReferral(db, data.couponCode, { userId: user?.id, email: data.email, phone: data.phone }, cart.subtotal) : null;
  const couponCheck = referral ? referral.check : data.couponCode ? evaluateCoupon(coupon, cart.subtotal) : null;
  if (couponCheck && !couponCheck.ok) return { error: couponCheck.reason };
  const points = await pointsFor(user?.id, cart.subtotal - (couponCheck?.ok ? couponCheck.discount : 0), data.usePoints);
  const totals = computeTotals(cart.lines, { method: data.shippingMethod, rate, coupon: couponCheck, pointsDiscount: pointsValue(points.used) });
  if (data.paymentMethod === "COD" && totals.total > store.codMaxOrder) return { error: `${shop ? "Paying at the shop" : "Cash on Delivery"} is available for orders up to ${formatPrice(store.codMaxOrder)}.` };
  const shippingAddress = shop
    ? { pickup: true, storeId: shop.id, store: shop.name, storeAddress: shop.address, hours: shop.hours, storePhone: shop.phone, fullName: data.pickupName!, phone: data.phone, country: store.country }
    : { ...address!, line2: address!.line2 || null, postalCode: address!.postalCode || null, country: store.country, zone: rate!.zone, etaMaxDays: data.shippingMethod === "express" ? 1 : rate!.etaMaxDays };

  let orderId: string;
  try {
    orderId = await db.$transaction(async (tx) => {
      if (coupon && couponCheck?.ok && coupon.isCredit) {
        // store credit: draw down the balance atomically
        const res = await tx.coupon.updateMany({ where: { id: coupon.id, active: true, value: { gte: couponCheck.discount } }, data: { value: { decrement: couponCheck.discount }, usedCount: { increment: 1 } } });
        if (res.count === 0) throw new CheckoutError("This store credit has just been used. Please try again.");
        await tx.coupon.updateMany({ where: { id: coupon.id, value: 0 }, data: { active: false } });
      } else if (coupon && couponCheck?.ok) {
        const res = await tx.coupon.updateMany({
          where: { id: coupon.id, ...(coupon.usageLimit != null ? { usedCount: { lt: coupon.usageLimit } } : {}) },
          data: { usedCount: { increment: 1 } },
        });
        if (res.count === 0) throw new CheckoutError("This coupon has just reached its usage limit.");
      }
      if (points.used > 0) {
        // spend points atomically: never below zero, even with two checkouts at once
        const res = await tx.user.updateMany({ where: { id: user!.id, points: { gte: points.used } }, data: { points: { decrement: points.used } } });
        if (res.count === 0) throw new CheckoutError("Your points balance just changed. Please review your order and try again.");
      }
      const order = await tx.order.create({
        data: {
          userId: user?.id,
          pointsRedeemed: points.used,
          pointsDiscount: totals.pointsDiscount,
          email: data.email,
          phone: data.phone,
          paymentMethod: data.paymentMethod,
          subtotal: totals.subtotal,
          discount: totals.discount,
          shippingFee: totals.shippingFee,
          total: totals.total,
          couponCode: couponCheck?.ok ? couponCheck.coupon.code : null,
          shippingMethod: shop ? "pickup" : data.shippingMethod,
          shippingAddress,
          pickupStoreId: shop?.id ?? null,
          referrerId: referral?.check.ok ? referral.referrerId : null,
          customerNote: data.note || null,
          items: {
            create: cart.lines.map((l) => ({
              variantId: l.variantId, productId: l.productId, name: l.name, slug: l.slug,
              sku: "", color: l.color, size: l.size, image: l.image, unitPrice: l.unitPrice, quantity: l.quantity,
            })),
          },
          events: { create: { status: "PENDING", message: "Order placed", actor: user?.email ?? "guest" } },
        },
        select: { id: true, items: { select: { id: true, variantId: true, quantity: true, name: true, size: true } } },
      });
      // Atomic, race-safe stock reservation per location (conditional decrements, see lib/stock.ts):
      // two shoppers can never both buy the last unit. Records where each unit comes from.
      await allocateOrder(tx, {
        orderId: order.id,
        lines: order.items.map((i) => ({ orderItemId: i.id, variantId: i.variantId!, quantity: i.quantity, label: `${i.name} (${i.size})` })),
        actorId: user?.id,
        prefer: shop?.id, // click-and-collect: take it off the pickup shop's shelf when it's there
        toDistrict: address?.district, // delivery: nearest location that can send the whole order
      });
      // fill SKU snapshot
      const variants = await tx.variant.findMany({ where: { id: { in: cart.lines.map((l) => l.variantId) } }, select: { id: true, sku: true, costPrice: true } });
      for (const v of variants) await tx.orderItem.updateMany({ where: { orderId: order.id, variantId: v.id }, data: { sku: v.sku, unitCost: v.costPrice } });
      for (const l of cart.lines) await tx.product.update({ where: { id: l.productId }, data: { soldCount: { increment: l.quantity } } });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id! } });
      if (user && address && data.saveAddress && !data.addressId) {
        const count = await tx.address.count({ where: { userId: user.id } });
        await tx.address.create({ data: { ...address, line2: address.line2 || null, postalCode: address.postalCode || null, userId: user.id, isDefault: count === 0 } });
      }
      if (user && !user.phone) await tx.user.update({ where: { id: user.id }, data: { phone: data.phone } });
      if (user && referral?.check.ok) await tx.user.updateMany({ where: { id: user.id, referredById: null }, data: { referredById: referral.referrerId } });
      if (points.used > 0) await tx.pointsEntry.create({ data: { userId: user!.id, delta: -points.used, reason: "REDEEM", orderId: order.id } });
      await queueOrderNotice(tx, order.id, "placed");
      return order.id;
    }, { timeout: 15_000 });
  } catch (e) {
    if (e instanceof CheckoutError || e instanceof StockError) return { error: e.message };
    void reportError("placeOrder failed", e);
    return { error: "We couldn't place your order. You have not been charged — please try again." };
  }

  revalidateTag("products", { expire: 60 });
  revalidatePath("/", "layout"); // header bag count + any cached stock views
  after(() => dispatchNotifications().catch(reportErrorSoon("dispatchNotifications")));
  redirect(`/orders/${orderId}?placed=1`);
}

// Shoppers see these messages in their language (the logic above stays in English; see lib/i18n localise).
export async function quoteCheckout(...args: Parameters<typeof quoteCheckoutImpl>) { return localiseResult(await quoteCheckoutImpl(...args)); }
export async function placeOrder(...args: Parameters<typeof placeOrderImpl>) { return localiseResult(await placeOrderImpl(...args)); }
