import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { cardSelect, toCard, type ProductCardData } from "./catalog";

// Lookbook: editorial outfits made only of Asson's own products. A piece that is no longer on sale
// simply drops out of its look, so everything a shopper sees here can be bought. Cached with the
// catalogue (tag "products") and the looks themselves (tag "looks").

export type LookPiece = ProductCardData & { note: string | null };
export type LookSummary = { slug: string; title: string; subtitle: string | null; hero: string | null; pieces: number; total: number; inStock: boolean };

const lookInclude = {
  items: { orderBy: { position: "asc" as const }, include: { product: { select: { ...cardSelect, status: true } } } },
};

function pieces(items: { note: string | null; product: Parameters<typeof toCard>[0] & { status: string } }[]): LookPiece[] {
  return items.filter((i) => i.product.status === "ACTIVE").map((i) => ({ ...toCard(i.product), note: i.note }));
}

function summarise(l: { slug: string; title: string; subtitle: string | null; heroImage: string | null }, ps: LookPiece[]): LookSummary {
  return {
    slug: l.slug, title: l.title, subtitle: l.subtitle,
    hero: l.heroImage || ps[0]?.images[0]?.url || null,
    pieces: ps.length,
    total: ps.reduce((s, p) => s + p.price, 0),
    inStock: ps.length > 0 && ps.every((p) => p.inStock),
  };
}

/** Published looks with at least one piece on sale, in the owner's order. */
export const getLookbook = unstable_cache(
  async (take = 24): Promise<LookSummary[]> => {
    const looks = await db.look.findMany({ where: { published: true }, orderBy: [{ position: "asc" }, { createdAt: "desc" }], take, include: lookInclude });
    return looks.map((l) => summarise(l, pieces(l.items))).filter((l) => l.pieces > 0);
  },
  ["looks"],
  { tags: ["products", "looks"], revalidate: 300 },
);

export const getLookbookEntry = unstable_cache(
  async (slug: string) => {
    const l = await db.look.findFirst({ where: { slug, published: true }, include: lookInclude });
    if (!l) return null;
    const ps = pieces(l.items);
    if (!ps.length) return null;
    const others = await db.look.findMany({ where: { published: true, NOT: { id: l.id } }, orderBy: [{ position: "asc" }, { createdAt: "desc" }], take: 6, include: lookInclude });
    return {
      ...summarise(l, ps),
      story: l.story,
      pieces: ps,
      more: others.map((o) => summarise(o, pieces(o.items))).filter((o) => o.pieces > 0).slice(0, 3),
    };
  },
  ["look"],
  { tags: ["products", "looks"], revalidate: 300 },
);

/** Looks a product appears in (for "Seen in the lookbook" on its page). */
export const getLookbookForProduct = unstable_cache(
  async (productId: string) =>
    db.look.findMany({ where: { published: true, items: { some: { productId } } }, select: { slug: true, title: true }, orderBy: { position: "asc" }, take: 3 }),
  ["looks-for-product"],
  { tags: ["looks"], revalidate: 300 },
);
