"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { parseOrderNumber } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { localiseResult } from "@/lib/i18n/server";

async function trackOrderImpl(_: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const ip = clientIp(await headers());
  if (!rateLimit(`track:${ip}`, 15, 15 * 60_000)) return { error: "Too many attempts. Please try again in a few minutes." };
  const n = parseOrderNumber(String(form.get("number") ?? ""));
  // the mobile number or the email used at checkout (many orders have no email)
  const raw = String(form.get("contact") ?? form.get("email") ?? "").trim();
  const email = raw.includes("@") ? raw.toLowerCase() : "";
  const phone = email ? "" : raw.replace(/\D/g, "").slice(-10);
  if (!n || (!email && phone.length !== 10)) return { error: "Enter your order number and the mobile number or email you ordered with." };
  const order = await db.order.findUnique({ where: { number: n }, select: { id: true, email: true, phone: true, userId: true } });
  const matches = !!order && (email ? !!order.email && order.email.toLowerCase() === email : order.phone.replace(/\D/g, "").slice(-10) === phone);
  if (!order || !matches) return { error: "We couldn't find an order with those details." };
  if (order.userId) {
    const user = await getCurrentUser();
    if (user?.id !== order.userId) redirect(`/login?next=/orders/${order.id}`);
  }
  redirect(`/orders/${order.id}`);
}

// Shoppers see these messages in their language (the logic above stays in English; see lib/i18n localise).
export async function trackOrder(...args: Parameters<typeof trackOrderImpl>) { return localiseResult(await trackOrderImpl(...args)); }
