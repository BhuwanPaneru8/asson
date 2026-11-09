import { vi } from "vitest";
import type { CurrentUser } from "@/lib/auth";

/** The signed-in user server actions will see. Set it with `actAs()`. */
export const session: { user: CurrentUser | null; cookies: Map<string, string> } = { user: null, cookies: new Map() };

export class RedirectError extends Error {
  constructor(public url: string) { super(`NEXT_REDIRECT ${url}`); }
}

vi.mock("next/cache", () => ({
  refresh: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  unstable_cache: <T extends (...a: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new RedirectError(url); },
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (session.cookies.has(k) ? { name: k, value: session.cookies.get(k)! } : undefined),
    set: (k: string, v: string) => void session.cookies.set(k, v),
    delete: (k: string) => void session.cookies.delete(k),
  }),
  headers: async () => new Headers({ "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` }),
}));

// Auth: keep the real permission logic, but take the user from the test session instead of a JWT cookie.
vi.mock("@/lib/auth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth")>();
  const { can, homeFor } = await import("@/lib/permissions");
  const current = async () => session.user;
  const requireStaff = async () => {
    if (!session.user) throw new RedirectError("/login");
    if (session.user.role === "CUSTOMER") throw new RedirectError("/");
    return session.user;
  };
  return {
    ...real,
    getCurrentUser: current,
    requireUser: async () => { if (!session.user) throw new RedirectError("/login"); return session.user; },
    requireStaff,
    requireAdmin: async () => { const u = await requireStaff(); if (u.role !== "ADMIN") throw new RedirectError(homeFor(u.role as never)); return u; },
    requirePermission: async (p: Parameters<typeof can>[1]) => { const u = await requireStaff(); if (!can(u.role, p)) throw new RedirectError(homeFor(u.role as never)); return u; },
    createSession: vi.fn(),
    destroySession: vi.fn(),
  };
});

// `after()` runs work once the response is sent — in tests, run nothing (dispatch is tested directly).
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: vi.fn() }));
