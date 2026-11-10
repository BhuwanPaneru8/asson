"use server";

import { reportError, reportErrorSoon } from "@/lib/errors";
import { refresh, revalidateTag, revalidatePath } from "next/cache";
import { queueBackInStock } from "@/lib/stock-alerts";
import { requireStoreAccess, ScopeError } from "@/lib/scope";
import { activeLocation, defaultReceivingLocation, moveStock, moveStockOrThrow, StockError, zeroVariant, type StockReason } from "@/lib/stock";
import { dispatchNotifications } from "@/lib/notifications";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requirePermission } from "@/lib/auth";
import { fieldErrors } from "@/lib/validators";
import { slugify } from "@/lib/utils";
import { isMediaUrl } from "@/lib/media-url";
import { audit, diff } from "@/lib/audit";
import { formatPrice } from "@/lib/utils";

type R = { ok: boolean; error?: string; id?: string; fieldErrors?: Record<string, string> };

const rupees = z.coerce.number().positive("Enter a price").max(1_000_000).transform((n) => Math.round(n * 100));

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(140).optional().or(z.literal("")),
  brand: z.string().trim().min(1).max(60),
  description: z.string().trim().min(10, "Write at least a sentence").max(5000),
  // Nepali storefront text (optional; blank shows the English)
  nameNe: z.string().trim().max(120).optional(),
  descriptionNe: z.string().trim().max(5000).optional(),
  details: z.array(z.string().trim().max(200)).max(20),
  gender: z.enum(["MEN", "WOMEN", "KIDS", "UNISEX"]),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  categoryId: z.string().min(1, "Choose a category"),
  price: rupees,
  compareAtPrice: z.union([rupees, z.literal("").transform(() => null), z.null()]).optional(),
  material: z.string().trim().max(200).optional(),
  fit: z.string().trim().max(60).optional(),
  care: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().toLowerCase().max(40)).max(30),
  featured: z.boolean(),
  collectionIds: z.array(z.string()).max(20),
  images: z.array(z.object({ url: z.string().trim().refine((u) => isMediaUrl(u) || /^https:\/\/[^\s]+$/.test(u), "Upload a photo or use an https:// image link"), alt: z.string().max(200).default(""), color: z.string().max(40).nullable().optional() })).max(20),
  variants: z.array(z.object({
    id: z.string().optional(),
    sku: z.string().trim().min(1).max(40),
    color: z.string().trim().min(1).max(40),
    colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    size: z.string().trim().min(1).max(20),
    stock: z.coerce.number().int().min(0).max(1_000_000),
    costPrice: z.number().int().min(0).max(100_000_000).nullable().optional(), // paisa; owner only
  })).min(1, "Add at least one variant").max(300),
});

