import "server-only";
import { randomBytes } from "node:crypto";
import type { Coupon, Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { store } from "./config";
import { ktmDate } from "./pos";
import { evaluateCoupon, type CouponCheck } from "./pricing";
import { formatOrderNumber, formatPrice } from "./utils";

// Refer a friend and birthday treats.
//  - every customer has a personal code; a friend using it gets `friendDiscount` off their FIRST order
//    (first = no earlier non-cancelled order by that account, phone or email), never on their own code
//  - the referrer earns `referrerPoints` once that order is delivered (at most `monthlyCap` per 30 days),
//    taken back if the order is returned
//  - birthday points once a year, only for customers with a delivered order (no farming with new accounts)

type Tx = Prisma.TransactionClient;
type Reader = Tx | PrismaClient;
const CODE_RE = /^[A-Z0-9]{6,12}$/;

/** The customer's code, made on first use: up to 5 letters of their first name + 4 random characters. */
export async function ensureReferralCode(userId: string, reader: Reader = db) {
  const u = await reader.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, referralCode: true } });
  if (u.referralCode) return u.referralCode;
  const stem = (u.name.split(" ")[0] ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "ASSON";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I to misread
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = stem + [...randomBytes(4)].map((b) => alphabet[b % alphabet.length]).join("");
    if (await reader.coupon.findUnique({ where: { code }, select: { id: true } })) continue;
    const res = await reader.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } }).catch(() => ({ count: 0 }));
    if (res.count) return code;
    const now = await reader.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
    if (now.referralCode) return now.referralCode;
  }
  throw new Error("Could not make a referral code");
}

/** The friend's discount as an in-memory fixed-amount coupon, so it goes through the same checks and totals. */
function referralCoupon(code: string): Coupon {
  const r = store.referral;
  return { id: `referral:${code}`, code, description: `Friend's code: ${formatPrice(r.friendDiscount)} off your first order`, type: "FIXED", isCredit: false, value: r.friendDiscount, minSubtotal: r.friendMinSubtotal, maxDiscount: null, usageLimit: null, usedCount: 0, startsAt: null, endsAt: null, active: true, showOnHome: false, createdAt: new Date(0) };
}

export type ReferralResult = { referrerId: string; check: CouponCheck };

/**
 * If `code` is someone's referral code, check the shopper may use it and price it. Returns null when the
 * code isn't a referral code (it may be an ordinary coupon). `who` is whatever is known: the quote only
 * knows a signed-in account; placing the order also knows the phone and email.
 */
export async function resolveReferral(reader: Reader, code: string, who: { userId?: string | null; email?: string; phone?: string }, subtotal: number): Promise<ReferralResult | null> {
  const c = code.trim().toUpperCase();
  if (!CODE_RE.test(c)) return null;
  const referrer = await reader.user.findUnique({ where: { referralCode: c }, select: { id: true, email: true, phone: true } });
  if (!referrer) return null;
  const no = (reason: string): ReferralResult => ({ referrerId: referrer.id, check: { ok: false, reason } });
  const phone = who.phone?.replace(/\D/g, "").slice(-10);
  if (referrer.id === who.userId || (who.email && who.email.toLowerCase() === referrer.email.toLowerCase()) || (phone && referrer.phone && phone === referrer.phone.replace(/\D/g, "").slice(-10)))
    return no("That's your own referral code. Share it with friends instead!");
  const ids = [who.userId ? { userId: who.userId } : null, who.email ? { email: who.email.toLowerCase() } : null, phone ? { phone } : null].filter((x): x is NonNullable<typeof x> => !!x);
  if (ids.length && (await reader.order.count({ where: { status: { not: "CANCELLED" }, OR: ids } })))
    return no("Friend codes are for a first order. Welcome back, and thank you!");
  return { referrerId: referrer.id, check: evaluateCoupon(referralCoupon(c), subtotal) };
}

