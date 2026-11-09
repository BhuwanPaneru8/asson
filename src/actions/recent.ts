"use server";

import { z } from "zod";
import { getCardsByIds, type ProductCardData } from "@/lib/catalog";

const ids = z.array(z.string().regex(/^[a-z0-9]{10,40}$/)).max(12);

export async function getRecentlyViewed(input: string[]): Promise<ProductCardData[]> {
  const parsed = ids.safeParse(input);
  return parsed.success ? getCardsByIds(parsed.data) : [];
}
