import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "./db";
import { createSession } from "./auth";
import { audit, type AuditActor } from "./audit";
import { rateLimit } from "./rate-limit";
import { clientIp } from "./client-ip";
import { checkCode, CodeError, codeMode, issueCode } from "./sign-in";
import { isStaffRole, TWO_FACTOR_ROLES, twoFactorStep, type Role } from "./permissions";
import { store } from "./config";
import { decryptSecret, encryptSecret, hashBackupCode, matchTotp, newBackupCodes, newTotpSecret, otpauthUri } from "./two-factor-core";
import { PENDING_COOKIE, PENDING_MAX_AGE, signPending, signTrust, TRUST_MAX_AGE, verifyPending, verifyTrust, type PendingPayload } from "./session-token";

// Two-step sign-in for staff. After the password, someone who uses it (or must: managers and owners always,
// anyone else the owner requires) gets a short-lived "second step" cookie, not a session, and is sent to
// /login/two-factor: a code from their authenticator app, a text message code (fallback, when the SMS gateway
// is live) or a one-time backup code. Someone who must use it but hasn't set it up does that first, before any
// staff page. "Trust this device for 30 days" skips the code on that browser; it's tied to the person's
// tokenVersion, so a password change, removal from the team or a two-step reset ends it. Tries are rate-limited
// like passwords. Every enable, disable, reset and failure goes to the audit trail. Customers never see any of it.

export class TwoFactorError extends Error {}
export type Method = "totp" | "sms" | "backup";
const METHOD_LABEL: Record<Method, string> = { totp: "authenticator app", sms: "text message code", backup: "backup code" };

/** Tries per person per 15 minutes: 8 from one network (as for passwords), 20 in all. */
export const TWO_FACTOR_LIMITS = { perNetwork: 8, perPerson: 20, windowMs: 15 * 60_000 };

const pepper = () => process.env.AUTH_SECRET ?? "dev-secret";
const cookieOpts = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" });
export const trustCookieName = (userId: string) => `tl_trust_${createHash("sha256").update(userId).digest("hex").slice(0, 16)}`;

const userSelect = { id: true, name: true, email: true, phone: true, role: true, tokenVersion: true, twoFactorRequired: true, totpEnabledAt: true, totpSecret: true, totpLastStep: true, totpPendingSecret: true } as const;
type SignInUser = { id: string; name: string; email: string; role: Role; tokenVersion: number; twoFactorRequired: boolean; totpEnabledAt: Date | null };
const actorOf = (u: { id: string; name: string; role: string }): NonNullable<AuditActor> => ({ id: u.id, name: u.name, role: u.role });
const level = (role: string) => role.toLowerCase();

// ---------- the sign-in steps ----------

/**
 * The password (or an invite link) checked out: sign in now, or go to the second step first. Returns where to
 * send them and whether they're signed in yet. Every staff sign-in that completes is recorded.
 */
export async function beginSignIn(user: SignInUser, opts: { remember: boolean; dest: string }): Promise<{ to: string; signedIn: boolean }> {
  const step = twoFactorStep(user);
  if (step === "none") {
    if (isStaffRole(user.role)) await audit(db, user, { action: "auth.login", entity: ["User", user.id], summary: `${user.name} signed in (${level(user.role)})` });
    await createSession(user, { remember: opts.remember });
    return { to: opts.dest, signedIn: true };
  }
  const jar = await cookies();
  if (step === "verify" && (await isTrustedDevice(user))) {
    await audit(db, user, { action: "auth.login", entity: ["User", user.id], summary: `${user.name} signed in (${level(user.role)}, two-step: trusted device)` });
    await createSession(user, { remember: opts.remember, twoFactor: true });
    return { to: opts.dest, signedIn: true };
  }
  const token = await signPending({ sub: user.id, v: user.tokenVersion, stage: step, remember: opts.remember, next: opts.dest });
  jar.set(PENDING_COOKIE, token, { ...cookieOpts(), maxAge: PENDING_MAX_AGE });
  return { to: "/login/two-factor", signedIn: false };
}

async function isTrustedDevice(user: { id: string; tokenVersion: number }) {
  const t = await verifyTrust((await cookies()).get(trustCookieName(user.id))?.value);
  return !!t && t.sub === user.id && t.v === user.tokenVersion;
}

