import { describe, expect, it } from "vitest";
import { addRecent, correct, editDistance, rankCompletions, understand, type Vocab } from "@/lib/search-intent";

const vocab: Vocab = {
  words: new Set(["shirt", "oxford", "linen", "jeans", "slim", "hoodie", "kurta", "saree", "tshirt", "trousers", "chinos", "jacket", "dress", "polo", "sweater", "asson", "classic", "crew", "shorts"]),
  colors: ["Blue", "Sky Blue", "Blush", "Navy", "Black", "White", "Maroon", "Olive", "Light Wash"],
  sizes: ["XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "Free"],
};
const u = (q: string) => understand(q, vocab);

describe("search understanding", () => {
  it("measures typos like people make them", () => {
    expect(editDistance("shrt", "shirt")).toBe(1);
    expect(editDistance("hodie", "hoodie")).toBe(1);
    expect(editDistance("shirt", "sihrt")).toBe(1); // swapped letters count once
    expect(editDistance("jacket", "polo", 2)).toBe(3); // gives up past the limit
    expect(correct("shrt", vocab.words)).toBe("shirt");
    expect(correct("jens", vocab.words)).toBe("jeans");
    expect(correct("trowsers", vocab.words)).toBe("trousers");
    expect(correct("abc", vocab.words)).toBeNull(); // too short to guess
    expect(correct("bicycle", vocab.words)).toBeNull(); // nothing close: never invents
  });

  it("reads colours, misspelt or cut short, and corrects words against what we sell", () => {
    expect(u("blu shrt")).toMatchObject({ words: ["shirt"], colors: ["Blue", "Sky Blue"], corrected: true, display: "blue shirt" });
    expect(u("navy hodie")).toMatchObject({ words: ["hoodie"], colors: ["Navy"], corrected: true, display: "navy hoodie" });
    expect(u("maroo kurta")).toMatchObject({ words: ["kurta"], colors: ["Maroon"] });
    expect(u("blus top").colors).toEqual(["Blush"]); // "blus" is closest to blush
    expect(u("sky blu shirt")).toMatchObject({ colors: ["Sky Blue"] }); // "sky" settles it
    expect(u("blakc tshirt")).toMatchObject({ colors: ["Black"], words: ["tshirt"] });
    expect(u("linen shirt")).toMatchObject({ words: ["linen", "shirt"], colors: [], corrected: false, display: null }); // nothing to say
  });

  it("plurals and synonyms land on the word we use", () => {
    expect(u("shirts").words).toEqual(["shirt"]);
    expect(u("jeans").words).toEqual(["jeans"]); // never "jean"
    expect(u("tees").words).toEqual(["tshirt"]);
    expect(u("pants").words).toEqual(["trousers"]);
    expect(u("hoodies").words).toEqual(["hoodie"]);
  });

  it("understands prices in the ways people write them", () => {
    expect(u("shirt under 2000")).toMatchObject({ words: ["shirt"], maxPrice: 200_000, minPrice: null, display: "shirt, under Rs 2,000" });
    expect(u("jeans below rs 1.5k")).toMatchObject({ maxPrice: 150_000 });
    expect(u("kurta 1000-3000")).toMatchObject({ minPrice: 100_000, maxPrice: 300_000, words: ["kurta"] });
    expect(u("jacket between 2k and 5k")).toMatchObject({ minPrice: 200_000, maxPrice: 500_000 });
    expect(u("dress over 3,000")).toMatchObject({ minPrice: 300_000, maxPrice: null });
  });

  it("finds sizes and audiences, and drops filler words", () => {
    expect(u("mens jeans 32")).toMatchObject({ gender: "MEN", words: ["jeans"], sizes: ["32"] });
    expect(u("hoodie size xl")).toMatchObject({ words: ["hoodie"], sizes: ["XL"] });
    expect(u("polo size m")).toMatchObject({ words: ["polo"], sizes: ["M"] });
    expect(u("xxl shirt for men")).toMatchObject({ words: ["shirt"], sizes: ["XXL"], gender: "MEN" });
    expect(u("the best shirt").words).toEqual(["shirt"]);
    expect(u("men")).toMatchObject({ gender: null, words: ["men"] }); // a single word is a word, not a filter
  });

  it("keeps Nepali words as typed", () => {
    expect(u("कुर्ता").words).toEqual(["कुर्ता"]);
    expect(u("रातो कुर्ता").words).toEqual(["रातो", "कुर्ता"]);
  });
});

describe("type-ahead", () => {
  const cands = [
    { text: "Shirt", weight: 40 }, { text: "Linen shirt", weight: 90 }, { text: "Shirts for men", weight: 5 }, { text: "Oxford Button-Down Shirt", weight: 12 },
    { text: "Shorts", weight: 30 }, { text: "Shirt dress", weight: 2 }, { text: "linen shirt", weight: 1 }, { text: "Jeans", weight: 500 },
  ];
  const texts = (q: string, n?: number) => rankCompletions(q, cands, n).map((c) => c.text);

  it("puts what starts with the typed letters first, then later words, then scattered words; never the exact text", () => {
    expect(texts("shi")).toEqual(["shirt", "shirts for men", "shirt dress", "linen shirt", "oxford button-down shirt"]);
    expect(texts("sh", 3)).toEqual(["shirt", "shorts", "shirts for men"]); // popular first within the same tier
    expect(texts("lin shi")).toEqual(["linen shirt"]); // scattered word starts, de-duplicated
    expect(texts("shirt")).not.toContain("shirt");
    expect(texts("xyz")).toEqual([]);
    expect(texts("")).toEqual([]);
  });

  it("marks where the typed letters are, so the rest can be bold", () => {
    expect(rankCompletions("shi", cands)[0]).toEqual({ text: "shirt", match: [0, 3] });
    expect(rankCompletions("shi", cands).find((c) => c.text === "linen shirt")!.match).toEqual([6, 9]);
  });

  it("keeps recent searches newest first, without repeats, up to a limit", () => {
    expect(addRecent(["jeans", "kurta"], "Kurta")).toEqual(["Kurta", "jeans"]);
    expect(addRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
    expect(addRecent(["jeans"], "  linen   shirt ")).toEqual(["linen shirt", "jeans"]);
    expect(addRecent(["jeans"], "   ")).toEqual(["jeans"]);
  });
});
