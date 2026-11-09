import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addToCart } from "@/actions/cart";
import { placeOrder, quoteCheckout } from "@/actions/checkout";
import { updateProfile } from "@/actions/account";
import { transitionOrder } from "@/lib/orders";
import { birthdayRun, ensureReferralCode } from "@/lib/referrals";
import { RedirectError, session } from "../support/next-mocks";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";

type P = Awaited<ReturnType<typeof makeProduct>>;

async function buy(p: P, o: { code?: string; email?: string; phone?: string; qty?: number; asUser?: Awaited<ReturnType<typeof makeUser>> | null }) {
  session.user = o.asUser ?? null;
  session.cookies.clear();
  expect((await addToCart({ variantId: p.variants[0].id, quantity: o.qty ?? 1 })).ok).toBe(true);
  try {
    const r = await placeOrder({ email: o.email ?? "friend@test.local", phone: o.phone ?? "9811111111", address: { fullName: "Friend", phone: "9811111111", line1: "Ward 1", city: "Town", district: "Kathmandu", postalCode: "" }, shippingMethod: "standard", paymentMethod: "COD", couponCode: o.code });
    return { error: r?.error };
  } catch (e) {
    if (e instanceof RedirectError) return { orderId: e.url.split("/")[2].split("?")[0] };
    throw e;
  }
}
const deliver = async (id: string) => { for (const to of ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"] as const) await transitionOrder({ orderId: id, to, actor: "t" }); };
const points = async (id: string) => (await db.user.findUniqueOrThrow({ where: { id } })).points;

describe("refer a friend", () => {
  let p: P;
  let aarav: Awaited<ReturnType<typeof makeUser>>;
  let code: string;
  beforeEach(async () => {
    await resetDb();
    await db.deliveryRate.create({ data: { district: "Kathmandu", province: "Bagmati", zone: "VALLEY", fee: 10_000, etaMinDays: 1, etaMaxDays: 2 } });
    p = await makeProduct({ price: 1600, stock: { M: 20 } });
    aarav = await makeUser("CUSTOMER", { name: "Aarav Shrestha" });
    await db.user.update({ where: { id: aarav.id }, data: { phone: "9841234567" } });
    code = await ensureReferralCode(aarav.id);
  });

  it("codes are stable, readable and unique", async () => {
    expect(code).toMatch(/^AARAV[A-HJ-NP-Z2-9]{4}$/);
    expect(await ensureReferralCode(aarav.id)).toBe(code);
    const sita = await makeUser("CUSTOMER", { name: "Aarav Karki" });
    expect(await ensureReferralCode(sita.id)).not.toBe(code);
  });

  it("a friend's first order gets Rs 200 off; the referrer is rewarded once on delivery, and it's taken back on return", async () => {
    session.user = null; session.cookies.clear();
    await addToCart({ variantId: p.variants[0].id });
    expect(await quoteCheckout({ couponCode: code.toLowerCase(), shippingMethod: "standard", district: "Kathmandu" })).toMatchObject({ ok: true, totals: { discount: 20_000 }, coupon: { code } });

    const first = await buy(p, { code });
    expect(first.orderId).toBeTruthy();
    const o = await db.order.findUniqueOrThrow({ where: { id: first.orderId } });
    expect(o).toMatchObject({ discount: 20_000, couponCode: code, referrerId: aarav.id, total: 160_000 - 20_000 + 10_000 });

    const before = await points(aarav.id);
    await deliver(first.orderId!);
    expect(await points(aarav.id)).toBe(before + 200);
    expect(await db.notification.findFirstOrThrow({ where: { template: "referral_reward" } })).toMatchObject({ to: "9841234567" });
    await transitionOrder({ orderId: first.orderId!, to: "RETURN_REQUESTED", actor: "t" });
    await transitionOrder({ orderId: first.orderId!, to: "RETURNED", actor: "t" });
    expect(await points(aarav.id)).toBe(before);
    expect(await db.pointsEntry.count({ where: { reason: "REFERRAL_REVERSE" } })).toBe(1);
  });

  it("refuses own code, second orders and small bags", async () => {
    expect(await buy(p, { code, asUser: aarav })).toMatchObject({ error: expect.stringMatching(/your own referral code/) });
    expect(await buy(p, { code, email: aarav.email })).toMatchObject({ error: expect.stringMatching(/your own/) }); // same person as a guest
    expect(await buy(p, { code, phone: "9841234567" })).toMatchObject({ error: expect.stringMatching(/your own/) });
    const cheap = await makeProduct({ price: 900 });
    expect(await buy(cheap, { code })).toMatchObject({ error: expect.stringMatching(/Add Rs\. 600 more/) });
    expect((await buy(p, {})).orderId).toBeTruthy(); // friend's first order, no code
    expect(await buy(p, { code })).toMatchObject({ error: expect.stringMatching(/first order/) }); // second order
    expect(await db.order.count({ where: { referrerId: { not: null } } })).toBe(0);
  });

  it("caps rewards per referrer per 30 days", async () => {
    for (let i = 0; i < 10; i++) await db.pointsEntry.create({ data: { userId: aarav.id, delta: 200, reason: "REFERRAL" } });
    const r = await buy(p, { code });
    const before = await points(aarav.id);
    await deliver(r.orderId!);
    expect(await points(aarav.id)).toBe(before); // over the cap: the friend still saved, no more points
    expect((await db.order.findUniqueOrThrow({ where: { id: r.orderId } })).referralRewardedAt).not.toBeNull();
  });
});

describe("birthdays", () => {
  beforeEach(resetDb);

  async function customer(name: string, birthday: string, delivered: boolean) {
    const u = await makeUser("CUSTOMER", { name });
    await db.user.update({ where: { id: u.id }, data: { birthday, phone: "9800000001" } });
    if (delivered) await db.order.create({ data: { userId: u.id, email: u.email, phone: "9800000001", status: "DELIVERED", paymentMethod: "COD", subtotal: 1, total: 1, shippingMethod: "standard", shippingAddress: {} } });
    return u;
  }

  it("adds points and an SMS on the day, once a year, only for real customers; 29 Feb is celebrated on 28 Feb", async () => {
    const maya = await customer("Maya Gurung", "03-15", true);
    const fresh = await customer("New Account", "03-15", false);
    const leap = await customer("Leap Baby", "02-29", true);
    expect(await birthdayRun(new Date("2027-03-15T06:00:00Z"))).toEqual({ day: "2027-03-15", rewarded: 1 });
    expect(await birthdayRun(new Date("2027-03-15T10:00:00Z"))).toMatchObject({ rewarded: 0 }); // not twice
    expect(await points(maya.id)).toBe(200);
    expect(await points(fresh.id)).toBe(0);
    expect((await db.notification.findFirstOrThrow({ where: { template: "birthday" } })).body).toMatch(/^Happy birthday, Maya!/);
    expect(await birthdayRun(new Date("2027-02-28T06:00:00Z"))).toMatchObject({ rewarded: 1 });
    expect(await points(leap.id)).toBe(200);
    expect(await birthdayRun(new Date("2028-03-15T06:00:00Z"))).toMatchObject({ rewarded: 1 }); // next year again
  });

  it("only real calendar days can be saved", async () => {
    actAs(await makeUser("CUSTOMER"));
    expect(await updateProfile({ name: "Maya", phone: "", birthday: "02-30" })).toMatchObject({ ok: false });
    expect(await updateProfile({ name: "Maya", phone: "", birthday: "13-01" })).toMatchObject({ ok: false });
    expect(await updateProfile({ name: "Maya", phone: "", birthday: "02-29" })).toEqual({ ok: true });
    await expect(db.user.updateMany({ data: { birthday: "1990-02-29" } })).rejects.toThrow(/User_birthday_format/);
  });
});
