import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { store } from "./config";
import { cardSelect, getLook, getRelated, toCard, type ProductCardData } from "./catalog";
import { bagAddOns, boughtTogether, personalPicks, similarItems, type Link } from "./recommend-core";

// Recommendations (the maths is in recommend-core.ts). A nightly job turns a year of orders (online and shop
// sales) and the catalogue into ProductLink rows; pages only read those rows. With few orders (a new shop) the
// owner's "Complete the look" pairs and similar products fill in, so nothing is ever empty.

const YEAR = 365 * 86_400_000;
const BAD = ["CANCELLED", "RETURNED"] as const;

/** Job: rebuild every product's BOUGHT_WITH and SIMILAR links. Idempotent (replaces the table in one go). */
export async function buildRecommendations(now = new Date()) {
  const [orders, products] = await Promise.all([
    db.order.findMany({ where: { createdAt: { gte: new Date(now.getTime() - YEAR) }, status: { notIn: [...BAD] } }, select: { items: { select: { productId: true } } } }),
    db.product.findMany({ where: { status: "ACTIVE" }, select: { id: true, categoryId: true, gender: true, tags: true, price: true, category: { select: { parentId: true } }, variants: { select: { color: true } } } }),
  ]);
  const live = new Set(products.map((p) => p.id));
  const bought = boughtTogether(orders.map((o) => o.items.map((i) => i.productId).filter((id) => live.has(id))));
  const similar = similarItems(products.map((p) => ({ id: p.id, categoryId: p.categoryId, parentId: p.category.parentId, gender: p.gender, tags: p.tags, price: p.price, colors: [...new Set(p.variants.map((v) => v.color))] })));
  const rows = [
    ...[...bought.values()].flat().map((l) => ({ ...l, kind: "BOUGHT_WITH" as const })),
    ...[...similar.values()].flat().map((l) => ({ ...l, kind: "SIMILAR" as const })),
  ].map((l) => ({ productId: l.productId, otherId: l.otherId, kind: l.kind, score: l.score, support: l.support, updatedAt: now }));
  await db.$transaction(async (tx) => {
    await tx.productLink.deleteMany({});
    for (let i = 0; i < rows.length; i += 5000) await tx.productLink.createMany({ data: rows.slice(i, i + 5000) });
  }, { timeout: 120_000 });
  return { orders: orders.length, products: products.length, boughtWith: rows.filter((r) => r.kind === "BOUGHT_WITH").length, similar: rows.filter((r) => r.kind === "SIMILAR").length };
}

const linksOf = (ids: string[], kind?: "BOUGHT_WITH" | "SIMILAR") =>
  db.productLink.findMany({ where: { productId: { in: ids }, ...(kind ? { kind } : {}) }, orderBy: { score: "desc" } });

/** Active, in-stock cards for these ids, in the given order. */
async function cards(ids: string[]): Promise<ProductCardData[]> {
  if (!ids.length) return [];
  const rows = await db.product.findMany({ where: { id: { in: ids }, status: "ACTIVE", variants: { some: { stock: { gt: 0 } } } }, select: cardSelect });
  const at = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => at.get(a.id)! - at.get(b.id)!).map(toCard);
}

/**
 * Product page, "Frequently bought together": what this product's buyers also took, from other categories
 * (two shirts are alternatives, not a pair). Falls back to the owner's "Complete the look".
 */
export const frequentlyBoughtTogether = unstable_cache(
  async (productId: string, limit = 4): Promise<ProductCardData[]> => {
    const me = await db.product.findUnique({ where: { id: productId }, select: { categoryId: true } });
    const links = await linksOf([productId], "BOUGHT_WITH");
    const others = links.length ? await db.product.findMany({ where: { id: { in: links.map((l) => l.otherId) } }, select: { id: true, categoryId: true } }) : [];
    const otherCat = new Set(others.filter((o) => o.categoryId !== me?.categoryId).map((o) => o.id));
    const fromOrders = await cards(links.filter((l) => otherCat.has(l.otherId)).map((l) => l.otherId).slice(0, limit));
    if (fromOrders.length >= 2) return fromOrders;
    const look = await getLook(productId);
    return [...new Map([...fromOrders, ...look].map((c) => [c.id, c])).values()].slice(0, limit);
  },
  ["fbt"],
  { tags: ["products", "recommendations"], revalidate: 3600 },
);

/** Product page, "You may also like": similar products, nudged by what was bought alongside. Falls back to
 * the category/audience list. */
export const alsoLike = unstable_cache(
  async (productId: string, categoryId: string, gender: Parameters<typeof getRelated>[2], limit = 8): Promise<ProductCardData[]> => {
    const links = await linksOf([productId]);
    const score = new Map<string, number>();
    const maxBought = Math.max(0.0001, ...links.filter((l) => l.kind === "BOUGHT_WITH").map((l) => l.score));
    for (const l of links) score.set(l.otherId, (score.get(l.otherId) ?? 0) + (l.kind === "SIMILAR" ? 0.6 * l.score : 0.4 * (l.score / maxBought)));
    const picked = await cards([...score].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, limit + 4));
    if (picked.length >= 4) return picked.slice(0, limit);
    const related = await getRelated(productId, categoryId, gender);
    return [...new Map([...picked, ...related].map((c) => [c.id, c])).values()].slice(0, limit);
  },
  ["also-like"],
  { tags: ["products", "recommendations"], revalidate: 3600 },
);

