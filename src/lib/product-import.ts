import "server-only";
import type { Gender, Prisma, PrismaClient, ProductStatus } from "@prisma/client";
import { parseCsv, toCsv } from "./csv";
import { colorHexFor } from "./colors";
import { isMediaUrl } from "./media-url";
import { slugify } from "./utils";

/**
 * Spreadsheet import/export for the catalogue. One row per variant (colour × size); rows with the same
 * `handle` belong to one product. Product columns only need to be filled on the product's first row.
 *
 * Safety rules:
 *  - Preview first: the same plan is computed for preview and for import; nothing is written unless the
 *    whole file is valid, and the import runs in one transaction (all or nothing).
 *  - Existing products (matched by handle) are UPDATED only in the columns you fill in; blank = unchanged.
 *  - Existing variants keep their stock: stock changes go through Inventory/Purchasing so every unit has
 *    a reason. New variants' stock is logged in the inventory ledger as RECEIVED.
 *  - Nothing is ever deleted by an import.
 */

export const IMPORT_COLUMNS = [
  "handle", "name", "status", "category", "gender", "brand", "price", "mrp", "description", "features", "fabric", "fit", "care",
  "tags", "collections", "featured", "images", "color", "color_hex", "size", "sku", "stock", "cost",
] as const;
type Col = (typeof IMPORT_COLUMNS)[number];

const ALIASES: Record<string, Col> = {
  slug: "handle", "product handle": "handle", title: "name", "product name": "name", "selling price": "price", "price (rs)": "price",
  "mrp (rs)": "mrp", "compare at price": "mrp", "compare-at price": "mrp", material: "fabric", "key features": "features", details: "features",
  colour: "color", "colour hex": "color_hex", "color hex": "color_hex", hex: "color_hex", "cost price": "cost", "cost (rs)": "cost",
  quantity: "stock", qty: "stock", "image urls": "images", image: "images", photos: "images", audience: "gender",
};

export const MAX_IMPORT_ROWS = 5000;

type Ctx = {
  categories: { id: string; name: string; slug: string; parent: string | null; root: string }[];
  collections: { id: string; name: string; slug: string }[];
  products: Map<string, { id: string; name: string; images: string[]; variants: { id: string; sku: string; color: string; size: string }[] }>;
  /** sku → slug of the product that owns it */
  skuOwners: Map<string, string>;
};

export type PlannedVariant = { row: number; sku: string | null; color: string; colorHex: string; size: string; stock: number; costPrice: number | null };
export type PlannedProduct = {
  handle: string; name: string; action: "create" | "update"; existingId?: string; rows: number[];
  fields: Partial<{ name: string; status: ProductStatus; categoryId: string; gender: Gender; brand: string; price: number; compareAtPrice: number; description: string; details: string[]; material: string; fit: string; care: string; tags: string[]; featured: boolean }>;
  categoryLabel?: string; collectionIds: string[]; newImages: string[];
  newVariants: PlannedVariant[]; costUpdates: { variantId: string; costPrice: number }[]; stockIgnored: number;
};
export type ImportIssue = { row: number; message: string };
export type ImportPlan = {
  products: PlannedProduct[]; errors: ImportIssue[]; warnings: ImportIssue[];
  summary: { create: number; update: number; newVariants: number; units: number };
};

const lists = (s: string) => s.split("|").map((x) => x.trim()).filter(Boolean);
const money = (s: string): number | null => {
  const n = Number(s.replace(/rs\.?|npr|,|\s/gi, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

export async function loadImportContext(db: PrismaClient | Prisma.TransactionClient, handles: string[], skus: string[]): Promise<Ctx> {
  const [cats, collections, products, owned] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true, slug: true, parent: { select: { name: true } } } }),
    db.collection.findMany({ select: { id: true, name: true, slug: true } }),
    db.product.findMany({ where: { slug: { in: handles } }, select: { id: true, slug: true, name: true, images: { select: { url: true } }, variants: { select: { id: true, sku: true, color: true, size: true } } } }),
    db.variant.findMany({ where: { sku: { in: skus } }, select: { sku: true, product: { select: { slug: true } } } }),
  ]);
  return {
    categories: cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug, parent: c.parent?.name ?? null, root: c.parent?.name ?? c.name })),
    collections,
    products: new Map(products.map((p) => [p.slug, { id: p.id, name: p.name, images: p.images.map((i) => i.url), variants: p.variants }])),
    skuOwners: new Map(owned.map((v) => [v.sku, v.product.slug])),
  };
}

