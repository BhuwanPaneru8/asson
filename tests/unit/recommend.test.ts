import { describe, expect, it } from "vitest";
import { bagAddOns, boughtTogether, personalPicks, similarItems, similarity, type Item } from "@/lib/recommend-core";

describe("bought together (association rules)", () => {
  it("links products bought in the same orders, strongest first, and ignores one-off coincidences", () => {
    const baskets = [
      ["shirt", "chinos"], ["shirt", "chinos"], ["shirt", "chinos"], ["shirt", "chinos", "belt"], ["shirt", "belt"], ["shirt", "belt"],
      ["shirt", "socks"], // once: below the minimum support
      ["jeans"], ["jeans"], ["tee"], ["tee", "jeans"],
    ];
    const r = boughtTogether(baskets);
    expect(r.get("shirt")!.map((l) => l.otherId)).toEqual(["chinos", "belt"]);
    expect(r.get("shirt")!.find((l) => l.otherId === "socks")).toBeUndefined();
    expect(r.get("chinos")![0]).toMatchObject({ otherId: "shirt", support: 4 });
    expect(r.has("tee")).toBe(false); // bought together once only
  });

  it("prefers a specific partner over one that's in every basket anyway (lift)", () => {
    // bags go with everything; the tie only with the shirt
    const baskets = [...Array(10)].map((_, i) => (i < 3 ? ["shirt", "tie", "bag"] : i < 6 ? ["shirt", "bag"] : ["jeans", "bag"]));
    const links = boughtTogether(baskets).get("tie")!;
    expect(links[0].otherId).toBe("shirt");
  });
});

const item = (id: string, o: Partial<Item> = {}): Item => ({ id, categoryId: "shirts", parentId: "men", gender: "MEN", tags: ["cotton"], price: 2_500_00, colors: ["Blue"], ...o });

describe("similar products", () => {
  it("scores what a product is: category, audience, tags, price, colour", () => {
    const a = item("a");
    expect(similarity(a, item("b"))).toBe(1); // the same in every way
    expect(similarity(a, item("c", { categoryId: "trousers" }))).toBeLessThan(similarity(a, item("d")));
    expect(similarity(a, item("e", { price: 10_000_00 }))).toBeLessThan(similarity(a, item("f", { price: 3_000_00 })));
    expect(similarity(a, a)).toBe(0);
  });

  it("never mixes men's and women's (unisex goes with both)", () => {
    const m = similarItems([item("m1"), item("w1", { gender: "WOMEN" }), item("u1", { gender: "UNISEX" }), item("m2")]);
    expect(m.get("m1")!.map((l) => l.otherId)).toEqual(["m2", "u1"]);
    expect(m.get("w1")!.map((l) => l.otherId)).toEqual(["u1"]);
  });
});

describe("personal picks", () => {
  const n: Record<string, { otherId: string; score: number }[]> = {
    shirt: [{ otherId: "chinos", score: 0.9 }, { otherId: "belt", score: 0.5 }, { otherId: "shirt2", score: 0.4 }],
    jeans: [{ otherId: "tee", score: 0.8 }, { otherId: "belt", score: 0.6 }],
  };
  const nb = (id: string) => (n[id] ?? []).map((x) => ({ productId: id, support: 0, ...x }));
  const cat = (id: string) => ({ chinos: "trousers", belt: "acc", shirt2: "shirts", tee: "tops" })[id];

  it("adds up neighbours of what you bought and viewed, newest counting most, never what you already have", () => {
    const picks = personalPicks([{ productId: "jeans", weight: 1 }, { productId: "shirt", weight: 1 }], nb, { exclude: new Set(["shirt", "jeans", "chinos"]), categoryOf: cat });
    expect(picks).toEqual(["belt", "tee", "shirt2"]); // belt is next to both; chinos already bought
  });

  it("keeps the row varied", () => {
    const picks = personalPicks([{ productId: "shirt", weight: 1 }], () => ["a", "b", "c", "d"].map((otherId, i) => ({ productId: "shirt", otherId, score: 1 - i / 10, support: 0 })), { exclude: new Set(), categoryOf: () => "same", maxPerCategory: 2 });
    expect(picks).toEqual(["a", "b"]);
  });
});

describe("bag add-ons", () => {
  const c = [{ id: "socks", price: 300_00, score: 0.9 }, { id: "belt", price: 900_00, score: 0.6 }, { id: "tee", price: 1_200_00, score: 0.5 }, { id: "jacket", price: 6_000_00, score: 0.8 }];
  it("short of free delivery: what closes the gap first, not wildly beyond it", () => {
    expect(bagAddOns(c, 800_00)).toEqual({ closesGap: ["belt", "tee"], others: ["socks", "jacket"] });
  });
  it("already free: best matches", () => {
    expect(bagAddOns(c, 0, { limit: 2 })).toEqual({ closesGap: [], others: ["socks", "jacket"] });
  });
});
