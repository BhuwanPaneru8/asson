"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createSession, getCurrentUser, requirePermission, requireStaff } from "@/lib/auth";
import { dispatchNotifications } from "@/lib/notifications";
import { mergeGuestCart } from "@/lib/cart";
import { isStaffRole } from "@/lib/permissions";
import {
  completeSignIn, confirmSetup, disableTwoFactor, pendingSignIn, regenerateBackupCodes, resetTwoFactor, sendSecondFactorSms,
  setTwoFactorRequired, startSetup, TwoFactorError, verifySecondFactor,
} from "@/lib/two-factor";

// Two-step sign-in (lib/two-factor.ts): the second step after the password (/login/two-factor), setting it up
// (there, or from My account & security), and the owner's controls in Team & access.

type Fail = { ok: false; error: string };
const fail = (e: unknown): Fail => {
  if (e instanceof TwoFactorError) return { ok: false, error: e.message };
  throw e;
};
const codeSchema = z.string().trim().min(6).max(20);

/** Who is setting it up: someone halfway through signing in who must set it up, or a signed-in staff member. */
async function setupSubject() {
  const p = await pendingSignIn();
  if (p?.stage === "setup") return { userId: p.user.id, pending: p };
  const me = await getCurrentUser();
  if (me && isStaffRole(me.role)) return { userId: me.id, pending: null };
  return null;
}

/** The second step: a code from the app, an SMS code or a backup code. On success, signed in and on to where they were going. */
export async function verifyTwoFactor(input: { method: "totp" | "sms" | "backup"; code: string; trust?: boolean }): Promise<Fail> {
  const parsed = z.object({ method: z.enum(["totp", "sms", "backup"]), code: codeSchema, trust: z.boolean().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Type the code." };
  const p = await pendingSignIn();
  if (!p || p.stage !== "verify") return { ok: false, error: "Your sign-in timed out. Please start again." };
  let next: string;
  try {
    await verifySecondFactor(p.user, parsed.data.method, parsed.data.code);
    next = await completeSignIn(p.user, p, { method: parsed.data.method, trust: !!parsed.data.trust });
  } catch (e) {
    return fail(e);
  }
  await mergeGuestCart(p.user.id);
  redirect(next);
}

export async function sendTwoFactorSms(): Promise<{ ok: true; testCode?: string } | Fail> {
  const p = await pendingSignIn();
  if (!p || p.stage !== "verify") return { ok: false, error: "Your sign-in timed out. Please start again." };
  try {
    const r = await sendSecondFactorSms(p.user);
    after(() => dispatchNotifications(10).catch(() => {}));
    return { ok: true, ...r };
  } catch (e) {
    return fail(e);
  }
}

export async function beginTotpSetup(): Promise<{ ok: true; secret: string; uri: string; qr: { size: number; cells: string } } | Fail> {
  const who = await setupSubject();
  if (!who) return { ok: false, error: "Your sign-in timed out. Please start again." };
  try {
    return { ok: true, ...(await startSetup(who.userId)) };
  } catch (e) {
    return fail(e);
  }
}

/** Confirm with the first code. Returns the 10 backup codes (shown once) and, during sign-in, where to go next. */
export async function finishTotpSetup(input: { code: string; trust?: boolean }): Promise<{ ok: true; codes: string[]; next: string } | Fail> {
  const code = codeSchema.safeParse(input.code);
  if (!code.success) return { ok: false, error: "Type the 6-digit code from your app." };
  const who = await setupSubject();
  if (!who) return { ok: false, error: "Your sign-in timed out. Please start again." };
  try {
    const { codes, user } = await confirmSetup(who.userId, code.data);
    // signed in now, with two-step sign-in passed (this session, from My account, keeps working too)
    const next = who.pending ? await completeSignIn(user, who.pending, { method: "setup", trust: !!input.trust }) : "/admin/me";
    if (!who.pending) await createSession(user, { twoFactor: true });
    return { ok: true, codes, next };
  } catch (e) {
    return fail(e);
  }
}

export async function newBackupCodes(input: { code: string }): Promise<{ ok: true; codes: string[] } | Fail> {
  const me = await requireStaff();
  const code = codeSchema.safeParse(input.code);
  if (!code.success) return { ok: false, error: "Type the 6-digit code from your app." };
  try {
    return { ok: true, codes: await regenerateBackupCodes(me.id, code.data) };
  } catch (e) {
    return fail(e);
  }
}

export async function turnOffTwoFactor(input: { code: string }): Promise<{ ok: true } | Fail> {
  const me = await requireStaff();
  const code = codeSchema.safeParse(input.code);
  if (!code.success) return { ok: false, error: "Type the 6-digit code from your app." };
  try {
    const user = await disableTwoFactor(me.id, code.data);
    await createSession(user); // other devices were signed out; this one stays
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true };
}

// ---------- the owner, in Team & access ----------

export async function resetMemberTwoFactor(input: { userId: string; reason: string }): Promise<{ ok: true } | Fail> {
  const owner = await requirePermission("team.manage");
  const d = z.object({ userId: z.string().min(1).max(40), reason: z.string().max(200) }).safeParse(input);
  if (!d.success) return { ok: false, error: "Say why, for the record." };
  try {
    await resetTwoFactor(owner, d.data.userId, d.data.reason);
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true };
}

export async function requireMemberTwoFactor(input: { userId: string; required: boolean }): Promise<{ ok: true } | Fail> {
  const owner = await requirePermission("team.manage");
  const d = z.object({ userId: z.string().min(1).max(40), required: z.boolean() }).safeParse(input);
  if (!d.success) return { ok: false, error: "Something went wrong. Try again." };
  try {
    await setTwoFactorRequired(owner, d.data.userId, d.data.required);
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true };
}
