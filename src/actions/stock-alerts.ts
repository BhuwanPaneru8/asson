"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { localiseResult } from "@/lib/i18n/server";

const schema = z.object({ variantId: z.string().min(1).max(40), phone: z.string().trim().regex(/^9[678]\d{8}$/, "Enter a 10-digit Nepali mobile number") });

async function subscribeStockAlertImpl(input: { variantId: string; phone: string }): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the number." };
  const { variantId, phone } = parsed.data;
  const ip = clientIp(await headers());
  if (!rateLimit(`alert:${ip}`, 20, 60 * 60_000)) return { ok: false, error: "Too many requests. Please try again later." };
  const v = await db.variant.findUnique({ where: { id: variantId }, select: { stock: true, product: { select: { status: true } } } });
  if (!v || v.product.status !== "ACTIVE") return { ok: false, error: "This item isn't available." };
  if (v.stock > 0) return { ok: false, error: "Good news — it's in stock right now. Add it to your bag." };
  const user = await getCurrentUser();
  await db.stockAlert.upsert({
    where: { variantId_phone: { variantId, phone } },
    create: { variantId, phone, userId: user?.id },
    update: { notifiedAt: null, ...(user ? { userId: user.id } : {}) }, // asking again re-arms a used alert
  });
  return { ok: true, message: "Done — we'll text you as soon as it's back." };
}

// Shoppers see these messages in their language (the logic above stays in English; see lib/i18n localise).
export async function subscribeStockAlert(...args: Parameters<typeof subscribeStockAlertImpl>) { return localiseResult(await subscribeStockAlertImpl(...args)); }

const priceSchema = z.object({ productId: z.string().min(1).max(40), phone: z.string().trim().regex(/^9[678]\d{8}$/, "Enter a 10-digit Nepali mobile number") });

async function subscribePriceAlertImpl(input: { productId: string; phone: string }): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const parsed = priceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the number." };
  const { productId, phone } = parsed.data;
  const ip = clientIp(await headers());
  if (!rateLimit(`alert:${ip}`, 20, 60 * 60_000)) return { ok: false, error: "Too many requests. Please try again later." };
  const p = await db.product.findUnique({ where: { id: productId }, select: { status: true, price: true } });
  if (!p || p.status !== "ACTIVE") return { ok: false, error: "This item isn't available." };
  const user = await getCurrentUser();
  // asking again re-arms the alert at today's price
  await db.$executeRaw`INSERT INTO "PriceAlert" ("id", "productId", "phone", "userId", "price") VALUES (${`pa_${productId}_${phone}`}, ${productId}, ${phone}, ${user?.id ?? null}, ${p.price})
    ON CONFLICT ("productId", "phone") DO UPDATE SET "price" = EXCLUDED."price", "notifiedAt" = NULL, "userId" = COALESCE(EXCLUDED."userId", "PriceAlert"."userId")`;
  return { ok: true, message: "Done — we'll text you if the price drops." };
}
export async function subscribePriceAlert(...args: Parameters<typeof subscribePriceAlertImpl>) { return localiseResult(await subscribePriceAlertImpl(...args)); }
