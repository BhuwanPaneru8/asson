"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { randomBytes } from "node:crypto";
import { checkCode, codeMode, CodeError, findAccount, issueCode, parseIdentifier } from "@/lib/sign-in";
import { dispatchNotifications } from "@/lib/notifications";
import { store } from "@/lib/config";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword, getCurrentUser } from "@/lib/auth";
import { mergeGuestCart } from "@/lib/cart";
import { rateLimit } from "@/lib/rate-limit";
import { phoneSchema } from "@/lib/validators";
import { homeFor, isStaffRole, twoFactorStep } from "@/lib/permissions";
import { beginSignIn } from "@/lib/two-factor";
import { clientIp } from "@/lib/client-ip";
import { audit } from "@/lib/audit";
import { localiseResult } from "@/lib/i18n/server";

export type AuthState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/account";
}

async function clientKey(prefix: string, id: string) {
  const h = await headers();
  const ip = clientIp(h);
  return `${prefix}:${ip}:${id.toLowerCase()}`;
}

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

async function loginImpl(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const { email, password } = parsed.data;

  if (!rateLimit(await clientKey("login", email), 8, 15 * 60_000)) {
    const target = await db.user.findUnique({ where: { email }, select: { id: true, name: true, role: true } });
    if (target && isStaffRole(target.role)) await audit(db, null, { action: "auth.login_blocked", entity: ["User", target.id], summary: `Too many sign-in attempts for staff account ${email} — blocked for 15 minutes` });
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const user = await db.user.findUnique({ where: { email } });
  // constant-ish time: always run bcrypt
  const ok = await verifyPassword(password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  // staff accounts are the keys to the business: record every failed and successful sign-in
  if (user && !ok && isStaffRole(user.role)) await audit(db, null, { action: "auth.login_failed", entity: ["User", user.id], summary: `Wrong password for staff account ${email}` });
  if (!user || !ok) return { error: "That email and password don't match our records." };
  await finish(user, true, form.get("next") as string | null);
  return undefined;
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: phoneSchema.optional().or(z.literal("")),
  password: z.string().min(8, "Use at least 8 characters").max(128).regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
});

async function registerImpl(_: AuthState, form: FormData): Promise<AuthState> {
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

async function changePasswordImpl(_: AuthState, form: FormData): Promise<AuthState & { ok?: boolean }> {
  const me = await getCurrentUser();
  if (!me) return { error: "Please sign in again." };
  const parsed = pwSchema.safeParse({ current: form.get("current"), next: form.get("next") });
  if (!parsed.success) return { error: "New password must be 8+ characters with a letter and a number." };
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return { error: "Current password is incorrect." };
  // bumping tokenVersion signs out every other device
  const updated = await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.next), tokenVersion: { increment: 1 } } });
  // this session already passed two-step sign-in (getCurrentUser checks), so the new one keeps that
  await createSession(updated, { twoFactor: twoFactorStep(updated) !== "none" });
  if (isStaffRole(me.role)) await audit(db, me, { action: "auth.password_changed", entity: ["User", me.id], summary: `${me.name} changed their password (other devices signed out)` });
  return { ok: true };
}

// ---------- one-step sign-in (components/account/auth-panel.tsx) ----------

type Result = { ok: true } | { ok: false; error: string };
const remembered = (v: unknown) => v !== false;

/** Step 1: who is this? Says whether there's an account and what they can sign in with. */
async function identifyImpl(raw: string): Promise<{ ok: true; kind: "phone" | "email"; exists: boolean; firstName: string | null; codes: boolean; staff: boolean } | { ok: false; error: string }> {
  if (!rateLimit(await clientKey("identify", "x"), 40, 10 * 60_000)) return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  const id = parseIdentifier(raw);
  if (!id) return { ok: false, error: "Enter a mobile number (98XXXXXXXX) or an email address." };
  const { user, ambiguous } = await findAccount(id);
  if (ambiguous) return { ok: false, error: "More than one account uses this number. Please sign in with your email." };
  const staff = !!user && isStaffRole(user.role);
  // staff always use their password (every sign-in is recorded); codes go to phones
  return { ok: true, kind: id.kind, exists: !!user, firstName: user ? user.name.split(" ")[0] : null, codes: id.kind === "phone" && !staff && codeMode() !== "off", staff };
}

