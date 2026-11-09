"use server";

import { refresh, revalidateTag, revalidatePath } from "next/cache";
import { queueBackInStock } from "@/lib/stock-alerts";
import { dispatchNotifications } from "@/lib/notifications";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requirePermission } from "@/lib/auth";
import { fieldErrors } from "@/lib/validators";
import { slugify } from "@/lib/utils";

type R = { ok: boolean; error?: string; id?: string; fieldErrors?: Record<string, string> };

const rupees = z.coerce.number().positive("Enter a price").max(1_000_000).transform((n) => Math.round(n * 100));

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(140).optional().or(z.literal("")),
  brand: z.string().trim().min(1).max(60),
  description: z.string().trim().min(10, "Write at least a sentence").max(5000),
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
  images: z.array(z.object({ url: z.string().url("Image URLs must be valid https links").startsWith("https://"), alt: z.string().max(200).default(""), color: z.string().max(40).nullable().optional() })).max(20),
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
    name: d.name, slug, brand: d.brand, description: d.description, details: d.details.filter(Boolean),
    gender: d.gender, status: d.status, categoryId: d.categoryId, price: d.price, compareAtPrice: d.compareAtPrice ?? null,
    material: d.material || null, fit: d.fit || null, care: d.care || null, tags: [...new Set(d.tags.filter(Boolean))], featured: d.featured,
  };

  try {
    const productId = await db.$transaction(async (tx) => {
      const p = id
        ? await tx.product.update({ where: { id }, data: { ...base, collections: { set: d.collectionIds.map((cid) => ({ id: cid })) } } })
        : await tx.product.create({ data: { ...base, collections: { connect: d.collectionIds.map((cid) => ({ id: cid })) } } });

      await tx.productImage.deleteMany({ where: { productId: p.id } });
      if (d.images.length) await tx.productImage.createMany({ data: d.images.map((im, i) => ({ productId: p.id, url: im.url, alt: im.alt, color: im.color || null, position: i })) });

      // Variants: update in place (keeps cart/order references), add new, delete removed (unless ever ordered)
      const existing = await tx.variant.findMany({ where: { productId: p.id }, select: { id: true, stock: true, _count: { select: { orderItems: true } } } });
      const keep = new Set(d.variants.filter((v) => v.id).map((v) => v.id!));
      for (const ex of existing.filter((e) => !keep.has(e.id))) {
        if (ex._count.orderItems > 0) await tx.variant.update({ where: { id: ex.id }, data: { stock: 0 } });
        else await tx.variant.delete({ where: { id: ex.id } });
      }
      for (const [i, v] of d.variants.entries()) {
        const data = { sku: v.sku, color: v.color, colorHex: v.colorHex, size: v.size, stock: v.stock, position: i, ...(v.costPrice !== undefined ? { costPrice: v.costPrice } : {}) };
        const prev = v.id ? existing.find((e) => e.id === v.id) : undefined;
        if (prev) {
          await tx.variant.update({ where: { id: prev.id }, data });
          if (prev.stock !== v.stock) await tx.inventoryLog.create({ data: { variantId: prev.id, delta: v.stock - prev.stock, reason: "MANUAL_ADJUST", note: "Product editor", actorId: staff.id } });
        } else {
          const nv = await tx.variant.create({ data: { ...data, productId: p.id } });
          if (v.stock) await tx.inventoryLog.create({ data: { variantId: nv.id, delta: v.stock, reason: "RECEIVED", note: "Initial stock", actorId: staff.id } });
        }
      }
      return p.id;
    }, { timeout: 30_000 });
    revalidateTag("products", { expire: 0 });
    revalidatePath(`/p/${slug}`);
    return { ok: true, id: productId };
  } catch (e) {
    console.error("saveProduct", e);
    return { ok: false, error: "Couldn't save the product. Check for duplicate colour/size combinations or SKUs." };
  }
}

export async function setProductStatus(id: string, status: "DRAFT" | "ACTIVE" | "ARCHIVED"): Promise<R> {
  await requireAdmin();
  await db.product.update({ where: { id }, data: { status } });
  revalidateTag("products", { expire: 0 });
  refresh();
  return { ok: true };
}

export async function adjustStock(variantId: string, delta: number, reason: string, note?: string): Promise<R & { stock?: number }> {
  const staff = await requirePermission("inventory.adjust");
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) return { ok: false, error: "Enter a whole number." };
  const allowed = ["RECEIVED", "MANUAL_ADJUST", "DAMAGED", "RETURN_RESTOCK"];
  if (!allowed.includes(reason)) return { ok: false, error: "Invalid reason." };
  try {
    const v = await db.$transaction(async (tx) => {
      // never let stock go negative, even under concurrent sales
      const res = await tx.variant.updateMany({ where: { id: variantId, ...(delta < 0 ? { stock: { gte: -delta } } : {}) }, data: { stock: { increment: delta } } });
      if (!res.count) throw new Error("insufficient");
      await tx.inventoryLog.create({ data: { variantId, delta, reason, note: note?.slice(0, 200), actorId: staff.id } });
      if (delta > 0) await queueBackInStock(tx, [variantId]);
      return tx.variant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
    });
    revalidateTag("products", { expire: 60 });
    if (delta > 0) after(() => dispatchNotifications().catch((e) => console.error("dispatchNotifications", e)));
    refresh();
    return { ok: true, stock: v.stock };
  } catch {
    return { ok: false, error: "Stock can't go below zero." };
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
  await requireAdmin();
  const p = couponSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrors(p.error) };
  const d = p.data;
  if (d.type === "PERCENT" && (d.value <= 0 || d.value > 90)) return { ok: false, fieldErrors: { value: "Percent must be between 1 and 90" } };
  if (await db.coupon.findUnique({ where: { code: d.code } })) return { ok: false, fieldErrors: { code: "This code already exists" } };
  await db.coupon.create({
    data: {
      code: d.code, description: d.description || null, type: d.type,
      value: d.type === "PERCENT" ? Math.round(d.value) : Math.round(d.value * 100),
      minSubtotal: Math.round(d.minSubtotal * 100),
      maxDiscount: d.maxDiscount ? Math.round(Number(d.maxDiscount) * 100) : null,
      usageLimit: d.usageLimit ? Number(d.usageLimit) : null,
      endsAt: d.endsAt ? new Date(`${d.endsAt}T23:59:59+05:45`) : null, // end of day, Nepal time
    },
  });
  refresh();
  return { ok: true };
}

export async function toggleCoupon(id: string): Promise<R> {
  await requireAdmin();
  const c = await db.coupon.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Not found" };
  await db.coupon.update({ where: { id }, data: { active: !c.active } });
  refresh();
  return { ok: true };
}

export async function setReviewStatus(id: string, status: "PUBLISHED" | "HIDDEN"): Promise<R> {
  await requirePermission("reviews");
  const r = await db.review.update({ where: { id }, data: { status } });
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
  await db.user.update({ where: { id: userId }, data: { role, tokenVersion: { increment: 1 } } });
  refresh();
  return { ok: true };
}
