// Client-safe loyalty maths (pure). Server bookkeeping lives in lib/loyalty.ts.
import { store } from "./config";

const L = store.loyalty;
export type Tier = (typeof L.tiers)[number];

export function tierFor(spend12m: number): Tier {
  return [...L.tiers].reverse().find((t) => spend12m >= t.minSpend) ?? L.tiers[0];
}

export function nextTier(spend12m: number): { tier: Tier; remaining: number } | null {
  const next = L.tiers.find((t) => t.minSpend > spend12m);
  return next ? { tier: next, remaining: next.minSpend - spend12m } : null;
}

/** Points earned for goods actually paid (paisa), with the tier multiplier. */
export function pointsToEarn(paidForGoods: number, tier: Tier) {
  return Math.max(0, Math.floor((paidForGoods / L.earnPer) * tier.multiplier));
}

export const pointsValue = (points: number) => points * L.pointValue;

/** How many points may be used on a bag: needs the minimum balance, capped by % of the bag. */
export function maxRedeemable(balance: number, bagAfterCoupon: number) {
  if (balance < L.minRedeem || bagAfterCoupon <= 0) return 0;
  const capByBag = Math.floor((bagAfterCoupon * L.maxRedeemPercent) / 100 / L.pointValue);
  return Math.max(0, Math.min(balance, capByBag));
}