/** The person halfway through signing in (password done, second step to go), or null when it has run out. */
export async function pendingSignIn(): Promise<(PendingPayload & { user: NonNullable<Awaited<ReturnType<typeof loadUser>>> }) | null> {
  const p = await verifyPending((await cookies()).get(PENDING_COOKIE)?.value);
  if (!p) return null;
  const user = await loadUser(p.sub);
  // a password change or removal from the team in the meantime ends it
  if (!user || user.tokenVersion !== p.v || !isStaffRole(user.role)) return null;
  // they set it up meanwhile (another tab): now it's a code
  const stage = twoFactorStep(user);
  if (stage === "none") return null;
  return { ...p, stage, user };
}

const loadUser = (id: string) => db.user.findUnique({ where: { id }, select: userSelect });

/** What the second-step screen offers this person. */
export function methodsFor(user: { phone: string | null; totpEnabledAt: Date | null }, backupLeft: number) {
  return { totp: !!user.totpEnabledAt, sms: !!user.totpEnabledAt && !!user.phone && codeMode() !== "off", backup: backupLeft > 0 };
}

export const backupCodesLeft = (userId: string) => db.twoFactorBackupCode.count({ where: { userId, usedAt: null } });

async function allowTry(user: { id: string; name: string; email: string }) {
  const ip = clientIp(await headers());
  const a = rateLimit(`2fa:${ip}:${user.id}`, TWO_FACTOR_LIMITS.perNetwork, TWO_FACTOR_LIMITS.windowMs);
  const b = rateLimit(`2fa-user:${user.id}`, TWO_FACTOR_LIMITS.perPerson, TWO_FACTOR_LIMITS.windowMs);
  if (a && b) return;
  await audit(db, null, { action: "auth.2fa_blocked", entity: ["User", user.id], summary: `Too many two-step codes tried for staff account ${user.email} — blocked for 15 minutes` });
  throw new TwoFactorError("Too many tries. Please wait 15 minutes and try again.");
}

async function failed(user: { id: string; email: string }, method: Method, message: string): Promise<never> {
  await audit(db, null, { action: "auth.2fa_failed", entity: ["User", user.id], summary: `Wrong ${METHOD_LABEL[method]} for staff account ${user.email}` });
  throw new TwoFactorError(message);
}

/** Check one code for someone with two-step sign-in on. Uses it up; wrong ones are recorded. */
export async function verifySecondFactor(user: NonNullable<Awaited<ReturnType<typeof loadUser>>>, method: Method, code: string, now = new Date()) {
  await allowTry(user);
  if (method === "totp") {
    if (!user.totpSecret) throw new TwoFactorError("Your authenticator app isn't set up. Use a backup code, or ask the owner to reset two-step sign-in.");
    const secret = decryptSecret(user.totpSecret);
    const step = matchTotp(secret, code, now, user.totpLastStep);
    if (step == null) {
      // the right code, already used: say so (it's the next code they need, not a typo)
      if (matchTotp(secret, code, now) != null) await failed(user, method, "That code was just used. Wait for the next one in your app.");
      await failed(user, method, "That code isn't right. Check your authenticator app and try again.");
    }
    const ok = await db.user.updateMany({ where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step! } }] }, data: { totpLastStep: step! } });
    if (!ok.count) await failed(user, method, "That code was just used. Wait for the next one in your app.");
    return { method, backupLeft: null };
  }
  if (method === "backup") {
    const used = await db.twoFactorBackupCode.updateMany({ where: { userId: user.id, codeHash: hashBackupCode(user.id, code, pepper()), usedAt: null }, data: { usedAt: now } });
    if (!used.count) await failed(user, method, "That backup code isn't right, or was already used.");
    const left = await backupCodesLeft(user.id);
    await audit(db, actorOf(user), { action: "auth.2fa_backup_used", entity: ["User", user.id], summary: `${user.name} used a backup code (${left} left)` });
    return { method, backupLeft: left };
  }
  if (!user.phone || !user.totpEnabledAt) throw new TwoFactorError("Text message codes aren't available for your account.");
  try {
    await checkCode(user.phone, "MFA", code, now);
  } catch (e) {
    if (e instanceof CodeError) await failed(user, method, e.message);
    throw e;
  }
  return { method, backupLeft: null };
}

