import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { googleAuthUrl, googleEnabled } from "@/lib/google";

/** Start "Continue with Google": a random state (in a short-lived cookie) ties the reply to this browser. */
export async function GET(req: NextRequest) {
  if (!googleEnabled()) return NextResponse.redirect(new URL("/login", req.url));
  const next = req.nextUrl.searchParams.get("next") ?? "/account";
  const state = randomBytes(18).toString("base64url");
  const res = NextResponse.redirect(googleAuthUrl(state));
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/auth/google", maxAge: 600 };
  res.cookies.set("g_state", state, opts);
  res.cookies.set("g_next", next.startsWith("/") && !next.startsWith("//") ? next : "/account", opts);
  return res;
}
