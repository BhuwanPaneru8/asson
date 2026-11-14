// Edge-safe JWT helpers (used by both proxy.ts and server code).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "tl_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** m: this sign-in passed two-step verification (a code, a backup code or a trusted device). */
export type SessionPayload = { sub: string; role: "CUSTOMER" | "CASHIER" | "STAFF" | "MANAGER" | "ADMIN"; v: number; m?: 1 };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return s;
}
const key = () => new TextEncoder().encode(secret());
// two-step tokens use their own key, so one can never pass as a session (or the other way round)
const twoFactorKey = () => new TextEncoder().encode(`two-factor:${secret()}`);

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.aud !== undefined || typeof payload.sub !== "string" || typeof payload.v !== "number") return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ---------- two-step sign-in (lib/two-factor.ts) ----------

/** Between the password and the code: who, which step, for 10 minutes. Not a session. */
export const PENDING_COOKIE = "tl_2fa";
export const PENDING_MAX_AGE = 10 * 60;
export type PendingPayload = { sub: string; v: number; stage: "verify" | "setup"; remember: boolean; next: string };

/** "Trust this device for 30 days": one cookie per person, tied to their tokenVersion. */
export const TRUST_MAX_AGE = 60 * 60 * 24 * 30;
export type TrustPayload = { sub: string; v: number };

const AUD = { pending: "asson:2fa-pending", trust: "asson:2fa-trust" } as const;

async function signTwoFactor(aud: string, payload: Record<string, unknown>, maxAge: number) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setAudience(aud).setIssuedAt().setExpirationTime(`${maxAge}s`).sign(twoFactorKey());
}
async function verifyTwoFactor(aud: string, token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, twoFactorKey(), { algorithms: ["HS256"], audience: aud });
    return typeof payload.sub === "string" && typeof payload.v === "number" ? payload : null;
  } catch {
    return null;
  }
}

export const signPending = (p: PendingPayload) => signTwoFactor(AUD.pending, p, PENDING_MAX_AGE);
export async function verifyPending(token: string | undefined): Promise<PendingPayload | null> {
  const p = await verifyTwoFactor(AUD.pending, token);
  if (!p || (p.stage !== "verify" && p.stage !== "setup") || typeof p.next !== "string") return null;
  return { sub: p.sub as string, v: p.v as number, stage: p.stage, remember: p.remember !== false, next: p.next };
}

export const signTrust = (p: TrustPayload) => signTwoFactor(AUD.trust, p, TRUST_MAX_AGE);
export async function verifyTrust(token: string | undefined): Promise<TrustPayload | null> {
  const p = await verifyTwoFactor(AUD.trust, token);
  return p ? { sub: p.sub as string, v: p.v as number } : null;
}
