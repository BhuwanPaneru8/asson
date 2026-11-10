import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "./db";
import { getCurrentUser } from "./auth";

export const CART_COOKIE = "tl_cart";

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true, name: true, nameNe: true, slug: true, price: true, compareAtPrice: true, status: true, brand: true,
              images: { orderBy: { position: "asc" as const }, select: { url: true, color: true } },
            },
          },
        },
      },
    },
  },
};

export type CartLine = {
  id: string;
  variantId: string;
  productId: string;
  name: string;
  nameNe: string | null;
  brand: string;
  slug: string;
  color: string;
  size: string;
  image: string;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  stock: number;
  available: boolean;
};

export type CartView = { id: string | null; lines: CartLine[]; count: number; subtotal: number };

const EMPTY: CartView = { id: null, lines: [], count: 0, subtotal: 0 };

async function findCartId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) {
    const c = await db.cart.findUnique({ where: { userId: user.id }, select: { id: true } });
    return c?.id ?? null;
  }
  const jar = await cookies();
  return jar.get(CART_COOKIE)?.value ?? null;
}

/** Load the current visitor's cart, shaped for display. */
export const getCart = cache(async (): Promise<CartView> => {
  const id = await findCartId();
  if (!id) return EMPTY;
  const cart = await db.cart.findUnique({ where: { id }, include: cartInclude });
  if (!cart) return EMPTY;
  const lines: CartLine[] = cart.items.map((it) => {
    const p = it.variant.product;
    const image = p.images.find((i) => i.color === it.variant.color)?.url ?? p.images[0]?.url ?? "";
    return {
      id: it.id,
      variantId: it.variantId,
      productId: p.id,
      name: p.name,
      nameNe: p.nameNe,
      brand: p.brand,
      slug: p.slug,
      color: it.variant.color,
      size: it.variant.size,
      image,
      unitPrice: p.price,
      compareAtPrice: p.compareAtPrice,
      quantity: it.quantity,
      stock: it.variant.stock,
      available: p.status === "ACTIVE" && it.variant.stock >= it.quantity,
    };
  });
  return {
    id: cart.id,
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
  };
});

/** Get or create the cart the visitor is writing to. */
export async function ensureCartId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) {
    const c = await db.cart.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id }, select: { id: true } });
    return c.id;
  }
  const jar = await cookies();
  const existing = jar.get(CART_COOKIE)?.value;
  if (existing) {
    const c = await db.cart.findUnique({ where: { id: existing }, select: { id: true, userId: true } });
    if (c && !c.userId) return c.id;
  }
  const c = await db.cart.create({ data: {}, select: { id: true } });
  jar.set(CART_COOKIE, c.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 60, secure: process.env.NODE_ENV === "production" });
  return c.id;
}

/** After sign-in, fold the guest cart into the account cart (quantities summed, capped by stock). */
export async function mergeGuestCart(userId: string) {
  const jar = await cookies();
  const guestId = jar.get(CART_COOKIE)?.value;
  if (!guestId) return;
  const guest = await db.cart.findUnique({ where: { id: guestId }, include: { items: { include: { variant: { select: { stock: true } } } } } });
  jar.delete(CART_COOKIE);
  if (!guest || guest.userId) return;
  const userCart = await db.cart.upsert({ where: { userId }, update: {}, create: { userId }, include: { items: true } });
  await db.$transaction(async (tx) => {
    for (const item of guest.items) {
      const prev = userCart.items.find((i) => i.variantId === item.variantId)?.quantity ?? 0;
      const qty = Math.min(prev + item.quantity, item.variant.stock, 10);
      if (qty <= 0) continue;
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
        update: { quantity: qty },
        create: { cartId: userCart.id, variantId: item.variantId, quantity: qty },
      });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
}
