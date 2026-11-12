import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { bagSuggestions, buildRecommendations, frequentlyBoughtTogether, recommendedFor } from "@/lib/recommend";
import { makeProduct, makeUser, resetDb } from "../support/db";

type P = Awaited<ReturnType<typeof makeProduct>>;
const DAY = 86_400_000;

async function order(products: P[], opts: { userId?: string; daysAgo?: number; status?: "DELIVERED" | "CANCELLED" } = {}) {
  const items = products.map((p) => ({ variantId: p.variants[0].id, productId: p.id, name: p.name, slug: p.slug, sku: p.variants[0].sku, color: "White", size: p.variants[0].size, image: "", unitPrice: p.price, quantity: 1 }));
  const subtotal = items.reduce((s, i) => s + i.unitPrice, 0);
  await db.order.create({ data: { email: "x@test.local", phone: "9841234567", userId: opts.userId, status: opts.status ?? "DELIVERED", paymentMethod: "COD", subtotal, total: subtotal, shippingMethod: "standard", shippingAddress: {}, createdAt: new Date(Date.now() - (opts.daysAgo ?? 1) * DAY), items: { create: items } } });
}
async function inCategory(p: P, slug: string) {
  const c = await db.category.upsert({ where: { slug }, update: {}, create: { name: slug, slug } });
  await db.product.update({ where: { id: p.id }, data: { categoryId: c.id } });
}

describe("recommendations", () => {
  let shirt: P, shirt2: P, chinos: P, belt: P, socks: P;
  beforeEach(async () => {
    await resetDb();
    shirt = await makeProduct({ name: "Oxford Shirt", price: 2400 });
    shirt2 = await makeProduct({ name: "Linen Shirt", price: 2600 });
    chinos = await makeProduct({ name: "Chinos", price: 2900 });
    belt = await makeProduct({ name: "Belt", price: 900 });
    socks = await makeProduct({ name: "Socks", price: 300 });
    await inCategory(chinos, "trousers");
    await inCategory(belt, "accessories");
    await inCategory(socks, "accessories");
    for (let i = 0; i < 3; i++) await order([shirt, chinos]);
    for (let i = 0; i < 2; i++) await order([shirt, belt]);
    await order([shirt, shirt2]);
    await order([shirt, socks], { status: "CANCELLED" }); // cancelled orders teach nothing
    await order([shirt, socks], { daysAgo: 400 }); // older than a year
  });

  it("the nightly build learns pairs from real orders (not cancelled, not older than a year) and similar products", async () => {
    const r = await buildRecommendations();
    expect(r).toMatchObject({ orders: 6, products: 5 }); // 8 placed: one cancelled, one too old
    const links = await db.productLink.findMany({ where: { productId: shirt.id, kind: "BOUGHT_WITH" }, orderBy: { score: "desc" } });
    expect(links.map((l) => l.otherId)).toEqual([chinos.id, belt.id]); // shirt2 once, socks never counted
    expect(await db.productLink.count({ where: { productId: shirt.id, otherId: shirt2.id, kind: "SIMILAR" } })).toBe(1);
    await buildRecommendations(); // running again replaces, never duplicates
    expect(await db.productLink.count({ where: { productId: shirt.id, kind: "BOUGHT_WITH" } })).toBe(2);
  });

  it("product page: bought together comes from other categories, best first", async () => {
    await buildRecommendations();
    expect((await frequentlyBoughtTogether(shirt.id)).map((c) => c.name)).toEqual(["Chinos", "Belt"]);
  });

  it("for you: neighbours of what you bought and viewed, never what you already own", async () => {
    await buildRecommendations();
    const me = await makeUser("CUSTOMER");
    await order([chinos], { userId: me.id });
    const picks = (await recommendedFor({ userId: me.id, recentIds: [] })).map((c) => c.name);
    expect(picks[0]).toBe("Oxford Shirt"); // chinos buyers take the shirt
    expect(picks).not.toContain("Chinos");
    expect(await recommendedFor({ userId: null, recentIds: [] })).toEqual([]); // no history, no guesses
  });

  it("bag: says what's left for free delivery and leads with what goes with the bag and closes the gap", async () => {
    await buildRecommendations();
    const s = await bagSuggestions([{ productId: shirt.id, unitPrice: shirt.price, quantity: 1 }]);
    expect(s.gap).toBe(2_500_00 - 2_400_00);
    expect(s.closesGap.map((c) => c.name)).toEqual(["Belt"]); // closes the Rs 100 gap without a big jump
    expect(s.others.map((c) => c.name)).toContain("Chinos"); // still suggested, just not as the gap filler
    expect([...s.closesGap, ...s.others].map((c) => c.name)).not.toContain("Linen Shirt"); // another shirt isn't a pairing
  });
});
