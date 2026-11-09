import { describe, expect, it } from "vitest";
import type { Coupon } from "@prisma/client";
import { computeTotals, evaluateCoupon } from "@/lib/pricing";
import { defaultRate, deliveryFee, etaLabel, rateFor } from "@/lib/delivery-shared";
import { store } from "@/lib/config";

const coupon = (c: Partial<Coupon>): Coupon => ({
  id: "c", code: "X", description: null, type: "PERCENT", value: 10, isCredit: false, minSubtotal: 0, maxDiscount: null,
  usageLimit: null, usedCount: 0, startsAt: null, endsAt: null, active: true, createdAt: new Date(), ...c,
});
const ktm = defaultRate("Kathmandu");
const humla = defaultRate("Humla");
const kaski = defaultRate("Kaski");

describe("evaluateCoupon", () => {
  it("applies a percent discount rounded down to whole rupees", () => {
    const r = evaluateCoupon(coupon({ value: 10 }), 149_900); // Rs 1,499 → 149.90 → Rs 149
    expect(r.ok && r.discount).toBe(14_900);
  });
  it("caps percent discounts at maxDiscount", () => {
    const r = evaluateCoupon(coupon({ value: 50, maxDiscount: 50_000 }), 1_000_000);
    expect(r.ok && r.discount).toBe(50_000);
  });
  it("never discounts more than the subtotal for fixed coupons", () => {
    const r = evaluateCoupon(coupon({ type: "FIXED", value: 900_000 }), 50_000);
    expect(r.ok && r.discount).toBe(50_000);
  });
  it("rejects inactive, expired, not-yet-started and exhausted codes", () => {
    const past = new Date(Date.now() - 1000), future = new Date(Date.now() + 86_400_000);
    expect(evaluateCoupon(coupon({ active: false }), 100_000).ok).toBe(false);
    expect(evaluateCoupon(coupon({ endsAt: past }), 100_000).ok).toBe(false);
    expect(evaluateCoupon(coupon({ startsAt: future }), 100_000).ok).toBe(false);
    expect(evaluateCoupon(coupon({ usageLimit: 5, usedCount: 5 }), 100_000).ok).toBe(false);
    expect(evaluateCoupon(null, 100_000).ok).toBe(false);
  });
  it("explains how much more is needed for a minimum spend", () => {
    const r = evaluateCoupon(coupon({ minSubtotal: 249_900 }), 200_000);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/Rs\. 499/);
  });
  it("treats store credit as a balance, ignoring usage limits", () => {
    const r = evaluateCoupon(coupon({ isCredit: true, type: "FIXED", value: 120_000, usageLimit: 1, usedCount: 3 }), 300_000);
    expect(r.ok && r.discount).toBe(120_000);
    expect(evaluateCoupon(coupon({ isCredit: true, type: "FIXED", value: 0 }), 300_000).ok).toBe(false);
  });
  it("flags free-shipping coupons", () => {
    const r = evaluateCoupon(coupon({ type: "FREE_SHIPPING", value: 0 }), 100_000);
    expect(r.ok && r.freeShipping).toBe(true);
    expect(r.ok && r.discount).toBe(0);
  });
});

describe("delivery fees", () => {
  const free = store.shipping.freeThreshold;
  it("charges the district rate below the free threshold", () => {
    expect(deliveryFee("standard", ktm, free - 100, false)).toBe(10_000);
    expect(deliveryFee("standard", kaski, free - 100, false)).toBe(15_000);
    expect(deliveryFee("standard", humla, free - 100, false)).toBe(25_000);
  });
  it("is free at or above the threshold, anywhere", () => {
    expect(deliveryFee("standard", humla, free, false)).toBe(0);
    expect(deliveryFee("standard", ktm, free + 1, false)).toBe(0);
  });
  it("express only where the district allows it, and free delivery only covers the standard part", () => {
    expect(deliveryFee("express", ktm, 0, false)).toBe(store.shipping.express.fee);
    expect(deliveryFee("express", ktm, free, false)).toBe(store.shipping.express.fee - ktm.fee);
    expect(deliveryFee("express", kaski, 0, false)).toBe(kaski.fee); // falls back to standard
  });
  it("free-shipping coupons waive standard delivery", () => {
    expect(deliveryFee("standard", humla, 1000, true)).toBe(0);
  });
  it("classifies districts and derives provinces", () => {
    expect(ktm.zone).toBe("VALLEY");
    expect(humla.zone).toBe("REMOTE");
    expect(humla.province).toBe("Karnali");
    expect(kaski.province).toBe("Gandaki");
    expect(rateFor({}, "")).toBeNull();
    expect(etaLabel(ktm)).toBe("1–2 days");
    expect(etaLabel(ktm, "express")).toBe(store.shipping.express.eta);
  });
});

describe("computeTotals", () => {
  const lines = [{ unitPrice: 149_900, quantity: 2 }, { unitPrice: 99_900, quantity: 1 }];
  it("adds items, applies coupon, then delivery on the discounted amount", () => {
    const c = evaluateCoupon(coupon({ type: "FIXED", value: 30_000 }), 399_700);
    const t = computeTotals(lines, { method: "standard", rate: humla, coupon: c });
    expect(t).toEqual({ subtotal: 399_700, discount: 30_000, pointsDiscount: 0, shippingFee: 0, total: 369_700, itemCount: 3 });
  });
  it("charges delivery when the discount drops the bag below the free threshold", () => {
    const c = evaluateCoupon(coupon({ type: "FIXED", value: 20_000 }), 260_000);
    const t = computeTotals([{ unitPrice: 260_000, quantity: 1 }], { method: "standard", rate: kaski, coupon: c });
    expect(t.shippingFee).toBe(15_000);
    expect(t.total).toBe(255_000);
  });
  it("has no delivery until a district is chosen, and none for an empty bag", () => {
    expect(computeTotals(lines, { method: "standard", rate: null }).shippingFee).toBe(0);
    expect(computeTotals([], { method: "standard", rate: ktm }).total).toBe(0);
  });
});
