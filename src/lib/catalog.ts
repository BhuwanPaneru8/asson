import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma, type Gender } from "@prisma/client";
import { db } from "./db";
import { sortSizes } from "./config";
import { rankCompletions, understand, SYNONYMS, type Candidate, type Understood } from "./search-intent";

export const PAGE_SIZE = 24;

export const SORTS = [
  { id: "featured", label: "Featured" },
  { id: "new", label: "Newest" },
  { id: "best", label: "Best selling" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "rating", label: "Top rated" },
] as const;
export type SortId = (typeof SORTS)[number]["id"] | "relevance";

export type ProductFilters = {
  q?: string;
  category?: string;
  collection?: string;
  gender?: Gender;
  sizes?: string[];
  colors?: string[];
  brands?: string[];
  minPrice?: number; // paisa
  maxPrice?: number;
  sale?: boolean;
  inStock?: boolean;
  sort?: SortId;
  page?: number;
};

// ---------- Category tree ----------

export type CategoryNode = { id: string; name: string; nameNe: string | null; descriptionNe: string | null; slug: string; image: string | null; description: string | null; parentId: string | null; children: CategoryNode[] };

export const getCategoryTree = unstable_cache(
  async (): Promise<CategoryNode[]> => {
    const all = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    const byId = new Map<string, CategoryNode>(all.map((c) => [c.id, { ...c, children: [] }]));
    const roots: CategoryNode[] = [];
    for (const c of byId.values()) {
      if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId)!.children.push(c);
      else roots.push(c);
    }
    return roots;
  },
  ["category-tree"],
  { tags: ["catalog"], revalidate: 3600 },
);

export async function getCategoryBySlug(slug: string) {
  const tree = await getCategoryTree();
  const flat = tree.flatMap((r) => [r, ...r.children.flatMap((c) => [c, ...c.children])]);
  const node = flat.find((c) => c.slug === slug);
  if (!node) return null;
  const parent = node.parentId ? flat.find((c) => c.id === node.parentId) ?? null : null;
  const ids = [node.id, ...node.children.flatMap((c) => [c.id, ...c.children.map((g) => g.id)])];
  return { node, parent, ids };
}

// ---------- Search ----------

/** Part of every search cache key: bump it when ranking, understanding or suggestions change. */
export const SEARCH_VERSION = "2";

const getColorNames = unstable_cache(
  async () => (await db.variant.findMany({ distinct: ["color"], select: { color: true } })).map((v) => v.color),
  ["color-names"],
  { tags: ["products"], revalidate: 3600 },
);

/** Every word a search may be corrected to: what we sell (names, brands, tags) and how it's grouped. */
const getSearchVocab = unstable_cache(
  async () => {
    const [products, categories, colors, sizes] = await Promise.all([
      db.product.findMany({ where: { status: "ACTIVE" }, select: { name: true, brand: true, tags: true } }),
      db.category.findMany({ select: { name: true } }),
      getColorNames(),
      db.variant.findMany({ distinct: ["size"], select: { size: true } }),
    ]);
    const words = new Set<string>();
    const add = (t: string) => t.toLowerCase().normalize("NFKD").replace(/-/g, "").split(/[^a-z0-9]+/).forEach((w) => { if (w.length > 1 && !/^\d+$/.test(w)) words.add(w); });
    for (const p of products) { add(p.name); add(p.brand); p.tags.forEach(add); }
    categories.forEach((c) => add(c.name));
    Object.values(SYNONYMS).forEach((w) => words.add(w));
    return { words: [...words], colors, sizes: sizes.map((v) => v.size) };
  },
  ["search-vocab"],
  { tags: ["products"], revalidate: 3600 },
);

/** What a search means (see lib/search-intent.ts), for the results page and the suggestions box. */
export async function understandSearch(q: string) {
  const v = await getSearchVocab();
  return understand(q, { words: new Set(v.words), colors: v.colors, sizes: v.sizes });
}

/**
 * Ranked product ids for a free-text query, read by `understand` (colours, audience, sizes, prices, corrected
 * words). Every word must match by prefix full-text or fuzzily against the name; when nothing matches every
 * word, products matching any of them are returned instead (`relaxed`), so a search never ends empty-handed
 * when part of it made sense.
 */
