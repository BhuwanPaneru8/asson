import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session-token";
import { can, homeFor, type Permission, type Role, type StaffRole } from "./permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
};

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

/** Resolve the signed-in user once per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const payload = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, phone: true, role: true, tokenVersion: true },
  });
  // tokenVersion lets us revoke every session (password change, staff off-boarding)
  if (!user || user.tokenVersion !== payload.v) return null;
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
});

export async function createSession(user: { id: string; role: CurrentUser["role"]; tokenVersion: number }) {
  const token = await signSession({ sub: user.id, role: user.role, v: user.tokenVersion });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function requireUser(next = "/account") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role === "CUSTOMER") redirect("/");
  return user;
}

export async function requireAdmin() {
  const user = await requireStaff();
  if (user.role !== "ADMIN") redirect(homeFor(user.role as StaffRole));
  return user;
}

/** Gate a page or server action on a single permission (see lib/permissions.ts). */
export async function requirePermission(p: Permission) {
  const user = await requireStaff();
  if (!can(user.role, p)) redirect(homeFor(user.role as StaffRole));
  return user;
}
