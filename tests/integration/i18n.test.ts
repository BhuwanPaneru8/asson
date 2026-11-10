import { beforeEach, describe, expect, it } from "vitest";
import { addToCart } from "@/actions/cart";
import { placeOrder, quoteCheckout } from "@/actions/checkout";
import { trackOrder } from "@/actions/track";
import { setLocale } from "@/actions/locale";
import { getLocale } from "@/lib/i18n/server";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { session } from "../support/next-mocks";
import { makeProduct, resetDb } from "../support/db";

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
