import type { Permission } from "./permissions";
import "server-only";
import { headers } from "next/headers";
import type { Prisma, PrismaClient } from "@prisma/client";
import { clientIp } from "./client-ip";
import { formatPrice } from "./utils";

/**
 * Audit trail: one append-only row per staff change (and security events), written in the SAME
 * transaction as the change whenever there is one — if the record can't be written, the change
 * doesn't happen. Never put secrets (passwords, PINs, tokens, hashes) in `changes`.
 *
 *   await audit(tx, staff, { action: "product.update", entity: ["Product", id], summary: "…", changes })
 */

type Db = PrismaClient | Prisma.TransactionClient;
/** permissions: the person's worked-out access (lib/permissions.ts), when the caller has it (signed-in staff do) */
export type AuditActor = { id: string; name: string; role: string; permissions?: readonly Permission[] } | null;
export type Changes = Record<string, [unknown, unknown]>;

export type AuditEntry = {
  action: string;
  entity: [type: string, id?: string | null];
  summary: string;
  changes?: Changes | Record<string, unknown>;
};

async function requestIp(): Promise<string | null> {
  try {
    const ip = clientIp(await headers());
    return ip === "local" ? null : ip;
  } catch {
    return null; // scripts, cron and tests outside a request
  }
}

export async function audit(db: Db, actor: AuditActor, e: AuditEntry) {
  await db.auditLog.create({
    data: {
      actorId: actor?.id ?? null, actorName: actor?.name ?? "system", actorRole: actor?.role ?? "SYSTEM",
      action: e.action, entityType: e.entity[0], entityId: e.entity[1] ?? null,
      summary: e.summary.slice(0, 500),
      changes: e.changes && Object.keys(e.changes).length ? (JSON.parse(JSON.stringify(e.changes)) as Prisma.InputJsonValue) : undefined,
      ip: await requestIp(),
    },
  });
}

/** Fields stored in paisa, shown as rupees in summaries. */
const MONEY = new Set(["price", "compareAtPrice", "costPrice", "fee", "expressFee", "freeOver", "amount", "value", "minSubtotal", "maxDiscount"]);
/** Owner-only fields: hidden from viewers without the finance permission. */
export const SENSITIVE_FIELDS = new Set(["costPrice", "cost", "landedCost"]);

const show = (k: string, v: unknown) => {
  if (v == null || v === "") return "—";
  if (MONEY.has(k) && typeof v === "number") return formatPrice(v);
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  const s = String(v);
  if (/^[A-Z][A-Z_]+$/.test(s)) return s.toLowerCase().replace(/_/g, " "); // enum values: DRAFT → draft
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

const LABELS: Record<string, string> = { compareAtPrice: "MRP", costPrice: "Cost", categoryId: "Category", details: "Features", material: "Fabric" };
export const fieldLabel = (k: string) => LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, " $1").toLowerCase();

/** Compare chosen fields; returns the changes and a short human summary ("Price Rs. 2,499 → Rs. 2,299; Status draft → active"). */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>, fields: (keyof T & string)[]): { changes: Changes; text: string } {
  const changes: Changes = {};
  for (const f of fields) {
    if (!(f in after)) continue;
    const a = before[f], b = after[f];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) changes[f] = [a ?? null, b ?? null];
  }
  const text = Object.entries(changes)
    .filter(([k]) => !SENSITIVE_FIELDS.has(k))
    .map(([k, [a, b]]) => (k === "description" ? "Description edited" : `${fieldLabel(k)} ${show(k, a)} → ${show(k, b)}`))
    .join("; ");
  return { changes, text };
}

/** Hide owner-only values for viewers without the finance permission. */
export function redactChanges(changes: unknown, canSeeCost: boolean): unknown {
  if (canSeeCost || !changes || typeof changes !== "object") return changes;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SENSITIVE_FIELDS.has(k) ? "hidden" : walk(x)]));
    return v;
  };
  return walk(changes);
}

export const auditShow = show;
