import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session-token";
import { can, effectivePermissions, homeFor, type Permission, type Role } from "./permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  /** staff: their job (lib/permissions.ts JOBS), or null for the classic set for their role */
  job: string | null;
  /** what they can do: job + owner's additions − removals (empty for customers) */
  permissions: Permission[];
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
    select: { id: true, name: true, email: true, phone: true, role: true, tokenVersion: true, job: true, permAdd: true, permRemove: true },
  });
  // tokenVersion lets us revoke every session (password change, staff off-boarding)
  if (!user || user.tokenVersion !== payload.v) return null;
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, job: user.job, permissions: effectivePermissions(user.role, user.job, user.permAdd, user.permRemove) };
});

/** remember: false makes it a browser-session cookie (gone when the browser closes, for a shared computer). */
export async function createSession(user: { id: string; role: CurrentUser["role"]; tokenVersion: number }, opts: { remember?: boolean } = {}) {
  const token = await signSession({ sub: user.id, role: user.role, v: user.tokenVersion });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(opts.remember === false ? {} : { maxAge: SESSION_MAX_AGE }),
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
  if (user.role !== "ADMIN") redirect(homeFor(user));
  return user;
}

/** Gate a page or server action on a single permission (see lib/permissions.ts). */
export async function requirePermission(p: Permission) {
  const user = await requireStaff();
  if (!can(user, p)) redirect(homeFor(user));
  return user;
}
