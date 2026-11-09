import { describe, expect, it } from "vitest";
import { maxRedeemable, nextTier, pointsToEarn, tierFor } from "@/lib/loyalty-shared";
import { computeTotals } from "@/lib/pricing";

describe("loyalty maths", () => {
  it("tiers by 12-month spend and multiplies earning", () => {
    expect(tierFor(0).name).toBe("Classic");
    expect(tierFor(2_500_000).name).toBe("Silver");
    expect(tierFor(10_000_000).name).toBe("Gold");
    expect(pointsToEarn(199_900, tierFor(0))).toBe(19);
    expect(pointsToEarn(199_900, tierFor(7_500_000))).toBe(29);
    expect(nextTier(2_000_000)).toEqual({ tier: expect.objectContaining({ name: "Silver" }), remaining: 500_000 });
    expect(nextTier(9_000_000)).toBeNull();
  });
  it("redeems only above the minimum and up to 20% of the bag", () => {
    expect(maxRedeemable(99, 500_000)).toBe(0);
    expect(maxRedeemable(5000, 200_000)).toBe(400);
    expect(maxRedeemable(150, 200_000)).toBe(150);
    expect(maxRedeemable(-20, 200_000)).toBe(0);
  });
  it("points come off after the coupon and never below zero", () => {
    const t = computeTotals([{ unitPrice: 100_000, quantity: 1 }], { method: "standard", rate: null, pointsDiscount: 500_000 });
    expect(t).toMatchObject({ pointsDiscount: 100_000, total: 0 });
  });
});