/** Password (or code) checked: sign in, or (staff with two-step sign-in) on to the second step first. */
async function finish(user: Parameters<typeof beginSignIn>[0], remember: boolean, next: string | null | undefined) {
  const dest = safeNext(next ?? null);
  const r = await beginSignIn(user, { remember, dest: isStaffRole(user.role) && dest === "/account" ? homeFor(user.role) : dest });
  if (r.signedIn) await mergeGuestCart(user.id);
  redirect(r.to);
}

async function signInWithPasswordImpl(input: { identifier: string; password: string; remember?: boolean; next?: string }): Promise<Result> {
  const id = parseIdentifier(input.identifier ?? "");
  if (!id || !input.password) return { ok: false, error: "Enter your password." };
  if (!rateLimit(await clientKey("login", id.value), 8, 15 * 60_000)) {
    const { user } = await findAccount(id);
    if (user && isStaffRole(user.role)) await audit(db, null, { action: "auth.login_blocked", entity: ["User", user.id], summary: `Too many sign-in attempts for staff account ${user.email} — blocked for 15 minutes` });
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }
  const { user } = await findAccount(id);
  const ok = await verifyPassword(input.password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (user && !ok && isStaffRole(user.role)) await audit(db, null, { action: "auth.login_failed", entity: ["User", user.id], summary: `Wrong password for staff account ${user.email}` });
  if (!user || !ok) return { ok: false, error: "That password isn't right. Try again, or reset it." };
  await finish(user, remembered(input.remember), input.next);
  return { ok: true };
}

async function sendCodeImpl(input: { identifier: string; purpose: "LOGIN" | "RESET" }): Promise<{ ok: true; testCode?: string } | { ok: false; error: string }> {
  const id = parseIdentifier(input.identifier ?? "");
  if (!id || id.kind !== "phone") return { ok: false, error: "Codes go to mobile numbers. Enter yours (98XXXXXXXX)." };
  if (!rateLimit(await clientKey("code", id.value), 6, 15 * 60_000)) return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  const { user } = await findAccount(id);
  if (input.purpose === "RESET" && !user) return { ok: false, error: "There's no account with that number." };
  if (user && isStaffRole(user.role)) return { ok: false, error: "Staff sign in with their password. Ask the owner for a new sign-in link if you've forgotten it." };
  try {
    const r = await issueCode(id.value, input.purpose === "RESET" ? "RESET" : "LOGIN");
    after(() => dispatchNotifications(10).catch(() => {}));
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof CodeError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Sign in (or sign up, for a new number) with the code from the SMS. */
async function signInWithCodeImpl(input: { identifier: string; code: string; name?: string; remember?: boolean; next?: string }): Promise<Result> {
  const id = parseIdentifier(input.identifier ?? "");
  if (!id || id.kind !== "phone") return { ok: false, error: "Enter your mobile number." };
  try { await checkCode(id.value, "LOGIN", input.code ?? ""); } catch (e) { if (e instanceof CodeError) return { ok: false, error: e.message }; throw e; }
  const { user } = await findAccount(id);
  if (user && isStaffRole(user.role)) return { ok: false, error: "Staff sign in with their password." };
  await finish(user ?? (await newShopper({ name: input.name ?? "", phone: id.value })), remembered(input.remember), input.next);
  return { ok: true };
}

const newAccountSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: phoneSchema.optional().or(z.literal("")),
  password: z.string().min(8, "Use at least 8 characters").max(128).regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
});

/** A new shopper (with the welcome points). Phone-only sign-ups get a placeholder email they can change later. */
async function newShopper(d: { name: string; email?: string; phone?: string | null; password?: string }) {
  const name = d.name.trim().length >= 2 ? d.name.trim().slice(0, 80) : "Asson customer";
  const welcome = store.loyalty.welcomePoints;
  return db.user.create({
    data: {
      name, email: d.email ?? `${d.phone}@phone.asson.local`, phone: d.phone || null,
      passwordHash: await hashPassword(d.password ?? randomBytes(24).toString("hex")),
      points: welcome,
      ...(welcome ? { pointsEntries: { create: { delta: welcome, reason: "WELCOME", note: "Welcome to Asson" } } } : {}),
    },
  });
}

async function createAccountImpl(input: { identifier: string; name: string; email?: string; phone?: string; password: string; remember?: boolean; next?: string }): Promise<{ ok: true } | { ok: false; error?: string; fieldErrors?: Record<string, string> }> {
  const id = parseIdentifier(input.identifier ?? "");
  if (!id) return { ok: false, error: "Enter a mobile number or an email address." };
  const parsed = newAccountSchema.safeParse({ name: input.name, email: id.kind === "email" ? id.value : input.email, phone: id.kind === "phone" ? id.value : input.phone ?? "", password: input.password });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, fieldErrors };
  }
  if (!rateLimit(await clientKey("register", "x"), 10, 60 * 60_000)) return { ok: false, error: "Too many sign-ups from this network. Try again later." };
  const d = parsed.data;
  if (await db.user.findUnique({ where: { email: d.email }, select: { id: true } })) return { ok: false, fieldErrors: { email: "An account with this email already exists. Sign in instead?" } };
  if (d.phone && (await db.user.count({ where: { phone: d.phone } }))) return { ok: false, fieldErrors: { phone: "An account with this number already exists. Sign in instead?" } };
  const user = await newShopper({ name: d.name, email: d.email, phone: d.phone || null, password: d.password });
  await finish(user, remembered(input.remember), input.next);
  return { ok: true };
}

