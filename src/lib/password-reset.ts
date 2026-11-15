import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { store } from "./config";
import { openCase } from "./care";
import type { Locale } from "./i18n";

// Forgotten passwords for shoppers, when the SMS code isn't available (no gateway yet, or an email account):
//  1. a one-time link by email (1 hour), once an email service is connected (RESEND_API_KEY + EMAIL_FROM);
//     staging and tests show the link on screen instead, as they do with SMS codes;
//  2. otherwise one tap asks customer care, who check it's them by phone and send a one-time link
//     (Customers → Reset link). The link is the same one-time reset token either way (lib/team.ts redeemResetLink).
// Staff never use these: the owner sends them a new sign-in link from Team & access.

export type EmailMode = "email" | "test" | "off";

export function emailMode(): EmailMode {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "email";
  if (process.env.AUTH_CODES_TEST === "1" || process.env.ASSON_ENV === "staging" || process.env.NODE_ENV !== "production") return "test";
  return "off";
}

/** Phone-only sign-ups get a placeholder address that can't receive mail. */
export const realEmail = (email: string | null | undefined): email is string => !!email && !email.endsWith("@phone.asson.local");

/** s***@gmail.com: enough to recognise, not enough to harvest. */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(name.length - 1, 6)))}@${domain}`;
}

export class ResetError extends Error {}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LINK_MINUTES = 60;

/** Email a one-time link to set a new password. At most 3 per account per hour; a new link cancels older ones. */
export async function emailResetLink(user: { id: string; name: string; email: string }, now = new Date()): Promise<{ sentTo: string; testLink?: string }> {
  const mode = emailMode();
  if (mode === "off" || !realEmail(user.email)) throw new ResetError("Reset by email isn't available for this account. Ask us to reset it instead.");
  const recent = await db.staffInvite.count({ where: { userId: user.id, purpose: "RESET", createdById: user.id, createdAt: { gt: new Date(now.getTime() - 3_600_000) } } });
  if (recent >= 3) throw new ResetError("We've sent 3 reset links in the last hour. Check your inbox (and spam), or wait a little.");
  const token = randomBytes(24).toString("base64url");
  const link = `${siteUrl()}/reset/${token}`;
  await db.$transaction(async (tx) => {
    await tx.staffInvite.updateMany({ where: { userId: user.id, purpose: "RESET", usedAt: null }, data: { expiresAt: now } });
    // createdById is the customer: they asked for it themselves
    await tx.staffInvite.create({ data: { userId: user.id, purpose: "RESET", tokenHash: sha(token), expiresAt: new Date(now.getTime() + LINK_MINUTES * 60_000), createdById: user.id } });
  });
  if (mode === "test") return { sentTo: maskEmail(user.email), testLink: link };

  const first = user.name.split(" ")[0] || "there";
  const subject = `Reset your ${store.name} password`;
  const text = `Hi ${first},\n\nSomeone (hopefully you) asked to reset the password for your ${store.name} account. Open this link within ${LINK_MINUTES} minutes to choose a new one:\n\n${link}\n\nIf you didn't ask, ignore this email: your password stays the same. Never share this link.\n\n${store.name}`;
  const note = await db.notification.create({ data: { channel: "EMAIL", template: "reset_link", to: user.email, body: text.replace(link, `${siteUrl()}/reset/…`), status: "SENDING", attempts: 1, claimedAt: now } });
  const r = await sendEmail(user.email, subject, text).catch((e) => ({ ok: false as const, error: String(e) }));
  await db.notification.update({ where: { id: note.id }, data: r.ok ? { status: "SENT", sentAt: new Date(), provider: "resend", providerRef: r.ref ?? null } : { status: "FAILED", provider: "resend", error: r.error.slice(0, 300) } });
  if (!r.ok) throw new ResetError("We couldn't send the email just now. Try again in a minute, or ask us to reset it.");
  return { sentTo: maskEmail(user.email) };
}

async function sendEmail(to: string, subject: string, text: string): Promise<{ ok: true; ref?: string } | { ok: false; error: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const j = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, ref: j.id };
}

export const RESET_SUBJECT = "Password reset request";

/** No SMS or email: ask customer care, who check it's them and send a reset link. One open request per account. */
export async function askCareForReset(user: { id: string; name: string; phone: string | null; email: string }, locale: Locale) {
  const open = await db.careCase.findFirst({ where: { userId: user.id, subject: RESET_SUBJECT, status: { in: ["NEW", "OPEN", "WAITING"] } }, select: { number: true } });
  if (open) return { number: open.number, already: true };
  const c = await db.$transaction((tx) => openCase(tx, {
    channel: "WEB", category: "OTHER", subject: RESET_SUBJECT, locale,
    message: `Forgot their password and asked for a reset from the sign-in page. Call or WhatsApp ${user.phone ?? "them"} to check it's them, then send a one-time link from Customers → Reset link.`,
    name: user.name, phone: user.phone, email: realEmail(user.email) ? user.email : null, userId: user.id,
  }));
  return { number: c.number, already: false };
}