/** The fallback: a code by SMS to the phone on their staff record (only when the SMS gateway is live). */
export async function sendSecondFactorSms(user: { id: string; name: string; email: string; phone: string | null; totpEnabledAt: Date | null }) {
  if (!user.totpEnabledAt || !user.phone || codeMode() === "off") throw new TwoFactorError("Text message codes aren't available right now. Use your authenticator app or a backup code.");
  if (!rateLimit(`2fa-sms:${user.id}`, 5, TWO_FACTOR_LIMITS.windowMs)) throw new TwoFactorError("Too many codes asked for. Please wait 15 minutes.");
  try {
    return await issueCode(user.phone, "MFA");
  } catch (e) {
    if (e instanceof CodeError) throw new TwoFactorError(e.message);
    throw e;
  }
}

/** Second step passed: the real session (marked as two-step), optionally a trusted-device cookie. */
export async function completeSignIn(user: SignInUser, pending: { remember: boolean; next: string }, opts: { method: Method | "setup"; trust: boolean }) {
  const jar = await cookies();
  jar.delete(PENDING_COOKIE);
  await createSession(user, { remember: pending.remember, twoFactor: true });
  if (opts.trust) jar.set(trustCookieName(user.id), await signTrust({ sub: user.id, v: user.tokenVersion }), { ...cookieOpts(), maxAge: TRUST_MAX_AGE });
  const how = opts.method === "setup" ? "just set up two-step sign-in" : `two-step: ${METHOD_LABEL[opts.method]}`;
  await audit(db, user, { action: "auth.login", entity: ["User", user.id], summary: `${user.name} signed in (${level(user.role)}, ${how}${opts.trust ? ", device trusted for 30 days" : ""})` });
  return pending.next;
}

// ---------- setting it up, and turning it off ----------

/** Start (or continue) setting up an authenticator app: the key, as a QR code and as text. Nothing changes until confirmed. */
export async function startSetup(userId: string) {
  const u = await loadUser(userId);
  if (!u || !isStaffRole(u.role)) throw new TwoFactorError("Two-step sign-in is for staff accounts.");
  if (u.totpEnabledAt) throw new TwoFactorError("Two-step sign-in is already on.");
  let secret = u.totpPendingSecret ? decryptSecret(u.totpPendingSecret) : null;
  if (!secret) {
    secret = newTotpSecret();
    await db.user.update({ where: { id: u.id }, data: { totpPendingSecret: encryptSecret(secret) } });
  }
  const uri = otpauthUri(secret, u.email, store.name);
  const qr = QRCode.create(uri, { errorCorrectionLevel: "M" }).modules;
  return { secret: secret.match(/.{1,4}/g)!.join(" "), uri, qr: { size: qr.size, cells: Array.from(qr.data, (b) => (b ? "1" : "0")).join("") } };
}

/** The first code from their app proves it's set up: two-step sign-in is on, with 10 fresh backup codes (shown once). */
export async function confirmSetup(userId: string, code: string, now = new Date()) {
  const u = await loadUser(userId);
  if (!u || !isStaffRole(u.role)) throw new TwoFactorError("Two-step sign-in is for staff accounts.");
  if (u.totpEnabledAt) throw new TwoFactorError("Two-step sign-in is already on.");
  if (!u.totpPendingSecret) throw new TwoFactorError("Start the set-up again.");
  await allowTry(u);
  const step = matchTotp(decryptSecret(u.totpPendingSecret), code, now);
  if (step == null) await failed(u, "totp", "That code isn't right. Check the phone's time is set automatically, and type the code showing now.");
  const codes = newBackupCodes();
  const user = await db.$transaction(async (tx) => {
    const done = await tx.user.updateMany({ where: { id: u.id, totpEnabledAt: null, totpPendingSecret: u.totpPendingSecret }, data: { totpSecret: u.totpPendingSecret, totpPendingSecret: null, totpEnabledAt: now, totpLastStep: step } });
    if (!done.count) throw new TwoFactorError("Two-step sign-in was just set up in another window. Sign in again.");
    await tx.twoFactorBackupCode.deleteMany({ where: { userId: u.id } });
    await tx.twoFactorBackupCode.createMany({ data: codes.map((c) => ({ userId: u.id, codeHash: hashBackupCode(u.id, c, pepper()) })) });
    await audit(tx, actorOf(u), { action: "auth.2fa_enabled", entity: ["User", u.id], summary: `${u.name} turned on two-step sign-in (authenticator app, 10 backup codes)` });
    return tx.user.findUniqueOrThrow({ where: { id: u.id }, select: { id: true, name: true, email: true, role: true, tokenVersion: true, twoFactorRequired: true, totpEnabledAt: true } });
  });
  return { codes, user };
}

