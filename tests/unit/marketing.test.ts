import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cartAdds, ga4Event, metaEvent, parseConsent, parseIds, tiktokEvent, totalValue, type TrackEvent } from "@/lib/marketing-shared";
import { capiPurchase, normaliseEmail, normalisePhone } from "@/lib/marketing";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("ad measurement: settings and consent", () => {
  it("accepts only IDs in each platform's real format, so a typo can't put script on the page", () => {
    expect(parseIds({ meta: " 1234567890123456 ", tiktok: "CABC123XYZ456", ga4: "G-ABCD1234" })).toEqual({ meta: "1234567890123456", tiktok: "CABC123XYZ456", ga4: "G-ABCD1234" });
    expect(parseIds({ meta: "123'); alert(1);//", tiktok: "abc", ga4: "UA-1234-1" })).toEqual({ meta: null, tiktok: null, ga4: null });
    expect(parseIds({})).toEqual({ meta: null, tiktok: null, ga4: null });
  });

  it("knows only the two choices; anything else means we still have to ask", () => {
    expect(parseConsent("all")).toBe("all");
    expect(parseConsent("essential")).toBe("essential");
    for (const v of [undefined, null, "", "yes", "ALL"]) expect(parseConsent(v)).toBeNull();
  });
});

describe("ad measurement: events", () => {
  const line = (variantId: string, quantity: number, productId = "p1", unitPrice = 159900) => ({ variantId, productId, name: "Oxford shirt", unitPrice, quantity });

  it("finds what was added to the bag between two snapshots, in rupees, and ignores removals", () => {
    expect(cartAdds([], [line("v1", 1)])).toEqual([{ id: "p1", name: "Oxford shirt", price: 1599, quantity: 1 }]);
    expect(cartAdds([line("v1", 1)], [line("v1", 3)])).toEqual([{ id: "p1", name: "Oxford shirt", price: 1599, quantity: 2 }]);
    expect(cartAdds([line("v1", 2), line("v2", 1)], [line("v1", 1)])).toEqual([]); // fewer / removed
    expect(cartAdds([line("v1", 1)], [line("v1", 1), line("v2", 1, "p2", 249950)])).toEqual([{ id: "p2", name: "Oxford shirt", price: 2499.5, quantity: 1 }]);
    expect(totalValue([{ id: "a", name: "", price: 0.1, quantity: 3 }])).toBe(0.3); // no float dust
  });

  const items = [{ id: "p1", name: "Oxford shirt", price: 1599, quantity: 2 }, { id: "p2", name: "Chinos", price: 2499, quantity: 1 }];
  const purchase: TrackEvent = { name: "purchase", orderId: "ord_1", items, value: 5797 };

  it("speaks each platform's standard event names", () => {
    const view: TrackEvent = { name: "view_item", item: items[0] };
    expect(metaEvent(view)[0]).toBe("ViewContent");
    expect(metaEvent({ name: "add_to_cart", items })[0]).toBe("AddToCart");
    expect(metaEvent({ name: "begin_checkout", items, value: 5697 })).toEqual(["InitiateCheckout", expect.objectContaining({ value: 5697, num_items: 3, currency: "NPR" })]);
    expect(metaEvent(purchase)).toEqual(["Purchase", expect.objectContaining({ value: 5797, content_ids: ["p1", "p2"], contents: [{ id: "p1", quantity: 2 }, { id: "p2", quantity: 1 }] })]);
    expect(tiktokEvent(purchase)[0]).toBe("CompletePayment");
    expect(tiktokEvent({ name: "add_to_cart", items })[1]).toMatchObject({ value: 5697, currency: "NPR" });
    expect(ga4Event(purchase)).toEqual(["purchase", expect.objectContaining({ transaction_id: "ord_1", value: 5797, items: [expect.objectContaining({ item_id: "p1", quantity: 2 }), expect.objectContaining({ item_id: "p2" })] })]);
    expect(ga4Event(view)).toEqual(["view_item", expect.objectContaining({ value: 1599 })]);
  });
});

describe("Meta Conversions API (purchase sent from our server)", () => {
  it("normalises email and Nepali mobiles the way Meta matches them", () => {
    expect(normaliseEmail("  Sita.Rai@Mail.COM ")).toBe("sita.rai@mail.com");
    expect(normaliseEmail("not-an-email")).toBeNull();
    expect(normalisePhone("984-123-4567")).toBe("9779841234567");
    expect(normalisePhone("+977 9841234567")).toBe("9779841234567");
    expect(normalisePhone("01-4412345")).toBeNull(); // landline: not sent
  });

  const order = {
    id: "ord_1", email: "Sita@Mail.com", phone: "9841234567", userId: "user_1", total: 579700, createdAt: new Date("2026-11-13T08:00:00Z"),
    items: [{ productId: "p1", quantity: 2, unitPrice: 159900 }, { productId: null, quantity: 1, unitPrice: 100 }],
  };

  it("sends hashed contact details only, the same event id as the pixel, and rupees", () => {
    const body = capiPurchase(order, { ip: "27.34.1.2", userAgent: "Mozilla/5.0", fbp: "fb.1.1.2", fbc: null, url: "https://asson.example/checkout" });
    const e = body.data[0];
    expect(e).toMatchObject({ event_name: "Purchase", event_id: "ord_1", action_source: "website", event_time: 1794556800, event_source_url: "https://asson.example/checkout" });
    expect(e.user_data).toEqual({ em: [sha("sita@mail.com")], ph: [sha("9779841234567")], external_id: [sha("user_1")], client_ip_address: "27.34.1.2", client_user_agent: "Mozilla/5.0", fbp: "fb.1.1.2" });
    expect(JSON.stringify(body)).not.toContain("9841234567"); // never the raw phone or email
    expect(JSON.stringify(body).toLowerCase()).not.toContain("sita@mail.com");
    expect(e.custom_data).toEqual({ currency: "NPR", value: 5797, content_type: "product", content_ids: ["p1"], contents: [{ id: "p1", quantity: 2, item_price: 1599 }], order_id: "ord_1" });
    expect(body).not.toHaveProperty("test_event_code");
    expect(capiPurchase({ ...order, email: null, phone: null, userId: null }, {}, "TEST123")).toMatchObject({ test_event_code: "TEST123", data: [{ user_data: {} }] });
  });
});