/** On delivery: points for the friend who shared the code (once, within the monthly cap) and a thank-you SMS. */
export async function rewardReferrer(tx: Tx, orderId: string) {
  const o = await tx.order.findUnique({ where: { id: orderId }, select: { number: true, referrerId: true, referralRewardedAt: true } });
  if (!o?.referrerId || o.referralRewardedAt) return 0;
  const claimed = await tx.order.updateMany({ where: { id: orderId, referralRewardedAt: null }, data: { referralRewardedAt: new Date() } });
  if (!claimed.count) return 0;
  const recent = await tx.pointsEntry.count({ where: { userId: o.referrerId, reason: "REFERRAL", createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } });
  if (recent >= store.referral.monthlyCap) return 0;
  const pts = store.referral.referrerPoints;
  const u = await tx.user.update({ where: { id: o.referrerId }, data: { points: { increment: pts } }, select: { phone: true, name: true } });
  await tx.pointsEntry.create({ data: { userId: o.referrerId, delta: pts, reason: "REFERRAL", orderId, note: `Friend's first order ${formatOrderNumber(o.number)}` } });
  if (u.phone && /^9[678]\d{8}$/.test(u.phone)) {
    await tx.notification.create({ data: { channel: "SMS", template: "referral_reward", to: u.phone, body: `${store.name}: your friend's first order has arrived. Thank you for sharing! ${pts} points (${formatPrice(pts * store.loyalty.pointValue)}) are now in your account.` } });
  }
  return pts;
}

/** The friend's order came back: take the referral points back (as far as the balance allows). */
export async function reverseReferral(tx: Tx, orderId: string) {
  const given = await tx.pointsEntry.findFirst({ where: { orderId, reason: "REFERRAL" }, select: { userId: true, delta: true } });
  if (!given || (await tx.pointsEntry.count({ where: { orderId, reason: "REFERRAL_REVERSE" } }))) return 0;
  const u = await tx.user.findUniqueOrThrow({ where: { id: given.userId }, select: { points: true } });
  const take = Math.min(given.delta, u.points);
  if (take > 0) {
    const res = await tx.user.updateMany({ where: { id: given.userId, points: { gte: take } }, data: { points: { decrement: take } } });
    if (!res.count) return 0;
  }
  await tx.pointsEntry.create({ data: { userId: given.userId, delta: -take, reason: "REFERRAL_REVERSE", orderId, note: take < given.delta ? `${given.delta - take} already spent` : null } });
  return take;
}

/** Today's birthdays (Nepal date). 29 Feb birthdays are celebrated on 28 Feb in other years. */
export async function birthdayRun(now = new Date()) {
  const day = ktmDate(now), year = Number(day.slice(0, 4)), mmdd = day.slice(5);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = mmdd === "02-28" && !leap ? ["02-28", "02-29"] : [mmdd];
  const people = await db.user.findMany({
    where: { role: "CUSTOMER", birthday: { in: days }, OR: [{ birthdayRewardYear: null }, { birthdayRewardYear: { not: year } }], orders: { some: { status: "DELIVERED" } } },
    select: { id: true, name: true, phone: true },
    take: 5000,
  });
  const pts = store.birthday.points;
  let rewarded = 0;
  for (const p of people) {
    await db.$transaction(async (tx) => {
      const claimed = await tx.user.updateMany({ where: { id: p.id, OR: [{ birthdayRewardYear: null }, { birthdayRewardYear: { not: year } }] }, data: { birthdayRewardYear: year, points: { increment: pts } } });
      if (!claimed.count) return;
      await tx.pointsEntry.create({ data: { userId: p.id, delta: pts, reason: "BIRTHDAY", note: `Happy birthday ${year}` } });
      if (p.phone && /^9[678]\d{8}$/.test(p.phone)) {
        await tx.notification.create({ data: { channel: "SMS", template: "birthday", to: p.phone, body: `Happy birthday${p.name ? `, ${p.name.split(" ")[0]}` : ""}! ${store.name} has added ${pts} points (${formatPrice(pts * store.loyalty.pointValue)}) to your account. Treat yourself: ${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/shop` } });
      }
      rewarded++;
    });
  }
  return { day, rewarded };
}
