// Two-step sign-in building blocks with no database or Next.js: authenticator codes (TOTP, RFC 6238), backup
// codes, and encryption of the secret at rest. Pure so unit tests and the E2E seed script can use them; the
// sign-in rules are in lib/two-factor.ts.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const TOTP_PERIOD = 30; // seconds
export const TOTP_DIGITS = 6;
/** Codes from one step either side are accepted too (phone clocks drift a little). */
export const TOTP_WINDOW = 1;
export const BACKUP_CODE_COUNT = 10;

// ---------- base32 (RFC 4648), the format authenticator apps take ----------

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("Not a base32 secret");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret, base32 (what the QR code and the "enter this key" text carry). */
export const newTotpSecret = () => base32Encode(randomBytes(20));

// ---------- TOTP ----------

export const totpStep = (at: number | Date = Date.now()) => Math.floor((typeof at === "number" ? at : at.getTime()) / 1000 / TOTP_PERIOD);

/** The 6-digit code for one 30-second step (HOTP with HMAC-SHA1, as every authenticator app does). */
export function totpAt(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const off = h[h.length - 1] & 15;
  const n = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(n % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export const totpNow = (secret: string, at: number | Date = Date.now()) => totpAt(secret, totpStep(at));

/**
 * The step a typed code belongs to, or null when it's wrong. Only steps after `lastStep` count, so a code
 * can't be used twice (someone looking over a shoulder can't reuse it).
 */
export function matchTotp(secret: string, code: string, at: number | Date = Date.now(), lastStep: number | null = null): number | null {
  const typed = code.replace(/\D/g, "");
  if (typed.length !== TOTP_DIGITS) return null;
  const now = totpStep(at);
  let found: number | null = null;
  // check every step in the window (no early exit), comparing in constant time
  for (let s = now - TOTP_WINDOW; s <= now + TOTP_WINDOW; s++) {
    if (timingSafeEqual(Buffer.from(totpAt(secret, s)), Buffer.from(typed)) && (lastStep == null || s > lastStep) && found == null) found = s;
  }
  return found;
}

/** What the QR code holds: otpauth://totp/Asson:sita@asson.com.np?secret=…&issuer=Asson */
export function otpauthUri(secret: string, account: string, issuer: string) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

// ---------- backup codes ----------

const BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i

/** 10 one-time codes like "k7m2p-x9qat" (about 49 bits each). */
export function newBackupCodes(n = BACKUP_CODE_COUNT) {
  return Array.from({ length: n }, () => {
    const c = Array.from({ length: 10 }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]).join("");
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
}

/** "K7M2P X9QAT" → "k7m2px9qat": case, spaces and dashes don't matter. */
export const normaliseBackupCode = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const looksLikeBackupCode = (s: string) => normaliseBackupCode(s).length === 10;

/** Keyed hash of a backup code for one person (a stolen table alone can't be checked offline). */
export function hashBackupCode(userId: string, code: string, pepper: string) {
  return createHmac("sha256", pepper).update(`2fa-backup:${userId}:${normaliseBackupCode(code)}`).digest("hex");
}

// ---------- encryption of the secret at rest ----------

/**
 * AES-256-GCM. The key comes from TWO_FACTOR_KEY (any string of 32+ characters, hashed to 256 bits). Without it
 * (development, tests, or a server not yet given one) a key is derived from AUTH_SECRET instead; each stored
 * value says which key it used ("k" or "a"), so adding TWO_FACTOR_KEY later keeps existing secrets readable.
 */
export type KeyEnv = { TWO_FACTOR_KEY?: string; AUTH_SECRET?: string; [k: string]: string | undefined };

function keys(env: KeyEnv) {
  const k = env.TWO_FACTOR_KEY && env.TWO_FACTOR_KEY.length >= 32 ? createHash("sha256").update(env.TWO_FACTOR_KEY).digest() : null;
  const a = env.AUTH_SECRET ? createHash("sha256").update(`asson-two-factor:${env.AUTH_SECRET}`).digest() : null;
  return { k, a };
}

export function encryptSecret(plain: string, env: KeyEnv = process.env) {
  const { k, a } = keys(env);
  const kid = k ? "k" : "a";
  const key = k ?? a;
  if (!key) throw new Error("TWO_FACTOR_KEY (or AUTH_SECRET) must be set to store two-step sign-in secrets");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", kid, iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}

export function decryptSecret(stored: string, env: KeyEnv = process.env) {
  const [v, kid, iv, tag, ct] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unknown two-step secret format");
  const key = keys(env)[kid as "k" | "a"];
  if (!key) throw new Error(kid === "k" ? "TWO_FACTOR_KEY is missing: two-step sign-in secrets can't be read" : "AUTH_SECRET is missing");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
