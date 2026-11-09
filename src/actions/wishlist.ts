"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function toggleWishlist(productId: string): Promise<{ ok: boolean; saved?: boolean; needsLogin?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needsLogin: true };
  const key = { userId_productId: { userId: user.id, productId } };
  const existing = await db.wishlistItem.findUnique({ where: key });
  if (existing) await db.wishlistItem.delete({ where: key });
  else await db.wishlistItem.create({ data: { userId: user.id, productId } });
  refresh();
  return { ok: true, saved: !existing };
}
