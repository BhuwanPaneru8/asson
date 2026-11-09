import { PrismaClient } from "@prisma/client";

/**
 * Connection pool per app instance: DB_POOL_SIZE (default 20) unless the URL already sets
 * `connection_limit`. Prisma's own default (2 × CPU cores + 1) is too small on little servers.
 * Behind PgBouncer, keep it at or below what the bouncer allows per instance.
 * PRISMA_LOG=query prints every SQL statement (debugging only — never leave on in production).
 */
function databaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", process.env.DB_POOL_SIZE ?? "20");
  if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
  return url.toString();
}

// Reuse a single client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // no URL at build time (CI bundles are built without a database): let Prisma read the env when it first connects
    ...(databaseUrl() ? { datasources: { db: { url: databaseUrl() } } } : {}),
    log: process.env.PRISMA_LOG === "query" ? ["query", "warn", "error"] : process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
