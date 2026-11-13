import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { googleEnabled, googleProfile } from "@/lib/google";
import { mergeGuestCart } from "@/lib/cart";
import { isStaffRole } from "@/lib/permissions";
import { store } from "@/lib/config";

/** Google sends the person back here: check the state, get their verified identity, then sign in or create the account. */
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/login?${q}`, req.url));
  if (!googleEnabled()) return back("");
  const state = req.nextUrl.searchParams.get("state"), code = req.nextUrl.searchParams.get("code");
  if (!state || !code || state !== req.cookies.get("g_state")?.value) return back("google=failed");
  const profile = await googleProfile(code).catch(() => null);
  if (!profile) return back("google=failed");

  let user = await db.user.findUnique({ where: { googleSub: profile.sub } }) ?? await db.user.findUnique({ where: { email: profile.email } });
  if (user && isStaffRole(user.role)) return back("google=staff"); // staff sign in with their password
  if (user && !user.googleSub) user = await db.user.update({ where: { id: user.id }, data: { googleSub: profile.sub } });
  if (!user) {
    const welcome = store.loyalty.welcomePoints;
    user = await db.user.create({ data: { name: profile.name.slice(0, 80), email: profile.email, googleSub: profile.sub, passwordHash: await hashPassword(randomBytes(24).toString("hex")), points: welcome, ...(welcome ? { pointsEntries: { create: { delta: welcome, reason: "WELCOME", note: "Welcome to Asson" } } } : {}) } });
  }
  await createSession(user);
  await mergeGuestCart(user.id);
  const next = req.cookies.get("g_next")?.value ?? "/account";
  const res = NextResponse.redirect(new URL(next.startsWith("/") && !next.startsWith("//") ? next : "/account", req.url));
  res.cookies.delete({ name: "g_state", path: "/api/auth/google" });
  res.cookies.delete({ name: "g_next", path: "/api/auth/google" });
  return res;
}
