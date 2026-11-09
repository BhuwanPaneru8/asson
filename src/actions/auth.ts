"use server";

import { redirect } from "next/navigation";
import { store } from "@/lib/config";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword, getCurrentUser } from "@/lib/auth";
import { mergeGuestCart } from "@/lib/cart";
import { rateLimit } from "@/lib/rate-limit";
import { phoneSchema } from "@/lib/validators";
import { homeFor, isStaffRole } from "@/lib/permissions";

export type AuthState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/account";
}

async function clientKey(prefix: string, id: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  return `${prefix}:${ip}:${id.toLowerCase()}`;
}

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const { email, password } = parsed.data;

  if (!rateLimit(await clientKey("login", email), 8, 15 * 60_000))
    return { error: "Too many attempts. Please wait a few minutes and try again." };

  const user = await db.user.findUnique({ where: { email } });
  // constant-ish time: always run bcrypt
  const ok = await verifyPassword(password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !ok) return { error: "That email and password don't match our records." };

  await createSession(user);
  await mergeGuestCart(user.id);
  const next = safeNext(form.get("next"));
  redirect(isStaffRole(user.role) && next === "/account" ? homeFor(user.role) : next);
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: phoneSchema.optional().or(z.literal("")),
  password: z.string().min(8, "Use at least 8 characters").max(128).regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
});

export async function register(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  const { name, email, phone, password } = parsed.data;
  if (!rateLimit(await clientKey("register", "x"), 10, 60 * 60_000)) return { error: "Too many sign-ups from this network. Try again later." };

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { fieldErrors: { email: "An account with this email already exists. Sign in instead?" } };

  const welcome = store.loyalty.welcomePoints;
  const user = await db.user.create({
    data: {
      name, email, phone: phone || null, passwordHash: await hashPassword(password),
      points: welcome,
      ...(welcome ? { pointsEntries: { create: { delta: welcome, reason: "WELCOME", note: "Welcome to Asson" } } } : {}),
    },
  });
  await createSession(user);
  await mergeGuestCart(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

const pwSchema = z.object({ current: z.string().min(1), next: z.string().min(8).regex(/[A-Za-z]/).regex(/\d/) });

export async function changePassword(_: AuthState, form: FormData): Promise<AuthState & { ok?: boolean }> {
  const me = await getCurrentUser();
  if (!me) return { error: "Please sign in again." };
  const parsed = pwSchema.safeParse({ current: form.get("current"), next: form.get("next") });
  if (!parsed.success) return { error: "New password must be 8+ characters with a letter and a number." };
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return { error: "Current password is incorrect." };
  // bumping tokenVersion signs out every other device
  const updated = await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.next), tokenVersion: { increment: 1 } } });
  await createSession(updated);
  return { ok: true };
}
