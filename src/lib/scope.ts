import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

// Which locations a staff member may ACT at: tills and closing, stock adjustments, receiving,
// transfers, counts and picking. The owner (ADMIN) and staff marked "all locations" (HQ) act
// everywhere; everyone else only at the shops and warehouses they're assigned to. Seeing stock at
// other locations stays allowed (to tell a customer where something is); changing it does not.
// Every action checks this on the server: hiding a button is not security.

type Reader = PrismaClient | Prisma.TransactionClient;
export type Scope = { all: true } | { all: false; storeIds: string[] };
export type ScopedUser = { id: string; role: string };

export class ScopeError extends Error {}

export async function scopeFor(user: ScopedUser, reader: Reader = db): Promise<Scope> {
  if (user.role === "ADMIN") return { all: true };
  const u = await reader.user.findUnique({ where: { id: user.id }, select: { allLocations: true, locations: { select: { storeId: true } } } });
  if (u?.allLocations) return { all: true };
  return { all: false, storeIds: u?.locations.map((l) => l.storeId) ?? [] };
}

export const canActAt = (scope: Scope, storeId: string) => scope.all || scope.storeIds.includes(storeId);

/** Prisma filter for the locations someone may act at. */
export const storeFilter = (scope: Scope): Prisma.StoreWhereInput => (scope.all ? {} : { id: { in: scope.storeIds } });

/** Throw a readable error unless the user may act at this location. */
export async function requireStoreAccess(user: ScopedUser, storeId: string, reader: Reader = db) {
  const scope = await scopeFor(user, reader);
  if (canActAt(scope, storeId)) return scope;
  const s = await reader.store.findUnique({ where: { id: storeId }, select: { name: true } });
  throw new ScopeError(`You're not assigned to ${s?.name ?? "that location"}. Ask the owner to add you under Customers & team.`);
}

/** For "either end" actions (e.g. a transfer): allowed if the user works at any of these locations. */
export async function requireAnyStoreAccess(user: ScopedUser, storeIds: string[], reader: Reader = db) {
  const scope = await scopeFor(user, reader);
  if (storeIds.some((id) => canActAt(scope, id))) return scope;
  throw new ScopeError("You're not assigned to any location involved here.");
}
