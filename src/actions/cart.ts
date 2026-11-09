"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureCartId, getCart } from "@/lib/cart";
import { store } from "@/lib/config";
import { headers } from "next/headers";
import { after } from "next/server";
import { isBot, recordFunnel } from "@/lib/funnel";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const addSchema = z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(store.maxQtyPerItem) });

export async function addToCart(input: { variantId: string; quantity?: number }): Promise<Result> {
  const parsed = addSchema.safeParse({ quantity: 1, ...input });
  if (!parsed.success) return { ok: false, error: "Invalid item." };
  const { variantId, quantity } = parsed.data;

  const variant = await db.variant.findUnique({ where: { id: variantId }, select: { stock: true, product: { select: { id: true, status: true } } } });
  if (!variant || variant.product.status !== "ACTIVE") return { ok: false, error: "This item is no longer available." };
  if (variant.stock <= 0) return { ok: false, error: "Sorry, this size just sold out." };

  const cartId = await ensureCartId();
  const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } }, select: { quantity: true } });
  const desired = (existing?.quantity ?? 0) + quantity;
  const capped = Math.min(desired, variant.stock, store.maxQtyPerItem);
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    update: { quantity: capped },
    create: { cartId, variantId, quantity: capped },
  });
  await db.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  const productId = variant.product.id;
  if (!isBot((await headers()).get("user-agent"))) after(() => recordFunnel("add", productId));
  if (capped < desired) return { ok: true, message: `Only ${capped} available — we've added the maximum.` };
  return { ok: true };
}

export async function updateCartItem(itemId: string, quantity: number): Promise<Result> {
  const cart = await getCart();
  const line = cart.lines.find((l) => l.id === itemId);
  if (!line) return { ok: false, error: "Item not found in your bag." };
  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: itemId } });
  } else {
    const q = Math.min(Math.floor(quantity), line.stock, store.maxQtyPerItem);
    if (q <= 0) return { ok: false, error: "This size is out of stock." };
    await db.cartItem.update({ where: { id: itemId }, data: { quantity: q } });
    if (q < quantity) { refresh(); return { ok: true, message: `Only ${q} in stock.` }; }
  }
  refresh();
  return { ok: true };
}

export async function removeCartItem(itemId: string): Promise<Result> {
  return updateCartItem(itemId, 0);
}

/** Change size/colour of a line in place. */
export async function swapCartVariant(itemId: string, newVariantId: string): Promise<Result> {
  const cart = await getCart();
  const line = cart.lines.find((l) => l.id === itemId);
  if (!line || !cart.id) return { ok: false, error: "Item not found." };
  const v = await db.variant.findUnique({ where: { id: newVariantId }, select: { stock: true, productId: true } });
  if (!v || v.productId !== line.productId) return { ok: false, error: "Invalid option." };
  if (v.stock <= 0) return { ok: false, error: "That size is sold out." };
  await db.$transaction([
    db.cartItem.delete({ where: { id: itemId } }),
    db.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: newVariantId } },
      update: { quantity: { increment: 0 } },
      create: { cartId: cart.id, variantId: newVariantId, quantity: Math.min(line.quantity, v.stock) },
    }),
  ]);
  refresh();
  return { ok: true };
}