export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(input: ProductInput, id?: string): Promise<R> {
  const staff = await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.compareAtPrice != null && d.compareAtPrice <= d.price) return { ok: false, fieldErrors: { compareAtPrice: "MRP must be higher than the selling price" } };

  const combos = new Set<string>();
  for (const v of d.variants) {
    const k = `${v.color}|${v.size}`;
    if (combos.has(k)) return { ok: false, error: `Duplicate variant: ${v.color} / ${v.size}` };
    combos.add(k);
  }
  const slug = slugify(d.slug || d.name);
  const clash = await db.product.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { ok: false, fieldErrors: { slug: "Another product already uses this URL" } };
  const skuClash = await db.variant.findFirst({ where: { sku: { in: d.variants.map((v) => v.sku) }, ...(id ? { NOT: { productId: id } } : {}) }, select: { sku: true } });
  if (skuClash) return { ok: false, error: `SKU ${skuClash.sku} is already used by another product.` };

  const base = {
    name: d.name, nameNe: d.nameNe || null, slug, brand: d.brand, description: d.description, descriptionNe: d.descriptionNe || null, details: d.details.filter(Boolean),
    gender: d.gender, status: d.status, categoryId: d.categoryId, price: d.price, compareAtPrice: d.compareAtPrice ?? null,
    material: d.material || null, fit: d.fit || null, care: d.care || null, tags: [...new Set(d.tags.filter(Boolean))], featured: d.featured,
  };

  try {
    const productId = await db.$transaction(async (tx) => {
      const before = id ? await tx.product.findUnique({ where: { id }, select: { name: true, nameNe: true, slug: true, brand: true, description: true, descriptionNe: true, details: true, gender: true, status: true, categoryId: true, price: true, compareAtPrice: true, material: true, fit: true, care: true, tags: true, featured: true } }) : null;
      const vCount = { added: 0, removed: 0, cost: [] as [string, number | null, number | null][] };
      const p = id
        ? await tx.product.update({ where: { id }, data: { ...base, collections: { set: d.collectionIds.map((cid) => ({ id: cid })) } } })
        : await tx.product.create({ data: { ...base, collections: { connect: d.collectionIds.map((cid) => ({ id: cid })) } } });

      await tx.productImage.deleteMany({ where: { productId: p.id } });
      if (d.images.length) await tx.productImage.createMany({ data: d.images.map((im, i) => ({ productId: p.id, url: im.url, alt: im.alt, color: im.color || null, position: i })) });

      // Variants: update in place (keeps cart/order references), add new, delete removed (unless ever ordered)
      const existing = await tx.variant.findMany({ where: { productId: p.id }, select: { id: true, _count: { select: { orderItems: true } } } });
      const keep = new Set(d.variants.filter((v) => v.id).map((v) => v.id!));
      for (const ex of existing.filter((e) => !keep.has(e.id))) {
        // a size with order history is kept (for the records) but emptied at every location
        if (ex._count.orderItems > 0) await zeroVariant(tx, ex.id, staff.id, "Size removed in product editor");
        else {
          await zeroVariant(tx, ex.id, staff.id, "Size deleted in product editor");
          await tx.variant.delete({ where: { id: ex.id } });
        }
        vCount.removed++;
      }
      let receiveAt: string | undefined;
      for (const [i, v] of d.variants.entries()) {
        // stock of existing sizes changes only through Inventory (per location), never by typing a total here
        const data = { sku: v.sku, color: v.color, colorHex: v.colorHex, size: v.size, position: i, ...(v.costPrice !== undefined ? { costPrice: v.costPrice } : {}) };
        const prev = v.id ? existing.find((e) => e.id === v.id) : undefined;
        if (prev) {
          const old = await tx.variant.findUniqueOrThrow({ where: { id: prev.id }, select: { sku: true, costPrice: true } });
          await tx.variant.update({ where: { id: prev.id }, data });
          if (v.costPrice !== undefined && (v.costPrice ?? null) !== old.costPrice) vCount.cost.push([v.sku, old.costPrice, v.costPrice ?? null]);
        } else {
          const nv = await tx.variant.create({ data: { ...data, productId: p.id } });
          vCount.added++;
          if (v.stock) {
            receiveAt ??= (await defaultReceivingLocation(tx)).id;
            await moveStock(tx, { variantId: nv.id, storeId: receiveAt, delta: v.stock, reason: "RECEIVED", note: "Initial stock", actorId: staff.id });
          }
        }
      }
      const fields = ["name", "nameNe", "slug", "brand", "description", "descriptionNe", "details", "gender", "status", "categoryId", "price", "compareAtPrice", "material", "fit", "care", "tags", "featured"] as const;
      const { changes, text: rawText } = before ? diff(before, base, [...fields]) : { changes: {}, text: "" };
      let text = rawText;
      if (changes.categoryId) {
        // show category names, not ids
        const cats = await tx.category.findMany({ where: { id: { in: changes.categoryId as string[] } }, select: { id: true, name: true, parent: { select: { name: true } } } });
        const label = (cid: unknown) => { const c = cats.find((x) => x.id === cid); return c ? `${c.parent ? `${c.parent.name} / ` : ""}${c.name}` : "—"; };
        text = text.replace(`Category ${changes.categoryId[0]} → ${changes.categoryId[1]}`, `Category ${label(changes.categoryId[0])} → ${label(changes.categoryId[1])}`);
      }
      const extra = [
        vCount.added && `${vCount.added} size${vCount.added > 1 ? "s" : ""} added`,
        vCount.removed && `${vCount.removed} size${vCount.removed > 1 ? "s" : ""} removed`,
        vCount.cost.length && `cost changed on ${vCount.cost.length} size${vCount.cost.length > 1 ? "s" : ""}`,
      ].filter(Boolean).join("; ");
      if (!before) {
        await audit(tx, staff, { action: "product.create", entity: ["Product", p.id], summary: `Created ${base.name} (${formatPrice(base.price)}, ${d.variants.length} variants, ${base.status.toLowerCase()})` });
      } else if (text || extra || vCount.cost.length || Object.keys(changes).length) {
        await audit(tx, staff, {
          action: "product.update", entity: ["Product", p.id],
          summary: `${base.name}: ${[text, extra].filter(Boolean).join("; ") || "details edited"}`,
          changes: { ...changes, ...(vCount.cost.length ? { costPrice: vCount.cost.map(([sku, a, b]) => ({ sku, costPrice: [a, b] })) } : {}) },
        });
      }
      return p.id;
    }, { timeout: 30_000 });
    revalidateTag("products", { expire: 0 });
    revalidatePath(`/p/${slug}`);
    return { ok: true, id: productId };
  } catch (e) {
    void reportError("saveProduct", e);
    return { ok: false, error: "Couldn't save the product. Check for duplicate colour/size combinations or SKUs." };
  }
}

