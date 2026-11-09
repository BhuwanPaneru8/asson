import type { Coupon } from "@prisma/client";
import type { ShippingMethodId } from "./config";
import { deliveryFee, type DeliveryRate } from "./delivery-shared";
import { formatPrice } from "./utils";

export type CouponCheck =
  | { ok: true; coupon: Coupon; discount: number; freeShipping: boolean }
  | { ok: false; reason: string };

/** Pure coupon evaluation — safe to call on both quote and order placement. */
export function evaluateCoupon(coupon: Coupon | null, subtotal: number, now = new Date()): CouponCheck {
  if (!coupon || !coupon.active) return { ok: false, reason: "This code isn't valid." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, reason: "This code isn't active yet." };
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, reason: "This code has expired." };
  if (!coupon.isCredit && coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit)
    return { ok: false, reason: "This code has reached its usage limit." };
  if (subtotal < coupon.minSubtotal)
    return { ok: false, reason: `Add ${formatPrice(coupon.minSubtotal - subtotal)} more to use this code.` };

  let discount = 0;
  if (coupon.isCredit) {
    // store credit balance (value) covers up to the whole bag
    discount = Math.min(coupon.value, subtotal);
    if (discount <= 0) return { ok: false, reason: "This store credit has no balance left." };
  } else if (coupon.type === "PERCENT") {
    discount = Math.floor((subtotal * coupon.value) / 100 / 100) * 100; // whole rupees
    if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  } else if (coupon.type === "FIXED") {
    discount = Math.min(coupon.value, subtotal);
  }
  return { ok: true, coupon, discount, freeShipping: coupon.type === "FREE_SHIPPING" };
}

export type Totals = {
  subtotal: number;
  discount: number;
  pointsDiscount: number;
  shippingFee: number;
  total: number;
  itemCount: number;
};

export function computeTotals(
  lines: { unitPrice: number; quantity: number }[],
  opts: { method: ShippingMethodId; rate: DeliveryRate | null; coupon?: CouponCheck | null; pointsDiscount?: number },
): Totals {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const c = opts.coupon && opts.coupon.ok ? opts.coupon : null;
  const discount = c?.discount ?? 0;
  // No district yet → delivery unknown (0 here; the UI says "choose your district")
  const fee = itemCount === 0 || !opts.rate ? 0 : deliveryFee(opts.method, opts.rate, subtotal - discount, c?.freeShipping ?? false);
  const pointsDiscount = Math.min(opts.pointsDiscount ?? 0, Math.max(0, subtotal - discount));
  return { subtotal, discount, pointsDiscount, shippingFee: fee, total: Math.max(0, subtotal - discount - pointsDiscount + fee), itemCount };
}