/** Parse the header, map aliases, and return rows as objects (row numbers as the spreadsheet shows them). */
export function readSheet(text: string): { rows: { n: number; v: Record<Col, string> }[]; errors: ImportIssue[]; unknown: string[] } {
  const grid = parseCsv(text);
  if (!grid.length) return { rows: [], errors: [{ row: 1, message: "The file is empty" }], unknown: [] };
  const header = grid[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, " "));
  const cols: (Col | null)[] = header.map((h) => (IMPORT_COLUMNS as readonly string[]).includes(h.replace(/ /g, "_")) ? (h.replace(/ /g, "_") as Col) : ALIASES[h] ?? null);
  const unknown = grid[0].filter((h, i) => h.trim() && !cols[i]);
  const errors: ImportIssue[] = [];
  if (!cols.includes("name") && !cols.includes("handle")) errors.push({ row: 1, message: "The first row must be the column names (download the template to see them)" });
  if (grid.length - 1 > MAX_IMPORT_ROWS) errors.push({ row: 1, message: `Too many rows (${grid.length - 1}). Split the file into parts of ${MAX_IMPORT_ROWS} rows or fewer.` });
  const rows = grid.slice(1).map((r, i) => {
    const v = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, ""])) as Record<Col, string>;
    cols.forEach((c, j) => { if (c) v[c] = (r[j] ?? "").trim(); });
    // a leading ' is how spreadsheets (and our export) protect text that looks like a formula
    for (const c of IMPORT_COLUMNS) if (v[c].startsWith("'")) v[c] = v[c].slice(1);
    return { n: i + 2, v };
  });
  return { rows, errors, unknown };
}