export const searchProducts = unstable_cache(
  async (q: string, limit = 500): Promise<{ ids: string[]; understood: Understood; relaxed: boolean }> => {
    const understood = await understandSearch(q);
    const { words, colors, sizes, gender, minPrice, maxPrice } = understood;
    const latin = words.filter((w) => !/[\u0900-\u097F]/.test(w));
    const deva = words.filter((w) => /[\u0900-\u097F]/.test(w) && w.length > 1);
    if (!words.length && !colors.length && !sizes.length && !gender && minPrice == null && maxPrice == null) return { ids: [], understood, relaxed: false };

    const doc = Prisma.sql`product_search_doc(p."name", p."brand", p."tags", p."description")`;
    const filters: Prisma.Sql[] = [Prisma.sql`p.status = 'ACTIVE'`];
    if (colors.length) filters.push(Prisma.sql`EXISTS (SELECT 1 FROM "Variant" v WHERE v."productId" = p.id AND v.color IN (${Prisma.join(colors)}))`);
    if (sizes.length) filters.push(Prisma.sql`EXISTS (SELECT 1 FROM "Variant" v WHERE v."productId" = p.id AND v.size IN (${Prisma.join(sizes)}) AND v.stock > 0)`);
    if (gender) filters.push(Prisma.sql`p.gender::text IN (${Prisma.join(gender === "KIDS" ? ["KIDS"] : [gender, "UNISEX"])})`);
    if (minPrice != null) filters.push(Prisma.sql`p.price >= ${minPrice}`);
    if (maxPrice != null) filters.push(Prisma.sql`p.price <= ${maxPrice}`);
    // a word matches by prefix full-text, or fuzzily against the name (handles what spelling correction can't)
    const wordConds = [
      ...latin.map((w) => Prisma.sql`(${doc} @@ to_tsquery('simple', ${w + ":*"}) OR ${w} <% p."name")`),
      ...deva.map((w) => Prisma.sql`(p."nameNe" ILIKE ${"%" + w + "%"} OR p."descriptionNe" ILIKE ${"%" + w + "%"})`),
    ];
    const tsq = latin.map((w) => `${w}:*`).join(" | ");
    const phrase = latin.join(" ");
    // relevance: how well the text matches (full-text rank, fuzzy name similarity), the whole phrase in the name,
    // the name ending with the last word searched (English names the thing last: "linen shirt" wants a shirt, so
    // Relaxed Linen Shirt beats Linen Shirt Dress)
    // ("linen shirt" above a linen dress and a cotton shirt), a word naming its category ("shirt" → the Shirts
    // category above a shirt dress), then what sells and is liked (log, so best sellers lead without burying
    // a better match). In-stock products always come first (ORDER BY below).
    const rankExpr = latin.length
      ? Prisma.sql`ts_rank(${doc}, to_tsquery('simple', ${tsq})) * 2 + word_similarity(${phrase}, p."name")
          + CASE WHEN lower(p."name") LIKE ${"%" + phrase + "%"} THEN 0.6 ELSE 0 END
          + CASE WHEN lower(p."name") ~ ${"(^|[^a-z])" + latin[latin.length - 1].replace(/[^a-z0-9]/g, "") + "[a-z]*$"} THEN 0.7 ELSE 0 END
          + CASE WHEN to_tsvector('simple', coalesce(c."name", '')) @@ to_tsquery('simple', ${tsq}) THEN 0.5 ELSE 0 END
          + ln(1 + p."soldCount") * 0.12 + p."ratingAvg" * 0.04`
      : Prisma.sql`ln(1 + p."soldCount") * 0.12 + p."ratingAvg" * 0.04`;
    const run = (all: boolean) => db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', '0.4', true)`;
      const match = wordConds.length ? [Prisma.sql`(${Prisma.join(wordConds, all ? " AND " : " OR ")})`] : [];
      return tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT p.id FROM "Product" p LEFT JOIN "Category" c ON c.id = p."categoryId"
        WHERE ${Prisma.join([...filters, ...match], " AND ")}
        ORDER BY EXISTS (SELECT 1 FROM "Variant" sv WHERE sv."productId" = p.id AND sv.stock > 0) DESC, ${rankExpr} DESC, p."soldCount" DESC
        LIMIT ${limit}
      `);
    });
    let rows = await run(true);
    let relaxed = false;
    if (!rows.length && wordConds.length > 1) { rows = await run(false); relaxed = rows.length > 0; }
    return { ids: rows.map((r) => r.id), understood, relaxed };
  },
  // bump the version whenever ranking or understanding changes, so cached results from the old rules aren't served
  ["search-products", SEARCH_VERSION],
  { tags: ["products"], revalidate: 300 },
);

export async function searchProductIds(q: string, limit = 500): Promise<string[]> {
  return (await searchProducts(q, limit)).ids;
}

// ---------- Listing ----------

export const cardSelect = {
  id: true,
  name: true,
  nameNe: true,
  slug: true,
  brand: true,
  price: true,
  compareAtPrice: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
  images: { orderBy: { position: "asc" }, select: { url: true, alt: true, color: true }, take: 6 },
  variants: { select: { id: true, color: true, colorHex: true, size: true, stock: true }, orderBy: { position: "asc" } },
} satisfies Prisma.ProductSelect;

type RawCard = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export type ProductCardData = {
  id: string;
  name: string;
  /** Nepali name if the owner wrote one; show with pick(locale, name, nameNe) */
  nameNe: string | null;
  slug: string;
  brand: string;
  price: number;
  compareAtPrice: number | null;
  ratingAvg: number;
  ratingCount: number;
  isNew: boolean;
  images: { url: string; alt: string; color: string | null }[];
  colors: { name: string; hex: string }[];
  sizes: string[];
  inStock: boolean;
  lowStock: boolean;
  variants: { id: string; color: string; size: string; stock: number }[];
};

export function toCard(p: RawCard): ProductCardData {
  const colors = new Map<string, string>();
  const sizes = new Set<string>();
  let stock = 0;
  for (const v of p.variants) {
    if (!colors.has(v.color)) colors.set(v.color, v.colorHex);
    if (v.stock > 0) sizes.add(v.size);
    stock += v.stock;
  }
  return {
    id: p.id,
    name: p.name,
    nameNe: p.nameNe,
    slug: p.slug,
    brand: p.brand,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    isNew: Date.now() - new Date(p.createdAt).getTime() < 1000 * 60 * 60 * 24 * 30,
    images: p.images,
    colors: [...colors].map(([name, hex]) => ({ name, hex })),
    sizes: sortSizes([...sizes]),
    inStock: stock > 0,
    lowStock: stock > 0 && stock <= 5,
    variants: p.variants.map((v) => ({ id: v.id, color: v.color, size: v.size, stock: v.stock })),
  };
}

async function buildWhere(f: ProductFilters, opts: { ignore?: ("sizes" | "colors" | "brands" | "price")[] } = {}) {
  const and: Prisma.ProductWhereInput[] = [{ status: "ACTIVE" }];
  let searchIds: string[] | null = null;

  if (f.q) {
    searchIds = await searchProductIds(f.q);
    and.push({ id: { in: searchIds } });
  }
  if (f.category) {
    const c = await getCategoryBySlug(f.category);
    and.push({ categoryId: { in: c ? c.ids : ["__none__"] } });
  }
  if (f.collection) and.push({ collections: { some: { slug: f.collection } } });
  if (f.gender) and.push({ gender: { in: f.gender === "KIDS" ? ["KIDS"] : [f.gender, "UNISEX"] } });
  if (f.sale) and.push({ compareAtPrice: { not: null } });
  const ignore = new Set(opts.ignore ?? []);
  if (!ignore.has("brands") && f.brands?.length) and.push({ brand: { in: f.brands } });
  if (!ignore.has("price")) {
    if (f.minPrice != null) and.push({ price: { gte: f.minPrice } });
    if (f.maxPrice != null) and.push({ price: { lte: f.maxPrice } });
  }
  const variantWhere: Prisma.VariantWhereInput = {};
  if (!ignore.has("sizes") && f.sizes?.length) variantWhere.size = { in: f.sizes };
  if (!ignore.has("colors") && f.colors?.length) variantWhere.color = { in: f.colors };
  if (f.inStock || variantWhere.size) variantWhere.stock = { gt: 0 };
  if (Object.keys(variantWhere).length) and.push({ variants: { some: variantWhere } });

  return { where: { AND: and } satisfies Prisma.ProductWhereInput, searchIds };
}

function orderFor(sort: SortId | undefined): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "new": return [{ createdAt: "desc" }];
    case "best": return [{ soldCount: "desc" }];
    case "price-asc": return [{ price: "asc" }];
    case "price-desc": return [{ price: "desc" }];
    case "rating": return [{ ratingAvg: "desc" }, { ratingCount: "desc" }];
    default: return [{ featured: "desc" }, { soldCount: "desc" }, { createdAt: "desc" }];
  }
}

async function _listProducts(f: ProductFilters) {
  const page = Math.max(1, f.page ?? 1);
  const { where, searchIds } = await buildWhere(f);
  const relevance = searchIds && (!f.sort || f.sort === "relevance");

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    relevance
      ? db.product.findMany({ where, select: cardSelect })
      : db.product.findMany({ where, select: cardSelect, orderBy: [...orderFor(f.sort), { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);

  let products = rows;
  if (relevance) {
    const rank = new Map(searchIds!.map((id, i) => [id, i]));
    products = [...rows].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }
  return { products: products.map(toCard), total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Facets are computed on the broader scope so shoppers can widen a filter, not just narrow it. */
async function _getFacets(f: ProductFilters) {
  const { where } = await buildWhere(f, { ignore: ["sizes", "colors", "brands", "price"] });
  const [variants, brands, price] = await Promise.all([
    db.variant.findMany({ where: { product: where }, distinct: ["color", "size"], select: { color: true, colorHex: true, size: true } }),
    db.product.groupBy({ by: ["brand"], where, _count: { _all: true }, orderBy: { brand: "asc" } }),
    db.product.aggregate({ where, _min: { price: true }, _max: { price: true } }),
  ]);
  const colors = new Map<string, string>();
  const sizes = new Set<string>();
  for (const v of variants) {
    colors.set(v.color, v.colorHex);
    sizes.add(v.size);
  }
  return {
    colors: [...colors].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name)),
    sizes: sortSizes([...sizes]),
    brands: brands.map((b) => ({ name: b.brand, count: b._count._all })),
    priceMin: price._min.price ?? 0,
    priceMax: price._max.price ?? 0,
  };
}

// Listing pages are hot paths: cache per filter-combination for a minute, bust on catalog edits.
export const listProducts = (f: ProductFilters) =>
  unstable_cache(() => _listProducts(f), ["list", JSON.stringify(f)], { tags: ["products"], revalidate: 60 })();
export const getFacets = (f: ProductFilters) =>
  unstable_cache(() => _getFacets(f), ["facets", JSON.stringify({ ...f, page: undefined, sort: undefined })], { tags: ["products"], revalidate: 300 })();

export const getProductRail = unstable_cache(
  async (kind: "new" | "best" | "featured" | "sale", take = 8, gender?: Gender) => {
    const where: Prisma.ProductWhereInput = { status: "ACTIVE", ...(gender ? { gender: { in: [gender, "UNISEX"] } } : {}) };
    if (kind === "sale") where.compareAtPrice = { not: null };
    if (kind === "featured") where.featured = true;
    const orderBy = kind === "new" ? { createdAt: "desc" as const } : kind === "sale" ? { soldCount: "desc" as const } : { soldCount: "desc" as const };
    const rows = await db.product.findMany({ where, select: cardSelect, orderBy: [orderBy, { id: "asc" }], take });
    return rows.map(toCard);
  },
  ["rail"],
  { tags: ["products"], revalidate: 300 },
);

// ---------- Product detail ----------

export const getProduct = unstable_cache(
  async (slug: string) => {
    return db.product.findFirst({
      where: { slug, status: "ACTIVE" },
      include: {
        category: { include: { parent: true } },
        images: { orderBy: { position: "asc" } },
        variants: { orderBy: { position: "asc" } },
      },
    });
  },
  ["product"],
  { tags: ["products"], revalidate: 60 },
);

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

export async function getLiveStock(productId: string) {
  const rows = await db.variant.findMany({ where: { productId }, select: { id: true, stock: true } });
  return Object.fromEntries(rows.map((r) => [r.id, r.stock]));
}

export const getRelated = unstable_cache(
  async (productId: string, categoryId: string, gender: Gender) => {
    const rows = await db.product.findMany({
      where: { status: "ACTIVE", id: { not: productId }, OR: [{ categoryId }, { gender }] },
      select: cardSelect,
      orderBy: [{ soldCount: "desc" }],
      take: 24,
    });
    // same-category first
    const cat = await db.product.findMany({ where: { id: { in: rows.map((r) => r.id) }, categoryId }, select: { id: true } });
    const inCat = new Set(cat.map((c) => c.id));
    return rows.sort((a, b) => Number(inCat.has(b.id)) - Number(inCat.has(a.id))).slice(0, 8).map(toCard);
  },
  ["related"],
  { tags: ["products"], revalidate: 600 },
);

export async function getReviews(productId: string, take = 10) {
  const [reviews, dist, fits] = await Promise.all([
    db.review.findMany({
      where: { productId, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take,
      include: { user: { select: { name: true } } },
    }),
    db.review.groupBy({ by: ["rating"], where: { productId, status: "PUBLISHED" }, _count: { _all: true } }),
    db.review.groupBy({ by: ["fit"], where: { productId, status: "PUBLISHED", fit: { not: null } }, _count: { _all: true } }),
  ]);
  const distribution = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: dist.find((d) => d.rating === r)?._count._all ?? 0 }));
  return { reviews, distribution, fits: fits.map((f) => ({ fit: f.fit!, count: f._count._all })) };
}

export const getCollections = unstable_cache(
  async () => db.collection.findMany({ orderBy: [{ featured: "desc" }, { sortOrder: "asc" }] }),
  ["collections"],
  { tags: ["catalog"], revalidate: 3600 },
);

// ---------- Complete the look ----------

/** Staff-picked pairings, both directions, in stock first. */
export const getLook = unstable_cache(
  async (productId: string) => {
    const live = { status: "ACTIVE" as const };
    const p = await db.product.findUnique({
      where: { id: productId },
      select: { pairsWith: { where: live, select: cardSelect }, pairedBy: { where: live, select: cardSelect } },
    });
    if (!p) return [];
    const all = [...new Map([...p.pairsWith, ...p.pairedBy].map((x) => [x.id, x])).values()].map(toCard);
    return all.sort((a, b) => Number(b.inStock) - Number(a.inStock)).slice(0, 8);
  },
  ["look"],
  { tags: ["products"], revalidate: 600 },
);

/** Cards for a list of ids, in the order given (recently viewed). */
export async function getCardsByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.product.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: cardSelect });
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Everything worth suggesting while someone types, with how much it's wanted: what people searched (and
 * found) in the last 90 days, category names and "Men shirts"-style pairs, and product names. Cached an hour. */
const getCompletionPool = unstable_cache(
  async (): Promise<Candidate[]> => {
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const [terms, tree, products] = await Promise.all([
      db.searchStat.groupBy({ by: ["term"], where: { day: { gte: since }, lastResults: { gt: 0 } }, _sum: { searches: true }, having: { searches: { _sum: { gte: 2 } } }, orderBy: { _sum: { searches: "desc" } }, take: 500 }),
      getCategoryTree(),
      db.product.findMany({ where: { status: "ACTIVE" }, select: { name: true, soldCount: true }, orderBy: { soldCount: "desc" }, take: 2000 }),
    ]);
    const pool: Candidate[] = [];
    // a misspelt term can be popular too: it's suggested as understood ("blu shrt" → "blue shirt")
    for (const t of terms) { const u = await understandSearch(t.term); pool.push({ text: u.corrected && u.display ? u.display : t.term, weight: (t._sum.searches ?? 0) * 500 }); }
    for (const r of tree) {
      // categories outweigh single products: someone typing "s" more likely wants Shirts than one shirt
      pool.push({ text: r.name, weight: 50_000 });
      for (const ch of r.children) { pool.push({ text: ch.name, weight: 40_000 }); pool.push({ text: `${r.name} ${ch.name}`, weight: 10_000 }); }
    }
    for (const p of products) pool.push({ text: p.name, weight: 5 + p.soldCount });
    return pool;
  },
  ["completion-pool", SEARCH_VERSION],
  { tags: ["products"], revalidate: 3600 },
);

export async function searchCompletions(typed: string, limit = 6) {
  return rankCompletions(typed, await getCompletionPool(), limit);
}
