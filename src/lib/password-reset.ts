import "server-only";
import { db } from "./db";
import { store } from "./config";
import { openCase } from "./care";
import { codeMode, codeSms, createCode, maskPhone } from "./sign-in";
import type { Locale } from "./i18n";

// Forgotten passwords for shoppers: a 6-digit code (10 minutes, 5 tries) to the shopper's choice of
//  - SMS to their mobile, once an SMS gateway is connected (NOTIFY_SMS_PROVIDER; lib/notifications.ts),
//  - WhatsApp to their mobile, once WhatsApp Business is connected (WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID +
//    WHATSAPP_RESET_TEMPLATE, an approved "authentication" template; see deploy/README.md),
//  - email, once an email service is connected (RESEND_API_KEY + EMAIL_FROM), real addresses only.
// Staging and tests show the code on screen instead of sending it, as they do with sign-in codes. With none
// connected, one tap asks customer care, who check it's them by phone and send a one-time link (Customers → Reset
// link, lib/team.ts redeemResetLink). Every reset code is for the account (`reset:<userId>`), whichever way it went,
// so a newer code cancels older ones and the 3-per-10-minutes limit covers all three ways together.
// Staff never use these: the owner sends them a new sign-in link from Team & access.

export type SendMode = "live" | "test" | "off";
export type ResetVia = "sms" | "whatsapp" | "email";

const testMode = () => process.env.AUTH_CODES_TEST === "1" || process.env.ASSON_ENV === "staging" || process.env.NODE_ENV !== "production";

export function emailMode(): SendMode {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "live";
  return testMode() ? "test" : "off";
}

export function whatsappMode(): SendMode {
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_RESET_TEMPLATE) return "live";
  return testMode() ? "test" : "off";
}

const smsMode = (): SendMode => ({ sms: "live", test: "test", off: "off" } as const)[codeMode()];

/** Phone-only sign-ups get a placeholder address that can't receive mail. */
export const realEmail = (email: string | null | undefined): email is string => !!email && !email.endsWith("@phone.asson.local");

/** s***@gmail.com: enough to recognise, not enough to harvest. */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(name.length - 1, 6)))}@${domain}`;
}

export class ResetError extends Error {}

type Account = { id: string; name: string; email: string; phone: string | null };

/** Where a reset code can go for this account right now, each shown masked. Empty: ask customer care. */
export function resetChannels(user: Account): Partial<Record<ResetVia, string>> {
  const out: Partial<Record<ResetVia, string>> = {};
  if (user.phone && smsMode() !== "off") out.sms = maskPhone(user.phone);
  if (user.phone && whatsappMode() !== "off") out.whatsapp = maskPhone(user.phone);
  if (realEmail(user.email) && emailMode() !== "off") out.email = maskEmail(user.email);
  return out;
}

export const resetTarget = (userId: string) => `reset:${userId}`;

/** Send a reset code the chosen way. Returns where it went (masked) and, in test mode, the code itself. */
export async function sendResetCode(user: Account, via: ResetVia, now = new Date()): Promise<{ sentTo: string; testCode?: string }> {
  const sentTo = resetChannels(user)[via];
  if (!sentTo) throw new ResetError("We can't send a code that way for this account. Choose another way, or ask us to reset it.");
  const mode = via === "sms" ? smsMode() : via === "whatsapp" ? whatsappMode() : emailMode();
  const target = resetTarget(user.id);
  if (mode === "test") return { sentTo, testCode: await createCode(target, "RESET", now) };
  if (via === "sms") {
    // queued with the code, sent by the dispatcher (retries included)
    await createCode(target, "RESET", now, (tx, code) => tx.notification.create({ data: { channel: "SMS", template: "reset_code", to: user.phone!, body: codeSms("RESET", code) } }).then(() => {}));
    return { sentTo };
  }
  const code = await createCode(target, "RESET", now);
  const to = via === "whatsapp" ? user.phone! : user.email;
  const first = user.name.split(" ")[0] || "there";
  const text = via === "email"
    ? `Hi ${first},\n\n${code} is your code to reset the password for your ${store.name} account. It expires in 10 minutes.\n\nIf you didn't ask, ignore this email: your password stays the same. Never share this code, not even with us.\n\n${store.name}`
    : codeSms("RESET", code);
  // the message log never keeps a working code
  const note = await db.notification.create({ data: { channel: via === "email" ? "EMAIL" : "WHATSAPP", template: "reset_code", to, body: text.replace(code, "••••••"), status: "SENDING", attempts: 1, claimedAt: now } });
  const r = await (via === "email" ? sendEmail(to, `${code} is your ${store.name} reset code`, text) : sendWhatsApp(to, code)).catch((e) => ({ ok: false as const, error: String(e) }));
  const provider = via === "email" ? "resend" : "whatsapp";
  await db.notification.update({ where: { id: note.id }, data: r.ok ? { status: "SENT", sentAt: new Date(), provider, providerRef: r.ref ?? null } : { status: "FAILED", provider, error: r.error.slice(0, 300) } });
  if (!r.ok) throw new ResetError("We couldn't send the code just now. Try again in a minute, choose another way, or ask us to reset it.");
  return { sentTo };
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

/**
 * WhatsApp Business (Meta Cloud API): codes must go in an approved "authentication" template, whose body holds
 * the code and whose copy-code button repeats it. Numbers are sent as 977XXXXXXXXXX.
 */
async function sendWhatsApp(phone: string, code: string): Promise<{ ok: true; ref?: string } | { ok: false; error: string }> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: `977${phone}`,
      type: "template",
      template: {
        name: process.env.WHATSAPP_RESET_TEMPLATE,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return { ok: false, error: `WhatsApp ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const j = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[] };
  return { ok: true, ref: j.messages?.[0]?.id };
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
