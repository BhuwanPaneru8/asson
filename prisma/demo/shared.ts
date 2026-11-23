/**
 * Shared plumbing for the demo seed (prisma/seed.ts and prisma/demo/*).
 *
 * The seed reuses the app's own domain code where it can (tax invoices and credit notes, day closes, payroll,
 * recommendations) so demo documents are numbered and computed exactly as the live system would. Those modules
 * start with `import "server-only"`, which throws outside Next's bundler, so this file stubs it (as the Vitest
 * config does) and hands `src/lib/db` this same client. Import this module FIRST in the seed.
 *
 * History (a year of orders, shifts, stock moves) is written directly with backdated timestamps, because the
 * domain functions stamp "now". It keeps the same invariants: every stock change is an InventoryLog row and
 * StoreStock equals the sum of the ledger; order timelines follow the allowed transitions; append-only tables
 * are only inserted into.
 */
import Module from "node:module";
import { PrismaClient } from "@prisma/client";

const req = Module.createRequire(__filename);
const serverOnly = req.resolve("server-only");
req.cache[serverOnly] = { id: serverOnly, filename: serverOnly, loaded: true, exports: {} } as NodeJS.Module;

export const db = new PrismaClient();
// src/lib/db reuses a client parked here (outside production), so app code and the seed share one pool
(globalThis as unknown as { prisma?: PrismaClient }).prisma = db;

/** The E2E database: demo to-dos that sit in a test's way (pending leave, open shifts) are left out there. */
export const IS_E2E = /asson_e2e/.test(process.env.DATABASE_URL ?? "");

// ---------- deterministic randomness (reproducible seed) ----------
let s = 42;
export const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
export const reseed = (n: number) => { s = n; };
export const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
export const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
export const chance = (p: number) => rand() < p;
/** Pick by weight. */
export function weighted<T>(items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((a, t) => a + weight(t), 0);
  let r = rand() * total;
  for (const t of items) { r -= weight(t); if (r <= 0) return t; }
  return items[items.length - 1];
}

export const slugify = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
export const U = (id: string) => `https://images.unsplash.com/photo-${id}`;

let idN = 0;
/** Ids for rows written in bulk (createMany can't return them). Unique per run, sortable. */
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(idN++).toString(36).padStart(6, "0")}`;

// ---------- time (Nepal is UTC+5:45; no daylight saving) ----------
export const DAY = 86_400_000;
const NPT = 345 * 60_000;
export const NOW = new Date();
/** Nepal calendar date of an instant. */
export const ktm = (d: Date) => new Date(d.getTime() + NPT).toISOString().slice(0, 10);
/** An instant at Nepal wall time `hh:mm` on Nepal date `day`. */
export const at = (day: string, hh: number, mm = 0) => new Date(Date.parse(`${day}T00:00:00Z`) - NPT + (hh * 60 + mm) * 60_000);
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const TODAY = ktm(NOW);
/** Weekday of a Nepal date (0 = Sunday … 6 = Saturday, the weekly day off). */
export const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
export const monthOf = (day: string) => day.slice(0, 7);
export const monthsBack = (n: number) => { const d = new Date(`${TODAY.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 7); };
/** Sunday that starts the roster week of a Nepal date. */
export const weekStartOf = (day: string) => addDays(day, -weekday(day));

/** Insert in chunks (Postgres caps bind values per statement). */
export async function inChunks<T>(rows: T[], size: number, write: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await write(rows.slice(i, i + size));
}

export type Actor = { id: string; name: string; role: string };
