import "server-only";

// "Continue with Google" (OpenID Connect, authorization-code flow). Switched on by setting GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET (a free OAuth client in Google Cloud Console, redirect URI
// <site>/api/auth/google/callback). Until then the button doesn't appear. Staff can't use it: they sign in with
// their password so every staff sign-in is recorded.

export const googleEnabled = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
export const googleRedirectUri = () => `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/auth/google/callback`;

export function googleAuthUrl(state: string) {
  const p = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: googleRedirectUri(), response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export type GoogleProfile = { sub: string; email: string; name: string };

/** Swap the one-time code for the person's verified Google identity (checked by Google's own token endpoint). */
export async function googleProfile(code: string): Promise<GoogleProfile | null> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: googleRedirectUri(), grant_type: "authorization_code" }),
  });
  if (!tokenRes.ok) return null;
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) return null;
  const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`);
  if (!info.ok) return null;
  const c = (await info.json()) as { aud?: string; iss?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string; exp?: string };
  const verified = c.email_verified === true || c.email_verified === "true";
  if (c.aud !== process.env.GOOGLE_CLIENT_ID || !["accounts.google.com", "https://accounts.google.com"].includes(c.iss ?? "") || !c.sub || !c.email || !verified) return null;
  if (c.exp && Number(c.exp) * 1000 < Date.now()) return null;
  return { sub: c.sub, email: c.email.toLowerCase(), name: c.name ?? c.email.split("@")[0] };
}
