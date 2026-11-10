import { beforeEach, describe, expect, it } from "vitest";
import { addToCart } from "@/actions/cart";
import { placeOrder, quoteCheckout } from "@/actions/checkout";
import { trackOrder } from "@/actions/track";
import { setLocale } from "@/actions/locale";
import { getLocale } from "@/lib/i18n/server";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { RedirectError, session } from "../support/next-mocks";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { getCategoryTree, searchProductIds } from "@/lib/catalog";
import { saveNepaliNames } from "@/actions/admin/nepali";
import { queueOrderNotice } from "@/lib/notifications";
import { login, register } from "@/actions/auth";

const order = (district: string, extra: Partial<Parameters<typeof placeOrder>[0]> = {}) =>
  placeOrder({ email: "sita@test.local", phone: "9841234567", address: { fullName: "Sita Rai", phone: "9841234567", line1: "Ward 4, House 12", city: "Town", district, postalCode: "" }, shippingMethod: "standard", paymentMethod: "COD", ...extra });

describe("Nepali storefront", () => {
  beforeEach(async () => { await resetDb(); session.user = null; session.cookies.clear(); });

  it("remembers the shopper's choice; anything else is ignored", async () => {
    expect(await getLocale()).toBe("en");
    await setLocale("ne");
    expect(session.cookies.get(LOCALE_COOKIE)).toBe("ne");
    expect(await getLocale()).toBe("ne");
    await setLocale("fr" as "ne");
    expect(await getLocale()).toBe("ne");
    await setLocale("en");
    expect(await getLocale()).toBe("en");
  });

  it("checkout errors, field errors and coupon messages reach a Nepali shopper in Nepali; English stays English", async () => {
    const p = await makeProduct({ stock: { M: 5 } });
    await addToCart({ variantId: p.variants[0].id });
    expect((await order("Kaski", { shippingMethod: "express" }))?.error).toMatch(/^Express delivery isn't available in Kaski/);

    session.cookies.set(LOCALE_COOKIE, "ne");
    expect((await order("Kaski", { shippingMethod: "express" }))?.error).toBe("Kaski मा एक्सप्रेस डेलिभरी उपलब्ध छैन। कृपया सामान्य डेलिभरी छान्नुहोस्।");
    const bad = await order("Kaski", { phone: "123" });
    expect(bad?.error).toBe("कृपया रातो देखाइएका ठाउँहरू जाँच्नुहोस्।");
    expect(bad?.fieldErrors?.phone).toBe("सही 10 अङ्कको मोबाइल नम्बर लेख्नुहोस् (98XXXXXXXX)");
    const q = await quoteCheckout({ couponCode: "NOPE", shippingMethod: "standard", district: "Kaski" });
    expect(!q.ok && q.error).toBe("यो कोड मान्य छैन।");
    expect(await addToCart({ variantId: "missing" })).toEqual({ ok: false, error: "यो सामान अब उपलब्ध छैन।" });
    const form = new FormData();
    expect((await trackOrder(undefined, form)).error).toBe("आफ्नो अर्डर नम्बर र इमेल लेख्नुहोस्।");
  });
});

describe("Nepali catalogue names, search, SMS and account messages", () => {
  beforeEach(async () => { await resetDb(); session.user = null; session.cookies.clear(); });

  it("finds products by their Nepali name; English search still works", async () => {
    const p = await makeProduct({ name: "Linen Shirt" });
    await db.product.update({ where: { id: p.id }, data: { nameNe: "लिनेन सर्ट", descriptionNe: "गर्मीका लागि हल्का कपडा" } });
    await makeProduct({ name: "Denim Jeans" });
    expect(await searchProductIds("सर्ट")).toEqual([p.id]);
    expect(await searchProductIds("हल्का")).toEqual([p.id]);
    expect(await searchProductIds("linen")).toEqual([p.id]);
    expect(await searchProductIds("जुत्ता")).toEqual([]);
  });

  it("the owner writes Nepali names for categories and collections; audited; others can't", async () => {
    const owner = await makeUser("ADMIN");
    actAs(owner);
    const cat = await db.category.create({ data: { name: "Shirts", slug: "shirts" } });
    expect(await saveNepaliNames({ kind: "category", id: cat.id, nameNe: "सर्ट", descriptionNe: "" })).toEqual({ ok: true });
    expect(await db.category.findUniqueOrThrow({ where: { id: cat.id } })).toMatchObject({ nameNe: "सर्ट", descriptionNe: null });
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "category.nepali" } })).summary).toMatch(/Shirts/);
    expect((await getCategoryTree()).find((c) => c.id === cat.id)?.nameNe).toBe("सर्ट");
    actAs(await makeUser("CASHIER"));
    await expect(saveNepaliNames({ kind: "category", id: cat.id, nameNe: "x", descriptionNe: "" })).rejects.toThrow();
  });

  it("remembers the order's language; SMS go out in Nepali only when the owner turns it on", async () => {
    const p = await makeProduct({ stock: { M: 5 } });
    session.cookies.set(LOCALE_COOKIE, "ne");
    await addToCart({ variantId: p.variants[0].id });
    try { await order("Kathmandu"); } catch (e) { if (!(e instanceof RedirectError)) throw e; }
    const o = await db.order.findFirstOrThrow();
    expect(o.locale).toBe("ne");
    expect((await db.notification.findFirstOrThrow({ where: { orderId: o.id } })).body).toMatch(/^Hi Sita, thanks for shopping with Asson/);
    const s = store as { smsInNepali: boolean };
    s.smsInNepali = true;
    try {
      await queueOrderNotice(db, o.id, "confirmed");
      expect((await db.notification.findFirstOrThrow({ where: { orderId: o.id, template: "confirmed" } })).body).toMatch(/^Asson: अर्डर AS\d+ पक्का भयो/);
    } finally { s.smsInNepali = false; }
  });

  it("sign-in and account messages in Nepali", async () => {
    session.cookies.set(LOCALE_COOKIE, "ne");
    const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
    expect((await login(undefined, fd({ email: "nobody@test.local", password: "x" })))?.error).toBe("त्यो इमेल र पासवर्ड हाम्रो रेकर्डसँग मिलेन।");
    const r = await register(undefined, fd({ name: "S", email: "bad", password: "short" }));
    expect(r?.fieldErrors).toMatchObject({ name: "कृपया आफ्नो नाम लेख्नुहोस्", email: "सही इमेल लेख्नुहोस्", password: "कम्तीमा 8 अक्षर प्रयोग गर्नुहोस्" });
  });
});