/** Forgotten password, with the code from the SMS: set a new one and sign in. */
async function resetWithCodeImpl(input: { identifier: string; code: string; password: string; next?: string }): Promise<Result> {
  const id = parseIdentifier(input.identifier ?? "");
  if (!id || id.kind !== "phone") return { ok: false, error: "Enter your mobile number." };
  const pw = newAccountSchema.shape.password.safeParse(input.password);
  if (!pw.success) return { ok: false, error: pw.error.issues[0]?.message ?? "Choose a stronger password." };
  try { await checkCode(id.value, "RESET", input.code ?? ""); } catch (e) { if (e instanceof CodeError) return { ok: false, error: e.message }; throw e; }
  const { user } = await findAccount(id);
  if (!user || isStaffRole(user.role)) return { ok: false, error: "There's no account with that number." };
  // a new password signs out every other device
  const updated = await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(pw.data), tokenVersion: { increment: 1 } } });
  await finish({ ...updated }, true, input.next);
  return { ok: true };
}

// Shoppers see these messages in their language (see lib/i18n localise).
export async function login(...args: Parameters<typeof loginImpl>) { return localiseResult(await loginImpl(...args)); }
export async function register(...args: Parameters<typeof registerImpl>) { return localiseResult(await registerImpl(...args)); }
export async function changePassword(...args: Parameters<typeof changePasswordImpl>) { return localiseResult(await changePasswordImpl(...args)); }
export async function identify(...args: Parameters<typeof identifyImpl>) { return localiseResult(await identifyImpl(...args)); }
export async function signInWithPassword(...args: Parameters<typeof signInWithPasswordImpl>) { return localiseResult(await signInWithPasswordImpl(...args)); }
export async function sendCode(...args: Parameters<typeof sendCodeImpl>) { return localiseResult(await sendCodeImpl(...args)); }
export async function signInWithCode(...args: Parameters<typeof signInWithCodeImpl>) { return localiseResult(await signInWithCodeImpl(...args)); }
export async function createAccount(...args: Parameters<typeof createAccountImpl>) { return localiseResult(await createAccountImpl(...args)); }
export async function resetWithCode(...args: Parameters<typeof resetWithCodeImpl>) { return localiseResult(await resetWithCodeImpl(...args)); }
