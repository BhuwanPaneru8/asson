import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";

// Error tracking without a third-party service: every captured error is grouped by fingerprint
// (where it happened + its message with ids and numbers blanked out) and counted, so the owner sees
// "this broke 37 times since Tuesday", not 37 rows. Shown at Admin → System.
//
// Privacy: never pass request bodies, headers, query strings, phone numbers or addresses in
// `context`. Messages are truncated; paths are stored without their query string.

export type ErrorSource = "server" | "action" | "job" | "client";

/** Blank out the parts of a message that change between occurrences of the same bug. */
export function normaliseMessage(message: string) {
  return message
    .replace(/\b[cC][a-z0-9]{20,30}\b/g, ":id") // cuid
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ":uuid")
    .replace(/\d+/g, "#")
    .slice(0, 300);
}

export function fingerprint(source: ErrorSource, where: string, message: string) {
  return createHash("sha1").update(`${source}|${where}|${normaliseMessage(message)}`).digest("hex");
}

function describe(err: unknown) {
  if (err instanceof Error) return { message: err.message || err.name, stack: err.stack ?? null, digest: "digest" in err ? String((err as { digest?: unknown }).digest ?? "") || null : null };
  return { message: typeof err === "string" ? err : JSON.stringify(err)?.slice(0, 500) ?? String(err), stack: null, digest: null };
}

/**
 * Log and record an error. Never throws: a broken error tracker must not break the request.
 * Use for anything caught that a human should eventually look at.
 */
export async function reportError(where: string, err: unknown, opts: { source?: ErrorSource; context?: Record<string, string | number | boolean | null> } = {}) {
  console.error(where, err);
  const source = opts.source ?? "action";
  const d = describe(err);
  const message = d.message.slice(0, 500);
  try {
    await db.errorEvent.upsert({
      where: { fingerprint: fingerprint(source, where, message) },
      create: { fingerprint: fingerprint(source, where, message), source, where: where.slice(0, 200), message, stack: d.stack?.slice(0, 4000), digest: d.digest, context: opts.context ?? undefined },
      // a fixed bug that comes back reopens its group
      update: { count: { increment: 1 }, lastSeen: new Date(), resolvedAt: null, resolvedBy: null, message, stack: d.stack?.slice(0, 4000), digest: d.digest, context: opts.context ?? undefined },
    });
  } catch (e) {
    console.error("reportError: could not record", e);
  }
}

/** Fire-and-forget form for places that can't await (promise chains, after()). */
export function reportErrorSoon(where: string) {
  return (err: unknown) => void reportError(where, err);
}