export function planImport(rows: { n: number; v: Record<Col, string> }[], ctx: Ctx): ImportPlan {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const groups = new Map<string, { n: number; v: Record<Col, string> }[]>();
  let lastHandle = "";
  for (const r of rows) {
    // a row with no handle and no name continues the product above (handy when pasting variants)
    const h = slugify(r.v.handle || r.v.name) || (r.v.color || r.v.size ? lastHandle : "");
    if (!h) { errors.push({ row: r.n, message: "Give the product a name or handle" }); continue; }
    lastHandle = h;
    groups.set(h, [...(groups.get(h) ?? []), r]);
  }

  const catIndex = new Map<string, typeof ctx.categories>();
  const addCat = (k: string, c: Ctx["categories"][number]) => catIndex.set(k, [...(catIndex.get(k) ?? []), c]);
  for (const c of ctx.categories) {
    addCat(c.slug, c);
    addCat(c.name.toLowerCase(), c);
    if (c.parent) addCat(`${c.parent} / ${c.name}`.toLowerCase(), c);
  }
  const findCat = (s: string) => {
    const k = s.toLowerCase().replace(/\s*[/>›]\s*/g, " / ").replace(/\s+/g, " ").trim();
    const hits = [...new Set(catIndex.get(k) ?? catIndex.get(slugify(s)) ?? [])];
    return hits;
  };
  const colIndex = new Map(ctx.collections.flatMap((c) => [[c.name.toLowerCase(), c.id], [c.slug, c.id]] as const));
  const seenSkus = new Map<string, number>();
  const products: PlannedProduct[] = [];
  let totalStockIgnored = 0;
  let firstStockRow: number | undefined;

  for (const [handle, group] of groups) {
    const first = (c: Col) => group.find((r) => r.v[c] !== "")?.v[c] ?? "";
    const firstRow = group[0].n;
    const existing = ctx.products.get(handle);
    const err = (row: number, message: string) => errors.push({ row, message });
    const fields: PlannedProduct["fields"] = {};
    const label = first("name") || existing?.name || handle;

    const name = first("name");
    if (name) { if (name.length < 2 || name.length > 120) err(firstRow, "Name must be 2–120 characters"); else fields.name = name; }
    else if (!existing) err(firstRow, "Name is required for a new product");

    let categoryLabel: string | undefined;
    const catText = first("category");
    if (catText) {
      const hits = findCat(catText);
      if (hits.length === 1) { fields.categoryId = hits[0].id; categoryLabel = hits[0].parent ? `${hits[0].parent} / ${hits[0].name}` : hits[0].name; }
      else if (hits.length > 1) err(firstRow, `Category "${catText}" matches ${hits.length} categories — write it as "${hits[0].parent ?? hits[0].name} / ${hits[0].name}"`);
      else err(firstRow, `Category "${catText}" doesn't exist (create it first, or check the spelling)`);
    } else if (!existing) err(firstRow, "Category is required for a new product");

    const g = first("gender").toUpperCase();
    if (g) {
      const map: Record<string, Gender> = { MEN: "MEN", MALE: "MEN", M: "MEN", WOMEN: "WOMEN", FEMALE: "WOMEN", W: "WOMEN", KIDS: "KIDS", KID: "KIDS", UNISEX: "UNISEX", ALL: "UNISEX" };
      if (map[g]) fields.gender = map[g]; else err(firstRow, `Gender "${first("gender")}" should be Men, Women, Kids or Unisex`);
    } else if (!existing && fields.categoryId) {
      const root = ctx.categories.find((c) => c.id === fields.categoryId)!.root.toUpperCase();
      fields.gender = root === "MEN" || root === "WOMEN" || root === "KIDS" ? (root as Gender) : "UNISEX";
    }

    const st = first("status").toUpperCase();
    if (st) {
      const map: Record<string, ProductStatus> = { ACTIVE: "ACTIVE", LIVE: "ACTIVE", PUBLISHED: "ACTIVE", DRAFT: "DRAFT", HIDDEN: "DRAFT", ARCHIVED: "ARCHIVED" };
      if (map[st]) fields.status = map[st]; else err(firstRow, `Status "${first("status")}" should be Active, Draft or Archived`);
    } else if (!existing) fields.status = "DRAFT";

    const brand = first("brand");
    if (brand) fields.brand = brand.slice(0, 60); else if (!existing) fields.brand = "Asson";

    const priceText = first("price");
    if (priceText) {
      const p = money(priceText);
      if (p == null || p <= 0 || p > 100_000_000) err(firstRow, `Price "${priceText}" isn't a valid amount in rupees`); else fields.price = p;
    } else if (!existing) err(firstRow, "Price is required for a new product");
    const mrpText = first("mrp");
    if (mrpText) {
      const m = money(mrpText);
      if (m == null || m <= 0 || m > 100_000_000) err(firstRow, `MRP "${mrpText}" isn't a valid amount`);
      else if (fields.price != null && m <= fields.price) err(firstRow, "MRP must be higher than the selling price (leave it blank if there's no discount)");
      else fields.compareAtPrice = m;
    }

    const desc = first("description");
    if (desc) { if (desc.length < 10) err(firstRow, "Description should be at least a sentence"); else fields.description = desc.slice(0, 5000); }
    else if (!existing) err(firstRow, "Description is required for a new product");
    if (first("features")) fields.details = lists(first("features")).slice(0, 20).map((d) => d.slice(0, 200));
    if (first("fabric")) fields.material = first("fabric").slice(0, 200);
    if (first("fit")) fields.fit = first("fit").slice(0, 60);
    if (first("care")) fields.care = first("care").slice(0, 500);
    if (first("tags")) fields.tags = [...new Set(first("tags").split(/[|,]/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 30).map((t) => t.slice(0, 40));
    const feat = first("featured").toLowerCase();
    if (feat) fields.featured = ["yes", "y", "true", "1"].includes(feat);

    const collectionIds: string[] = [];
    for (const c of lists(first("collections"))) {
      const id = colIndex.get(c.toLowerCase()) ?? colIndex.get(slugify(c));
      if (id) collectionIds.push(id); else warnings.push({ row: firstRow, message: `Collection "${c}" doesn't exist — skipped` });
    }

    const newImages: string[] = [];
    for (const r of group) for (const url of lists(r.v.images)) {
      if (!isMediaUrl(url) && !/^https:\/\/\S+$/.test(url)) { err(r.n, `Image "${url.slice(0, 60)}" must be an https:// link`); continue; }
      if (!existing?.images.includes(url) && !newImages.includes(url)) newImages.push(url);
    }
    if ((existing?.images.length ?? 0) + newImages.length > 20) err(firstRow, "A product can have at most 20 photos");

    const newVariants: PlannedVariant[] = [];
    const costUpdates: PlannedProduct["costUpdates"] = [];
    let stockIgnored = 0;
    const combos = new Set<string>();
    for (const r of group) {
      const { color, size } = r.v;
      if (!color && !size) continue; // product-only row
      if (!color || !size) { err(r.n, "Each variant row needs both a colour and a size"); continue; }
      if (color.length > 40 || size.length > 20) { err(r.n, "Colour (max 40) or size (max 20) is too long"); continue; }
      const key = `${color.toLowerCase()}|${size.toLowerCase()}`;
      if (combos.has(key)) { err(r.n, `${color} / ${size} appears twice for this product`); continue; }
      combos.add(key);

      const sku = r.v.sku.toUpperCase();
      if (sku && !/^[A-Z0-9][A-Z0-9-]{0,39}$/.test(sku)) { err(r.n, `SKU "${r.v.sku}" may only use letters, numbers and dashes`); continue; }
      let costPrice: number | null = null;
      if (r.v.cost) { const c = money(r.v.cost); if (c == null || c < 0) { err(r.n, `Cost "${r.v.cost}" isn't a valid amount`); continue; } costPrice = c; }

      const match = existing?.variants.find((x) => (sku && x.sku === sku) || (x.color.toLowerCase() === color.toLowerCase() && x.size.toLowerCase() === size.toLowerCase()));
      if (match) {
        if (r.v.stock !== "") stockIgnored++;
        if (costPrice != null) costUpdates.push({ variantId: match.id, costPrice });
        continue;
      }
      if (sku) {
        const owner = ctx.skuOwners.get(sku);
        if (owner && owner !== handle) { err(r.n, `SKU ${sku} already belongs to another product (${owner})`); continue; }
        if (seenSkus.has(sku)) { err(r.n, `SKU ${sku} is also used on row ${seenSkus.get(sku)}`); continue; }
        seenSkus.set(sku, r.n);
      }
      const stockN = r.v.stock === "" ? 0 : Number(r.v.stock.replace(/,/g, ""));
      if (!Number.isInteger(stockN) || stockN < 0 || stockN > 100_000) { err(r.n, `Stock "${r.v.stock}" must be a whole number from 0 to 100,000`); continue; }
      let colorHex = r.v.color_hex;
      if (colorHex) {
        if (!colorHex.startsWith("#")) colorHex = `#${colorHex}`;
        if (!/^#[0-9a-f]{6}$/i.test(colorHex)) { err(r.n, `Colour code "${r.v.color_hex}" should look like #1F2A44`); continue; }
      } else {
        colorHex = colorHexFor(color) ?? "#999999";
        if (!colorHexFor(color)) warnings.push({ row: r.n, message: `No swatch colour known for "${color}" — grey used. Add a color_hex like #1F2A44 to set it.` });
      }
      newVariants.push({ row: r.n, sku: sku || null, color, colorHex: colorHex.toUpperCase(), size, stock: stockN, costPrice });
    }
    if (!existing && !newVariants.length && !group.some((r) => errors.some((e) => e.row === r.n))) err(firstRow, "Add at least one row with a colour and size for this product");
    if ((existing?.variants.length ?? 0) + newVariants.length > 300) err(firstRow, "A product can have at most 300 variants");
    if (stockIgnored) { totalStockIgnored += stockIgnored; firstStockRow ??= firstRow; }

    products.push({ handle, name: label, action: existing ? "update" : "create", existingId: existing?.id, rows: group.map((r) => r.n), fields, categoryLabel, collectionIds, newImages, newVariants, costUpdates, stockIgnored });
  }

  if (totalStockIgnored) warnings.push({ row: firstStockRow!, message: `Stock left unchanged for ${totalStockIgnored} existing variant${totalStockIgnored > 1 ? "s" : ""} — change stock in Inventory or Purchasing so every unit has a reason` });

  return {
    products, errors: errors.sort((a, b) => a.row - b.row), warnings: warnings.sort((a, b) => a.row - b.row),
    summary: {
      create: products.filter((p) => p.action === "create").length,
      update: products.filter((p) => p.action === "update").length,
      newVariants: products.reduce((s, p) => s + p.newVariants.length, 0),
      units: products.reduce((s, p) => s + p.newVariants.reduce((t, v) => t + v.stock, 0), 0),
    },
  };
}

/** Next number in the shop's AS-00001 SKU sequence. Call inside the import transaction after taking the lock. */
async function nextSkuNumber(tx: Prisma.TransactionClient) {
  const [{ max }] = await tx.$queryRaw<{ max: number | null }[]>`SELECT MAX(CAST(SUBSTRING(sku FROM 4) AS INTEGER)) AS max FROM "Variant" WHERE sku ~ '^AS-[0-9]{1,9}$'`;
  return (max ?? 0) + 1;
}

/** Write a valid plan. All or nothing. Returns the ids of created/updated products. */
export async function applyImport(db: PrismaClient, plan: ImportPlan, actorId: string) {
  if (plan.errors.length) throw new Error("Plan has errors");
  return db.$transaction(async (tx) => {
    // one importer at a time, so generated SKUs never collide
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4417001)`;
    let next = await nextSkuNumber(tx);
    const touched: { id: string; slug: string; action: "create" | "update" }[] = [];
    for (const p of plan.products) {
      let id = p.existingId;
      const f = p.fields;
      if (!id) {
        const created = await tx.product.create({
          data: {
            name: f.name!, slug: p.handle, brand: f.brand ?? "Asson", description: f.description!, details: f.details ?? [], gender: f.gender ?? "UNISEX",
            status: f.status ?? "DRAFT", categoryId: f.categoryId!, price: f.price!, compareAtPrice: f.compareAtPrice ?? null,
            material: f.material ?? null, fit: f.fit ?? null, care: f.care ?? null, tags: f.tags ?? [], featured: f.featured ?? false,
            collections: { connect: p.collectionIds.map((cid) => ({ id: cid })) },
          },
        });
        id = created.id;
      } else {
        const cur = await tx.product.findUniqueOrThrow({ where: { id }, select: { price: true, compareAtPrice: true } });
        const price = f.price ?? cur.price;
        const mrp = f.compareAtPrice !== undefined ? f.compareAtPrice : cur.compareAtPrice;
        await tx.product.update({
          where: { id },
          // a blank MRP keeps the old one, unless the new price has caught up with it
          data: { ...f, compareAtPrice: mrp != null && mrp > price ? mrp : null, ...(p.collectionIds.length ? { collections: { connect: p.collectionIds.map((cid) => ({ id: cid })) } } : {}) },
        });
      }
      if (p.newImages.length) {
        const agg = await tx.productImage.aggregate({ where: { productId: id }, _max: { position: true } });
        const start = (agg._max.position ?? -1) + 1;
        await tx.productImage.createMany({ data: p.newImages.map((url, i) => ({ productId: id!, url, alt: f.name ?? p.name, position: start + i })) });
      }
      const posAgg = await tx.variant.aggregate({ where: { productId: id }, _max: { position: true } });
      let pos = (posAgg._max.position ?? -1) + 1;
      for (const v of p.newVariants) {
        const sku = v.sku ?? `AS-${String(next++).padStart(5, "0")}`;
        const nv = await tx.variant.create({ data: { productId: id, sku, color: v.color, colorHex: v.colorHex, size: v.size, stock: v.stock, position: pos++, ...(v.costPrice != null ? { costPrice: v.costPrice } : {}) } });
        if (v.stock) await tx.inventoryLog.create({ data: { variantId: nv.id, delta: v.stock, reason: "RECEIVED", note: "Spreadsheet import", actorId } });
      }
      for (const c of p.costUpdates) await tx.variant.update({ where: { id: c.variantId }, data: { costPrice: c.costPrice } });
      touched.push({ id, slug: p.handle, action: p.action });
    }
    return touched;
  }, { timeout: 120_000, maxWait: 15_000 });
}

/** Whole catalogue in the import format (round-trip: export → edit in a spreadsheet → import). */
export async function exportCatalogueCsv(db: PrismaClient, opts: { includeCost: boolean }) {
  const products = await db.product.findMany({
    orderBy: [{ createdAt: "asc" }],
    include: { category: { include: { parent: true } }, collections: { select: { name: true } }, images: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" } } },
  });
  const cols = IMPORT_COLUMNS.filter((c) => opts.includeCost || c !== "cost");
  const rows: (string | number | null)[][] = [[...cols]];
  const rs = (p: number | null) => (p == null ? "" : String(p / 100));
  for (const p of products) {
    p.variants.forEach((v, i) => {
      const head = i === 0;
      const rec: Record<string, string | number | null> = {
        handle: p.slug,
        name: head ? p.name : "", status: head ? p.status.toLowerCase() : "",
        category: head ? (p.category.parent ? `${p.category.parent.name} / ${p.category.name}` : p.category.name) : "",
        gender: head ? p.gender.toLowerCase() : "", brand: head ? p.brand : "", price: head ? rs(p.price) : "", mrp: head ? rs(p.compareAtPrice) : "",
        description: head ? p.description : "", features: head ? p.details.join(" | ") : "", fabric: head ? p.material : "", fit: head ? p.fit : "", care: head ? p.care : "",
        tags: head ? p.tags.join(", ") : "", collections: head ? p.collections.map((c) => c.name).join(" | ") : "", featured: head ? (p.featured ? "yes" : "no") : "",
        images: head ? p.images.map((im) => im.url).join(" | ") : "",
        color: v.color, color_hex: v.colorHex, size: v.size, sku: v.sku, stock: v.stock, cost: rs(v.costPrice),
      };
      rows.push(cols.map((c) => rec[c]));
    });
  }
  return toCsv(rows);
}

export function templateCsv() {
  const rows: string[][] = [
    [...IMPORT_COLUMNS],
    ["oxford-shirt", "Classic Oxford Shirt", "draft", "Men / Shirts", "men", "Asson", "2499", "2999", "A crisp cotton oxford with a soft collar roll — sharp with chinos, easy with denim.", "100% cotton oxford | Button-down collar | Mother-of-pearl buttons", "100% cotton", "Regular fit", "Machine wash cold. Warm iron.", "shirt, oxford, office", "", "no", "", "White", "", "M", "", "10", "1100"],
    ["oxford-shirt", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "White", "", "L", "", "12", "1100"],
    ["oxford-shirt", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Sky Blue", "", "M", "", "8", "1100"],
    ["oxford-shirt", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Sky Blue", "#8DB6D9", "L", "", "8", "1100"],
  ];
  return toCsv(rows);
}
