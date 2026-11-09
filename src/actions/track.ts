"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { parseOrderNumber } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

export async function trackOrder(_: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`track:${ip}`, 15, 15 * 60_000)) return { error: "Too many attempts. Please try again in a few minutes." };
  const n = parseOrderNumber(String(form.get("number") ?? ""));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!n || !email) return { error: "Enter your order number and email." };
  const order = await db.order.findUnique({ where: { number: n }, select: { id: true, email: true, userId: true } });
  if (!order || order.email.toLowerCase() !== email) return { error: "We couldn't find an order with those details." };
  if (order.userId) {
    const user = await getCurrentUser();
    if (user?.id !== order.userId) redirect(`/login?next=/orders/${order.id}`);
  }
  redirect(`/orders/${order.id}`);
}