/**
 * "Recommended for you": from what this person bought (strongest), saved and recently viewed (on this device),
 * newest first. Already-bought products are left out; at most 3 per category so the row is varied.
 */
export async function recommendedFor(input: { userId?: string | null; recentIds?: string[] }, limit = 8): Promise<ProductCardData[]> {
  const [orders, wished] = input.userId ? await Promise.all([
    db.orderItem.findMany({ where: { order: { userId: input.userId, status: { notIn: [...BAD] } } }, orderBy: { order: { createdAt: "desc" } }, select: { productId: true }, take: 40 }),
    db.wishlistItem.findMany({ where: { userId: input.userId }, orderBy: { createdAt: "desc" }, select: { productId: true }, take: 20 }),
  ]) : [[], []];
  const history = [
    ...(input.recentIds ?? []).slice(0, 12).map((productId) => ({ productId, weight: 1 })),
    ...wished.map((w) => ({ productId: w.productId, weight: 2 })),
    ...orders.map((o) => ({ productId: o.productId, weight: 3 })),
  ];
  if (!history.length) return [];
  const ids = [...new Set(history.map((h) => h.productId))];
  const links = await linksOf(ids);
  const by = new Map<string, Link[]>();
  for (const l of links) by.set(l.productId, [...(by.get(l.productId) ?? []), l]);
  const candidates = [...new Set(links.map((l) => l.otherId))];
  const meta = candidates.length ? await db.product.findMany({ where: { id: { in: candidates } }, select: { id: true, categoryId: true } }) : [];
  const catOf = new Map(meta.map((m) => [m.id, m.categoryId]));
  const owned = new Set(orders.map((o) => o.productId));
  const picks = personalPicks(history, (id) => by.get(id) ?? [], { exclude: new Set([...owned, ...(input.recentIds ?? []).slice(0, 2)]), categoryOf: (id) => catOf.get(id), limit: limit + 4 });
  return (await cards(picks)).slice(0, limit);
}

/**
 * Bag, "Complete your order": what goes with what's in the bag. Short of free delivery, the items that close the
 * gap come first (spending a little to save the fee is a good deal for the shopper).
 */
export async function bagSuggestions(lines: { productId: string; unitPrice: number; quantity: number }[], limit = 4) {
  if (!lines.length) return { gap: 0, closesGap: [] as ProductCardData[], others: [] as ProductCardData[] };
  const inBag = new Set(lines.map((l) => l.productId));
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const gap = Math.max(0, store.shipping.freeThreshold - subtotal);
  const links = await linksOf([...inBag]);
  // the bag wants what goes WITH it, not more of the same: a similar product from a category already in the
  // bag (another tee next to a tee) is left out; one from another category (chinos with a tee) counts
  const cats = await db.product.findMany({ where: { id: { in: [...new Set([...inBag, ...links.map((l) => l.otherId)])] } }, select: { id: true, categoryId: true, gender: true } });
  const catOf = new Map(cats.map((c) => [c.id, c.categoryId]));
  const bagCats = new Set([...inBag].map((id) => catOf.get(id)));
  // stay with who the bag is for: a bag of men's shirts never suggests a women's jacket (unisex goes with any)
  const genderOf = new Map(cats.map((c) => [c.id, c.gender]));
  const bagGenders = new Set([...inBag].map((id) => genderOf.get(id)));
  const score = new Map<string, number>();
  for (const l of links) {
    if (inBag.has(l.otherId)) continue;
    const g = genderOf.get(l.otherId);
    if (g && g !== "UNISEX" && !bagGenders.has(g) && !bagGenders.has("UNISEX")) continue;
    if (l.kind === "SIMILAR" && bagCats.has(catOf.get(l.otherId))) continue; // an alternative, not a pairing
    const w = l.kind === "BOUGHT_WITH" ? 1 : 0.35;
    score.set(l.otherId, (score.get(l.otherId) ?? 0) + w * l.score);
  }
  // a new shop: the owner's "Complete the look" pairs of what's in the bag
  if (score.size < limit) for (const id of inBag) for (const c of await getLook(id)) if (!inBag.has(c.id)) score.set(c.id, (score.get(c.id) ?? 0) + 0.5);
  const list = await cards([...score].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 24));
  const picked = bagAddOns(list.map((c) => ({ id: c.id, price: c.price, score: score.get(c.id) ?? 0 })), gap, { limit });
  const byId = new Map(list.map((c) => [c.id, c]));
  return { gap, closesGap: picked.closesGap.map((id) => byId.get(id)!), others: picked.others.map((id) => byId.get(id)!) };
}
