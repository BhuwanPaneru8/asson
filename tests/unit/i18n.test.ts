import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { ne } from "@/lib/i18n/ne";
import { etaText, localise, makeT, translate, type MessageKey } from "@/lib/i18n";

const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("storefront languages", () => {
  it("every Nepali message keeps the same {placeholders} as its English source, and is really translated", () => {
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(holes(ne[key]), key).toEqual(holes(en[key]));
      expect(ne[key].trim(), key).not.toBe("");
    }
    // a Nepali dictionary that is mostly English would pass the type check; make sure it isn't
    const devanagari = (Object.keys(en) as MessageKey[]).filter((k) => /[ऀ-ॿ]/.test(ne[k]));
    expect(devanagari.length / Object.keys(en).length).toBeGreaterThan(0.95);
  });

  it("fills placeholders and leaves unknown ones for rich text", () => {
    expect(translate(en, "line.only", { n: 2 })).toBe("Only 2 left");
    expect(makeT("ne")("line.only", { n: 2 })).toBe("2 मात्र बाँकी");
    expect(makeT("en")("co.haveAccount")).toBe("Have an account? {link} for faster checkout.");
  });

  it("translates English messages from the server, values and all; anything unknown passes through", () => {
    expect(localise("ne", "Your bag is empty.")).toBe("तपाईंको झोला खाली छ।");
    expect(localise("ne", "Express delivery isn't available in Kaski. Please choose standard delivery.")).toBe("Kaski मा एक्सप्रेस डेलिभरी उपलब्ध छैन। कृपया सामान्य डेलिभरी छान्नुहोस्।");
    expect(localise("ne", "Linen Shirt (M) has only 2 left. Please update your bag.")).toBe("Linen Shirt (M) 2 मात्र बाँकी छ। कृपया झोला मिलाउनुहोस्।");
    expect(localise("ne", "Linen Shirt (M) is sold out. Please update your bag.")).toBe("Linen Shirt (M) सकियो। कृपया झोला मिलाउनुहोस्।");
    expect(localise("ne", "Add Rs. 500 more to use this code.")).toBe("यो कोड प्रयोग गर्न थप Rs. 500 को सामान थप्नुहोस्।");
    expect(localise("ne", "Inclusive of 13% VAT")).toBe("13% भ्याटसहित");
    expect(localise("ne", "Something the dictionary has never seen")).toBe("Something the dictionary has never seen");
    expect(localise("en", "Your bag is empty.")).toBe("Your bag is empty.");
  });

  it("delivery times in words", () => {
    const t = makeT("ne");
    expect(etaText(makeT("en"), { etaMinDays: 1, etaMaxDays: 1 })).toBe("1 day");
    expect(etaText(makeT("en"), { etaMinDays: 3, etaMaxDays: 5 })).toBe("3–5 days");
    expect(etaText(t, { etaMinDays: 3, etaMaxDays: 5 })).toBe("3–5 दिन");
  });
});
