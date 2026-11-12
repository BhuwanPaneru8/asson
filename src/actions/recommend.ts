"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { bagSuggestions, recommendedFor } from "@/lib/recommend";
import type { ProductCardData } from "@/lib/catalog";

const ids = z.array(z.string().regex(/^[a-z0-9]{10,40}$/)).max(12);

/** "Recommended for you": this device's recently viewed products, plus a signed-in shopper's orders and wishlist. */
export async function getForYou(recent: string[]): Promise<ProductCardData[]> {
  const parsed = ids.safeParse(recent);
  const user = await getCurrentUser();
  return recommendedFor({ userId: user?.id ?? null, recentIds: parsed.success ? parsed.data : [] });
}

/** "Complete your order" for the bag in this browser. */
export async function getBagSuggestions(): Promise<{ gap: number; closesGap: ProductCardData[]; others: ProductCardData[] }> {
  const cart = await getCart();
  return bagSuggestions(cart.lines);
}
