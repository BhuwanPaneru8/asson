import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { smsProvider } from "./notifications";
import { store } from "./config";
import type { Identifier } from "./sign-in-shared";
export { parseIdentifier, type Identifier } from "./sign-in-shared";

// Sign-in for shoppers and staff (the forms are in components/account/auth-panel.tsx, the actions in
// actions/auth.ts). One field takes a mobile number or an email; the system finds the account and offers what
// fits: a password, a one-time code by SMS, or a new account. One-time codes are 6 digits, stored only as a keyed
// hash, valid 10 minutes, 5 tries, at most 3 sent per number per 10 minutes.
//
// Codes travel by SMS. Until a real SMS gateway is connected (NOTIFY_SMS_PROVIDER), production offers no codes
// (password only); staging and tests run in TEST mode, where the code is shown on screen instead of sent.

export type CodeMode = "sms" | "test" | "off";

/** How one-time codes reach people right now. */
export function codeMode(): CodeMode {
  const p = smsProvider();
  if (p && p.name !== "log") return "sms";
  if (process.env.AUTH_CODES_TEST === "1" || process.env.ASSON_ENV === "staging" || process.env.NODE_ENV !== "production") return "test";
  return "off";
}

/** The account behind a phone or email. A phone shared by several accounts can't sign in by phone (use the email). */
export async function findAccount(id: Identifier) {
  const select = { id: true, name: true, email: true, phone: true, role: true, tokenVersion: true, passwordHash: true, twoFactorRequired: true, totpEnabledAt: true } as const;
  if (id.kind === "email") return { user: await db.user.findUnique({ where: { email: id.value }, select }), ambiguous: false };
  const users = await db.user.findMany({ where: { phone: id.value }, select, take: 2 });
  return { user: users.length === 1 ? users[0] : null, ambiguous: users.length > 1 };
}

const secret = () => process.env.AUTH_SECRET ?? "dev-secret";
const hashCode = (target: string, purpose: string, code: string) => createHmac("sha256", secret()).update(`${purpose}:${target}:${code}`).digest("hex");

export class CodeError extends Error {}

/** Send (or, in test mode, return) a fresh code. Older unused codes for the same number stop working. */
export type CodePurpose = "LOGIN" | "RESET" | "MFA";
const CODE_TEXT: Record<CodePurpose, { template: string; what: string }> = {
  LOGIN: { template: "login_code", what: "sign-in" },
  RESET: { template: "reset_code", what: "password reset" },
  MFA: { template: "two_factor_code", what: "staff sign-in" }, // the second step for staff (lib/two-factor.ts)
};

export async function issueCode(target: string, purpose: CodePurpose, now = new Date()): Promise<{ testCode?: string }> {
  const mode = codeMode();
  if (mode === "off") throw new CodeError("Codes by SMS aren't available yet. Use your password, or contact us to reset it.");
  const code = await createCode(target, purpose, now, mode === "sms"
    ? (tx, c) => tx.notification.create({ data: { channel: "SMS", template: CODE_TEXT[purpose].template, to: target, body: codeSms(purpose, c) } }).then(() => {})
    : undefined);
  return mode === "test" ? { testCode: code } : {};
}

export const codeSms = (purpose: CodePurpose, code: string) => `${store.name}: ${code} is your ${CODE_TEXT[purpose].what} code. It expires in 10 minutes. Never share it, not even with us.`;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * A fresh 6-digit code for `target` (a phone, an email, or `reset:<userId>`), stored only as a keyed hash. Older
 * unused codes for the same target and purpose stop working; at most 3 per target per 10 minutes. `queue` runs in
 * the same transaction (to queue the SMS); the caller sends anything else. Returns the code.
 */
export async function createCode(target: string, purpose: CodePurpose, now = new Date(), queue?: (tx: Tx, code: string) => Promise<void>): Promise<string> {
  const recent = await db.loginCode.count({ where: { target, createdAt: { gt: new Date(now.getTime() - 10 * 60_000) } } });
  if (recent >= 3) throw new CodeError("We've sent 3 codes in the last 10 minutes. Please wait a little before asking for another.");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.$transaction(async (tx) => {
    await tx.loginCode.updateMany({ where: { target, purpose, usedAt: null }, data: { expiresAt: now } });
    await tx.loginCode.create({ data: { target, purpose, codeHash: hashCode(target, purpose, code), expiresAt: new Date(now.getTime() + 10 * 60_000) } });
    if (queue) await queue(tx, code);
  });
  return code;
}

/** 98******67: enough to recognise, not enough to harvest. */
export const maskPhone = (phone: string) => `${phone.slice(0, 2)}${"*".repeat(Math.max(0, phone.length - 4))}${phone.slice(-2)}`;

/** True when the code is right; uses it up. Wrong tries count; after 5 the code stops working. */
export async function checkCode(target: string, purpose: CodePurpose, code: string, now = new Date()) {
  const c = await db.loginCode.findFirst({ where: { target, purpose, usedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" } });
  if (!c) throw new CodeError("That code has expired. Ask for a new one.");
  if (c.attempts >= 5) throw new CodeError("Too many wrong tries. Ask for a new code.");
  const a = Buffer.from(c.codeHash, "hex"), b = Buffer.from(hashCode(target, purpose, code.replace(/\D/g, "")), "hex");
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    await db.loginCode.update({ where: { id: c.id }, data: { attempts: { increment: 1 } } });
    throw new CodeError(c.attempts + 1 >= 5 ? "Too many wrong tries. Ask for a new code." : "That code isn't right. Check the message and try again.");
  }
  const used = await db.loginCode.updateMany({ where: { id: c.id, usedAt: null }, data: { usedAt: now } });
  if (!used.count) throw new CodeError("That code was just used. Ask for a new one.");
  return true;
}
