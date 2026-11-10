"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CareError, customerReply, normalisePhone, openCase, rateCase } from "@/lib/care";
import { clientIp } from "@/lib/client-ip";
import { reportError } from "@/lib/errors";
import { getLocale, localiseResult } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { parseOrderNumber } from "@/lib/utils";

// Customer-facing: no sign-in needed. Messages are English sentences from the dictionary, so localiseResult
// turns them into the shopper's language.

type R = { ok: true; token: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  phone: z.string().trim().max(20).refine((p) => !!normalisePhone(p), "Enter a valid mobile number, e.g. 98XXXXXXXX."),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]).default(""),
  order: z.string().trim().max(20).default(""),
  category: z.enum(["ORDER", "DELIVERY", "PAYMENT", "QUALITY", "EXCHANGE", "SERVICE", "OTHER"]),
  subject: z.string().trim().max(120).default(""),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(4000),
  website: z.string().max(500).default(""), // honeypot: people never see it, bots fill it
});

async function submitImpl(input: z.input<typeof schema>): Promise<R> {
  const p = schema.safeParse(input);
  if (!p.success) {
    const fieldErrors = Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message]));
    return { ok: false, error: p.error.issues[0]?.message ?? "Couldn't send that. Please try again, or call us.", fieldErrors };
  }
  const d = p.data;
  if (d.website) return { ok: true, token: "" }; // pretend it worked; store nothing
  const ip = clientIp(await headers());
  const phone = normalisePhone(d.phone)!;
  if (!rateLimit(`care:ip:${ip}`, 6, 60 * 60_000) || !rateLimit(`care:phone:${phone}`, 4, 60 * 60_000)) return { ok: false, error: "Too many messages. Please try again in an hour, or call us." };
  const user = await getCurrentUser();

  let orderId: string | null = null, userId = user?.role === "CUSTOMER" ? user.id : null, storeId: string | null = null;
  if (d.order) {
    const n = parseOrderNumber(d.order);
    const o = n ? await db.order.findUnique({ where: { number: n }, select: { id: true, phone: true, email: true, userId: true, pickupStoreId: true, shift: { select: { storeId: true } } } }) : null;
    // the order must be theirs: same phone or email, or signed in as its owner (no peeking at other people's orders)
    const theirs = o && (normalisePhone(o.phone) === phone || (!!d.email && o.email.toLowerCase() === d.email.toLowerCase()) || (!!user && o.userId === user.id));
    if (!theirs) return { ok: false, error: "We couldn't find that order with your phone or email. Leave the order number empty and tell us in the message.", fieldErrors: { order: "We couldn't find that order with your phone or email. Leave the order number empty and tell us in the message." } };
    orderId = o.id;
    userId ??= o.userId;
    storeId = o.shift?.storeId ?? o.pickupStoreId ?? null; // a till sale or a pickup: the shop's manager sees it too
  }
  const locale = await getLocale();
  try {
    const c = await db.$transaction((tx) => openCase(tx, {
      channel: "WEB", category: d.category, subject: d.subject || d.message.slice(0, 80), message: d.message,
      name: d.name, phone, email: d.email || null, locale, userId, orderId, storeId,
    }));
    return { ok: true, token: c.token };
  } catch (e) {
    if (e instanceof CareError) return { ok: false, error: e.message };
    after(() => reportError("care.submit", e));
    return { ok: false, error: "Couldn't send that. Please try again, or call us." };
  }
}

export async function submitCareCase(input: z.input<typeof schema>) { return localiseResult(await submitImpl(input)); }

async function replyImpl(token: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = String(body ?? "").trim().slice(0, 4000);
  if (text.length < 2) return { ok: false, error: "Tell us a little more (at least 10 characters)." };
  if (!rateLimit(`care:reply:${String(token).slice(0, 40)}`, 20, 60 * 60_000)) return { ok: false, error: "Too many messages. Please try again in an hour, or call us." };
  try {
    await db.$transaction((tx) => customerReply(tx, String(token), text));
    return { ok: true };
  } catch (e) {
    if (e instanceof CareError) return { ok: false, error: e.message };
    after(() => reportError("care.reply", e));
    return { ok: false, error: "Couldn't send that. Please try again, or call us." };
  }
}

export async function replyToCareCase(token: string, body: string) { return localiseResult(await replyImpl(token, body)); }

async function rateImpl(token: string, rating: number, comment: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!rateLimit(`care:rate:${String(token).slice(0, 40)}`, 5, 60 * 60_000)) return { ok: false, error: "Too many messages. Please try again in an hour, or call us." };
  try {
    await db.$transaction((tx) => rateCase(tx, String(token), { rating: Number(rating), comment: String(comment ?? "") }));
    return { ok: true };
  } catch (e) {
    if (e instanceof CareError) return { ok: false, error: e.message };
    after(() => reportError("care.rate", e));
    return { ok: false, error: "Couldn't send that. Please try again, or call us." };
  }
}

export async function rateCareCase(token: string, rating: number, comment: string) { return localiseResult(await rateImpl(token, rating, comment)); }
