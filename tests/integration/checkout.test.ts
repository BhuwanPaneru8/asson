import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { addToCart } from "@/actions/cart";
import { placeOrder } from "@/actions/checkout";
import { session, RedirectError } from "../support/next-mocks";
import { makeProduct, resetDb } from "../support/db";
import { sendMetaPurchase } from "@/lib/marketing";

const address = (district: string) => ({ fullName: "Sita Rai", phone: "9841234567", line1: "Ward 4, House 12", city: "Town", district, postalCode: "" });
const order = (district: string, extra: Partial<Parameters<typeof placeOrder>[0]> = {}) =>
  placeOrder({ email: "sita@test.local", phone: "9841234567", address: address(district), shippingMethod: "standard", paymentMethod: "COD", ...extra });

async function newGuest() { session.user = null; session.cookies.clear(); }
async function placed(district: string, extra = {}) {
  try { const r = await order(district, extra); return { error: r?.error }; }
  catch (e) { if (e instanceof RedirectError) return { url: e.url }; throw e; }
}

describe("online checkout (guest, COD)", () => {
  beforeEach(resetDb);

  it("charges the district's delivery fee from the rate table and snapshots the address", async () => {
    const p = await makeProduct({ price: 1499, cost: 700, stock: { M: 5 } });
    await db.deliveryRate.create({ data: { district: "Chitwan", province: "Bagmati", zone: "OUTSIDE", fee: 12_000, etaMinDays: 3, etaMaxDays: 5 } });
    await newGuest();
    expect((await addToCart({ variantId: p.variants[0].id })).ok).toBe(true);
    const r = await placed("Chitwan");
    expect(r.url).toMatch(/^\/orders\/.+\?placed=1$/);
    const o = await db.order.findFirstOrThrow({ include: { items: true } });
    expect(o).toMatchObject({ subtotal: 149_900, shippingFee: 12_000, total: 161_900, paymentMethod: "COD", status: "PENDING" });
    expect(o.shippingAddress).toMatchObject({ district: "Chitwan", state: "Bagmati", zone: "OUTSIDE" });
    expect(o.items[0].unitCost).toBe(70_000);
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(4);
    expect(await db.cartItem.count()).toBe(0);
  });

  it("delivers free at Rs 2,500+ and blocks express outside the express districts", async () => {
    const p = await makeProduct({ price: 2600, stock: { M: 5 } });
    await newGuest();
    await addToCart({ variantId: p.variants[0].id });
    expect((await placed("Kaski", { shippingMethod: "express" })).error).toMatch(/Express/);
    expect((await placed("Kaski")).url).toBeTruthy();
    expect((await db.order.findFirstOrThrow()).shippingFee).toBe(0);
  });

  it("refuses districts marked not serviceable and COD where it's off", async () => {
    const p = await makeProduct({ stock: { M: 5 } });
    await db.deliveryRate.create({ data: { district: "Humla", province: "Karnali", zone: "REMOTE", fee: 25_000, etaMinDays: 5, etaMaxDays: 10, serviceable: false } });
    await db.deliveryRate.create({ data: { district: "Dolpa", province: "Karnali", zone: "REMOTE", fee: 25_000, etaMinDays: 5, etaMaxDays: 10, codAvailable: false } });
    await newGuest();
    await addToCart({ variantId: p.variants[0].id });
    expect((await placed("Humla")).error).toMatch(/don't deliver/);
    expect((await placed("Dolpa")).error).toMatch(/Cash on delivery isn't available/);
  });

  it("keeps online payments off while the integration is on hold", async () => {
    const p = await makeProduct({ stock: { M: 5 } });
    await newGuest();
    await addToCart({ variantId: p.variants[0].id });
    expect((await placed("Kathmandu", { paymentMethod: "ONLINE" })).error).toMatch(/Online payment isn't available/);
  });

  it("two shoppers racing for the last unit: exactly one order succeeds", async () => {
    const p = await makeProduct({ stock: { M: 1 } });
    // build two separate guest carts
    const carts: Map<string, string>[] = [];
    for (let i = 0; i < 2; i++) { await newGuest(); await addToCart({ variantId: p.variants[0].id }); carts.push(new Map(session.cookies)); }
    const attempt = async (c: Map<string, string>) => { session.cookies = new Map(c); return placed("Kathmandu"); };
    const results = [await attempt(carts[0]), await attempt(carts[1])];
    expect(results.filter((r) => r.url)).toHaveLength(1);
    expect(results.find((r) => r.error)?.error).toMatch(/sold out|only 0 left/);
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(0);
  });

  it("coupon usage limits hold", async () => {
    const p = await makeProduct({ price: 1000, stock: { M: 5 } });
    await db.coupon.create({ data: { code: "ONCE", type: "FIXED", value: 10_000, usageLimit: 1 } });
    await newGuest(); await addToCart({ variantId: p.variants[0].id });
    expect((await placed("Kathmandu", { couponCode: "ONCE" })).url).toBeTruthy();
    await newGuest(); await addToCart({ variantId: p.variants[0].id });
    expect((await placed("Kathmandu", { couponCode: "ONCE" })).error).toMatch(/usage limit/);
  });
});

describe("Meta purchase report (Conversions API)", () => {
  beforeEach(resetDb);
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const metaOn = () => { vi.stubEnv("META_PIXEL_ID", "1234567890123456"); vi.stubEnv("META_CAPI_TOKEN", "test-token"); };

  async function buy(consent?: string) {
    const p = await makeProduct({ price: 1599, stock: { M: 5 } });
    await newGuest();
    if (consent) session.cookies.set("asson_consent", consent);
    session.cookies.set("_fbp", "fb.1.1700000000.42");
    await addToCart({ variantId: p.variants[0].id });
    expect((await placed("Kathmandu")).url).toBeTruthy();
    return db.order.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  }
  const queued = () => db.job.findMany({ where: { type: "ads.purchase" } });

  it("is queued with the order only for shoppers who chose Accept all, and only when Meta is set up", async () => {
    metaOn();
    const o = await buy("all");
    const jobs = await queued();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ key: `ads.purchase:${o.id}`, payload: expect.objectContaining({ orderId: o.id, fbp: "fb.1.1700000000.42" }) });

    await buy("essential");
    await buy(); // never answered the banner
    expect(await queued()).toHaveLength(1);

    vi.stubEnv("META_CAPI_TOKEN", ""); // pixel only, no server token
    await buy("all");
    expect(await queued()).toHaveLength(1);
  });

  it("posts the hashed purchase to Meta and fails loudly (to retry) when Meta refuses", async () => {
    metaOn();
    const o = await buy("all");
    const fetchMock = vi.fn(async () => new Response("{\"events_received\":1}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMetaPurchase({ orderId: o.id, ip: "27.34.1.2", userAgent: "UA", fbp: "fb.1.1.2" })).toEqual({ sent: o.id });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/1234567890123456/events?access_token=test-token");
    const body = JSON.parse(String(init.body));
    expect(body.data[0]).toMatchObject({ event_name: "Purchase", event_id: o.id, custom_data: { value: o.total / 100, currency: "NPR" } });
    expect(body.data[0].user_data.ph).toHaveLength(1);
    expect(String(init.body)).not.toContain("9841234567");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad token", { status: 400 })));
    await expect(sendMetaPurchase({ orderId: o.id })).rejects.toThrow(/Meta Conversions API 400/);

    vi.stubEnv("META_CAPI_TOKEN", "");
    expect(await sendMetaPurchase({ orderId: o.id })).toEqual({ skipped: "Meta Conversions API is not set up" });
  });
});