export async function setProductStatus(id: string, status: "DRAFT" | "ACTIVE" | "ARCHIVED"): Promise<R> {
  const staff = await requireAdmin();
  await db.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id }, select: { name: true, status: true } });
    await tx.product.update({ where: { id }, data: { status } });
    if (before.status !== status) await audit(tx, staff, { action: "product.status", entity: ["Product", id], summary: `${before.name}: status ${before.status.toLowerCase()} → ${status.toLowerCase()}`, changes: { status: [before.status, status] } });
  });
  revalidateTag("products", { expire: 0 });
  refresh();
  return { ok: true };
}

export async function adjustStock(variantId: string, delta: number, reason: string, note?: string, storeId?: string): Promise<R & { stock?: number; here?: number }> {
  const staff = await requirePermission("inventory.adjust");
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) return { ok: false, error: "Enter a whole number." };
  const allowed = ["RECEIVED", "MANUAL_ADJUST", "DAMAGED", "RETURN_RESTOCK"];
  if (!allowed.includes(reason)) return { ok: false, error: "Invalid reason." };
  try {
    const v = await db.$transaction(async (tx) => {
      const at = await activeLocation(tx, storeId);
      await requireStoreAccess(staff, at.id, tx); // only at a location this person works at
      // never let a location go negative, even under concurrent sales
      await moveStockOrThrow(tx, { variantId, storeId: at.id, delta, reason: reason as StockReason, note, actorId: staff.id }, `Stock can't go below zero: ${at.name} doesn't have that many.`);
      const v = await tx.variant.findUniqueOrThrow({ where: { id: variantId }, select: { sku: true, color: true, size: true, stock: true, productId: true, product: { select: { name: true } }, storeStock: { where: { storeId: at.id }, select: { quantity: true } } } });
      const here = v.storeStock[0]?.quantity ?? 0;
      await audit(tx, staff, { action: "stock.adjust", entity: ["Product", v.productId], summary: `${v.product.name} ${v.color} ${v.size} (${v.sku}) at ${at.name}: ${delta > 0 ? "+" : ""}${delta} ${reason.toLowerCase().replace("_", " ")}${note ? ` — ${note.slice(0, 80)}` : ""} → ${here} there, ${v.stock} in stock`, changes: { sku: v.sku, storeId: at.id, delta, reason, stockAfter: v.stock, locationAfter: here } });
      if (delta > 0) await queueBackInStock(tx, [variantId]);
      return { stock: v.stock, here };
    });
    revalidateTag("products", { expire: 60 });
    if (delta > 0) after(() => dispatchNotifications().catch(reportErrorSoon("dispatchNotifications")));
    refresh();
    return { ok: true, stock: v.stock, here: v.here };
  } catch (e) {
    if (e instanceof StockError || e instanceof ScopeError) return { ok: false, error: e.message };
    void reportError("adjustStock", e);
    return { ok: false, error: "Couldn't adjust stock. Please try again." };
  }
}

const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "3–30 letters, numbers, - or _"),
  description: z.string().trim().max(200).optional(),
  type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
  value: z.coerce.number().min(0),
  minSubtotal: z.coerce.number().min(0).default(0),
  maxDiscount: z.union([z.coerce.number().positive(), z.literal("")]).optional(),
  usageLimit: z.union([z.coerce.number().int().positive(), z.literal("")]).optional(),
  endsAt: z.string().optional(),
});