/** 10 new backup codes (the old ones stop working), after a code from the app. */
export async function regenerateBackupCodes(userId: string, code: string, now = new Date()) {
  const u = await loadUser(userId);
  if (!u?.totpEnabledAt) throw new TwoFactorError("Turn on two-step sign-in first.");
  await verifySecondFactor(u, "totp", code, now);
  const codes = newBackupCodes();
  await db.$transaction(async (tx) => {
    await tx.twoFactorBackupCode.deleteMany({ where: { userId: u.id } });
    await tx.twoFactorBackupCode.createMany({ data: codes.map((c) => ({ userId: u.id, codeHash: hashBackupCode(u.id, c, pepper()) })) });
    await audit(tx, actorOf(u), { action: "auth.2fa_backup_codes", entity: ["User", u.id], summary: `${u.name} made new backup codes (the old ones no longer work)` });
  });
  return codes;
}

const cleared = { totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpPendingSecret: null };

/** Turn it off yourself (only when your level and the owner don't require it), with a code from the app. Signs out other devices. */
export async function disableTwoFactor(userId: string, code: string, now = new Date()) {
  const u = await loadUser(userId);
  if (!u?.totpEnabledAt) throw new TwoFactorError("Two-step sign-in is already off.");
  if (TWO_FACTOR_ROLES.includes(u.role as never) || u.twoFactorRequired) throw new TwoFactorError("Your account must use two-step sign-in. Ask the owner if you need to reset it.");
  await verifySecondFactor(u, "totp", code, now);
  return db.$transaction(async (tx) => {
    await tx.twoFactorBackupCode.deleteMany({ where: { userId: u.id } });
    const user = await tx.user.update({ where: { id: u.id }, data: { ...cleared, tokenVersion: { increment: 1 } }, select: { id: true, role: true, tokenVersion: true } });
    await audit(tx, actorOf(u), { action: "auth.2fa_disabled", entity: ["User", u.id], summary: `${u.name} turned off two-step sign-in (other devices signed out)` });
    return user;
  });
}

/** Owner recovery for a lost phone: two-step sign-in starts again from set-up at their next sign-in. Signs them out everywhere. */
export async function resetTwoFactor(owner: NonNullable<AuditActor>, userId: string, reason: string) {
  if (userId === owner.id) throw new TwoFactorError("Another owner has to reset yours. On your own, sign in with a backup code.");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new TwoFactorError("Say why, for the record.");
  const u = await loadUser(userId);
  if (!u || !isStaffRole(u.role)) throw new TwoFactorError("Not a team member.");
  if (!u.totpEnabledAt && !u.totpPendingSecret) throw new TwoFactorError(`${u.name} hasn't set up two-step sign-in.`);
  await db.$transaction(async (tx) => {
    await tx.twoFactorBackupCode.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: { ...cleared, tokenVersion: { increment: 1 } } });
    await audit(tx, owner, { action: "team.2fa_reset", entity: ["User", userId], summary: `Two-step sign-in reset for ${u.name} (signed out everywhere; sets it up again at next sign-in): ${why}` });
  });
}

/** The owner requires two-step sign-in for one person (managers and owners always need it). Takes effect on their next click. */
export async function setTwoFactorRequired(owner: NonNullable<AuditActor>, userId: string, required: boolean) {
  const u = await loadUser(userId);
  if (!u || !isStaffRole(u.role)) throw new TwoFactorError("Not a team member.");
  if (TWO_FACTOR_ROLES.includes(u.role)) throw new TwoFactorError("Managers and owners always need two-step sign-in.");
  if (u.twoFactorRequired === required) return;
  await db.user.update({ where: { id: userId }, data: { twoFactorRequired: required } });
  await audit(db, owner, { action: "team.2fa_required", entity: ["User", userId], summary: required ? `Two-step sign-in now required for ${u.name}${u.totpEnabledAt ? "" : " (sets it up at next sign-in)"}` : `Two-step sign-in no longer required for ${u.name}` });
}

/** The Security card on /admin/me. */
export async function securityStatus(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, phone: true, twoFactorRequired: true, totpEnabledAt: true } });
  const byLevel = TWO_FACTOR_ROLES.includes(u.role as never);
  return {
    enabledAt: u.totpEnabledAt, backupLeft: u.totpEnabledAt ? await backupCodesLeft(userId) : 0,
    required: byLevel ? ("level" as const) : u.twoFactorRequired ? ("owner" as const) : null,
    sms: !!u.phone && codeMode() !== "off",
  };
}
