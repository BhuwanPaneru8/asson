// Recommendation maths, pure so every rule is unit-tested (tests/unit/recommend.test.ts). Nothing here talks to
// the database; lib/recommend.ts feeds it and stores what it finds.
//
// Two kinds of link between products:
//   BOUGHT_WITH: association rules from real orders. For "A → B":
//       support    = orders containing both
//       confidence = support / orders containing A          (how often A's buyers also take B)
//       lift       = confidence / share of all orders with B (how much more than chance)
//     Score = smoothed confidence × log2(1 + lift). The +SMOOTH in the denominator keeps a single coincidental
//     order from looking like a strong rule; a pair needs MIN_SUPPORT orders before it counts at all.
//   SIMILAR: what a product is: same category (and parent), audience, shared tags (Jaccard), similar price
//     (log ratio), shared colours. Used for "you may also like", and where there are no orders yet.

export const MIN_SUPPORT = 2;
const SMOOTH = 5;

export type Link = { productId: string; otherId: string; score: number; support: number };

/** Association rules from baskets of product ids (one basket per order). Returns, per product, its best partners. */
export function boughtTogether(baskets: string[][], perProduct = 12): Map<string, Link[]> {
  const count = new Map<string, number>();
  const pair = new Map<string, number>();
  let n = 0;
  for (const raw of baskets) {
    const b = [...new Set(raw)];
    if (!b.length) continue;
    n++;
    for (const a of b) count.set(a, (count.get(a) ?? 0) + 1);
    if (b.length < 2 || b.length > 30) continue; // a huge wholesale order says little about taste
    for (let i = 0; i < b.length; i++) for (let j = 0; j < b.length; j++) if (i !== j) {
      const k = `${b[i]}|${b[j]}`;
      pair.set(k, (pair.get(k) ?? 0) + 1);
    }
  }
  const out = new Map<string, Link[]>();
  for (const [k, support] of pair) {
    if (support < MIN_SUPPORT) continue;
    const [a, b] = k.split("|");
    const ca = count.get(a)!, cb = count.get(b)!;
    const confidence = support / (ca + SMOOTH);
    const lift = (support / ca) / (cb / n);
    const score = confidence * Math.log2(1 + lift);
    const list = out.get(a) ?? [];
    list.push({ productId: a, otherId: b, score, support });
    out.set(a, list);
  }
  for (const [a, list] of out) out.set(a, list.sort((x, y) => y.score - x.score || x.otherId.localeCompare(y.otherId)).slice(0, perProduct));
  return out;
}

export type Item = { id: string; categoryId: string; parentId: string | null; gender: string; tags: string[]; price: number; colors: string[] };

/** 0–1: how alike two products are, from what they are. */
export function similarity(a: Item, b: Item) {
  if (a.id === b.id) return 0;
  let s = 0;
  if (a.categoryId === b.categoryId) s += 0.4;
  else if (a.parentId && a.parentId === b.parentId) s += 0.15;
  if (a.gender === b.gender) s += 0.15;
  else if (a.gender === "UNISEX" || b.gender === "UNISEX") s += 0.08;
  const ta = new Set(a.tags.map((t) => t.toLowerCase())), tb = new Set(b.tags.map((t) => t.toLowerCase()));
  const inter = [...ta].filter((t) => tb.has(t)).length, union = new Set([...ta, ...tb]).size;
  if (union) s += 0.2 * (inter / union);
  if (a.price > 0 && b.price > 0) s += 0.15 * Math.max(0, 1 - Math.abs(Math.log(a.price / b.price)) / Math.log(2)); // within 2× of each other
  if (a.colors.some((c) => b.colors.includes(c))) s += 0.1;
  return Math.round(s * 1000) / 1000;
}

/** Each product's most similar others (same audience or unisex only: a man's shirt never suggests a dress). */
export function similarItems(items: Item[], perProduct = 12): Map<string, Link[]> {
  const out = new Map<string, Link[]>();
  for (const a of items) {
    const list: Link[] = [];
    for (const b of items) {
      if (a.id === b.id) continue;
      if (a.gender !== b.gender && a.gender !== "UNISEX" && b.gender !== "UNISEX") continue;
      const score = similarity(a, b);
      if (score >= 0.3) list.push({ productId: a.id, otherId: b.id, score, support: 0 });
    }
    out.set(a.id, list.sort((x, y) => y.score - x.score || x.otherId.localeCompare(y.otherId)).slice(0, perProduct));
  }
  return out;
}

/**
 * Personal picks from what someone bought, saved and viewed (newest first, so recent interest counts more):
 * each item's neighbours are added with weight × the link's score, already-bought products are dropped, and
 * one category can take at most `maxPerCategory` places so the row stays varied.
 */
export function personalPicks(
  history: { productId: string; weight: number }[],
  neighbours: (id: string) => Link[],
  opts: { exclude: Set<string>; categoryOf: (id: string) => string | undefined; limit?: number; maxPerCategory?: number },
) {
  const score = new Map<string, number>();
  history.forEach((h, i) => {
    const recency = 1 / (1 + i * 0.25);
    for (const l of neighbours(h.productId)) {
      if (opts.exclude.has(l.otherId)) continue;
      score.set(l.otherId, (score.get(l.otherId) ?? 0) + h.weight * recency * l.score);
    }
  });
  const perCat = new Map<string, number>();
  const out: string[] = [];
  for (const [id] of [...score].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    const c = opts.categoryOf(id) ?? "?";
    if ((perCat.get(c) ?? 0) >= (opts.maxPerCategory ?? 3)) continue;
    perCat.set(c, (perCat.get(c) ?? 0) + 1);
    out.push(id);
    if (out.length >= (opts.limit ?? 8)) break;
  }
  return out;
}

/**
 * Bag add-ons. Short of free delivery: products that close the gap, cheapest-that-does first (spending a little
 * to save the fee is a good deal for the shopper), never more than `maxOver` beyond it. Otherwise: by score.
 */
export function bagAddOns(cands: { id: string; price: number; score: number }[], gap: number, opts: { limit?: number; maxOver?: number } = {}) {
  const limit = opts.limit ?? 4, maxOver = opts.maxOver ?? 150_000;
  if (gap > 0) {
    const closes = cands.filter((c) => c.price >= gap && c.price <= gap + maxOver).sort((a, b) => b.score - a.score || a.price - b.price);
    const rest = cands.filter((c) => !closes.includes(c)).sort((a, b) => b.score - a.score);
    return { closesGap: closes.slice(0, limit).map((c) => c.id), others: rest.slice(0, Math.max(0, limit - closes.length)).map((c) => c.id) };
  }
  return { closesGap: [], others: [...cands].sort((a, b) => b.score - a.score).slice(0, limit).map((c) => c.id) };
}