export async function createCoupon(input: unknown): Promise<R> {
  const staff = await requireAdmin();
  const p = couponSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrors(p.error) };
  const d = p.data;
  if (d.type === "PERCENT" && (d.value <= 0 || d.value > 90)) return { ok: false, fieldErrors: { value: "Percent must be between 1 and 90" } };
  if (await db.coupon.findUnique({ where: { code: d.code } })) return { ok: false, fieldErrors: { code: "This code already exists" } };
  const c = await db.coupon.create({
    data: {
      code: d.code, description: d.description || null, type: d.type,
      value: d.type === "PERCENT" ? Math.round(d.value) : Math.round(d.value * 100),
      minSubtotal: Math.round(d.minSubtotal * 100),
      maxDiscount: d.maxDiscount ? Math.round(Number(d.maxDiscount) * 100) : null,
      usageLimit: d.usageLimit ? Number(d.usageLimit) : null,
      endsAt: d.endsAt ? new Date(`${d.endsAt}T23:59:59+05:45`) : null, // end of day, Nepal time
    },
  });
  await audit(db, staff, { action: "coupon.create", entity: ["Coupon", c.id], summary: `Created coupon ${c.code}: ${c.type === "PERCENT" ? `${c.value}% off` : `${formatPrice(c.value)} off`}${c.minSubtotal ? ` over ${formatPrice(c.minSubtotal)}` : ""}${c.usageLimit ? `, ${c.usageLimit} uses` : ""}${c.endsAt ? `, ends ${c.endsAt.toISOString().slice(0, 10)}` : ""}` });
  refresh();
  return { ok: true };
}

export async function toggleCoupon(id: string): Promise<R> {
  const staff = await requireAdmin();
  const c = await db.coupon.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Not found" };
  await db.$transaction(async (tx) => {
    await tx.coupon.update({ where: { id }, data: { active: !c.active } });
    await audit(tx, staff, { action: "coupon.toggle", entity: ["Coupon", id], summary: `Coupon ${c.code} ${c.active ? "turned off" : "turned on"}`, changes: { active: [c.active, !c.active] } });
  });
  refresh();
  return { ok: true };
}

/** Feature a coupon in the home-page offer banner (only one at a time), or take it off. */
export async function setCouponOnHome(id: string, on: boolean): Promise<R> {
  const staff = await requireAdmin();
  const c = await db.coupon.findUnique({ where: { id } });
  if (!c || c.isCredit) return { ok: false, error: "Not found" };
  await db.$transaction([
    ...(on ? [db.coupon.updateMany({ where: { showOnHome: true, NOT: { id } }, data: { showOnHome: false } })] : []),
    db.coupon.update({ where: { id }, data: { showOnHome: on } }),
  ]);
  await audit(db, staff, { action: "coupon.home", entity: ["Coupon", id], summary: `Coupon ${c.code} ${on ? "featured on" : "removed from"} the home page`, changes: { showOnHome: [c.showOnHome, on] } });
  refresh();
  return { ok: true };
}

export async function setReviewStatus(id: string, status: "PUBLISHED" | "HIDDEN"): Promise<R> {
  const staff = await requirePermission("reviews");
  const r = await db.review.update({ where: { id }, data: { status }, include: { product: { select: { name: true } } } });
  await audit(db, staff, { action: "review.status", entity: ["Product", r.productId], summary: `${status === "HIDDEN" ? "Hid" : "Published"} a ${r.rating}★ review on ${r.product.name}`, changes: { reviewId: r.id, status } });
  const agg = await db.review.aggregate({ where: { productId: r.productId, status: "PUBLISHED" }, _avg: { rating: true }, _count: { _all: true } });
  await db.product.update({ where: { id: r.productId }, data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count._all } });
  revalidateTag("products", { expire: 0 });
  refresh();
  return { ok: true };
}

export async function setUserRole(userId: string, role: "CUSTOMER" | "CASHIER" | "STAFF" | "MANAGER" | "ADMIN"): Promise<R> {
  const me = await requirePermission("team.manage");
  if (!["CUSTOMER", "CASHIER", "STAFF", "MANAGER", "ADMIN"].includes(role)) return { ok: false, error: "Invalid role." };
  if (me.id === userId) return { ok: false, error: "You can't change your own role." };
  // bump tokenVersion so the new permissions take effect immediately
  await db.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, role: true } });
    await tx.user.update({ where: { id: userId }, data: { role, tokenVersion: { increment: 1 } } });
    if (before.role !== role) await audit(tx, me, { action: "user.role", entity: ["User", userId], summary: `${before.name} (${before.email}): role ${before.role.toLowerCase()} → ${role.toLowerCase()}`, changes: { role: [before.role, role] } });
  });
  refresh();
  return { ok: true };
}
