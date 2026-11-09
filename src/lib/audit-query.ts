import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

/** Groups the owner can filter by. Each maps to action prefixes (or exact actions). */
export const AUDIT_GROUPS: Record<string, { label: string; actions: string[] }> = {
  security: { label: "Security alerts", actions: ["auth.login_failed", "auth.login_blocked", "auth.pin_failed", "user.role", "auth.password_changed", "auth.pin_set"] },
  catalog: { label: "Products & prices", actions: ["product.", "catalog.", "media.", "review."] },
  stock: { label: "Stock", actions: ["stock.", "po.receive"] },
  orders: { label: "Orders", actions: ["order."] },
  money: { label: "Money", actions: ["order.paid", "cod.", "return.", "expense.", "pos.discount", "shift.close", "day.lock"] },
  till: { label: "Shop till", actions: ["pos.", "shift.", "day.", "return."] },
  purchasing: { label: "Purchasing", actions: ["po.", "supplier."] },
  settings: { label: "Coupons & delivery", actions: ["coupon.", "delivery."] },
  team: { label: "Team & sign-ins", actions: ["auth.", "user."] },
};

export const SECURITY_ACTIONS = ["auth.login_failed", "auth.login_blocked", "auth.pin_failed"];

export type ActivityFilter = { group?: string; actor?: string; q?: string; from?: string; to?: string; entityType?: string; entityId?: string };

const ktmStart = (d: string) => new Date(`${d}T00:00:00+05:45`);
const ktmEnd = (d: string) => new Date(`${d}T23:59:59.999+05:45`);
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function activityWhere(f: ActivityFilter): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  const g = f.group ? AUDIT_GROUPS[f.group] : undefined;
  if (g) and.push({ OR: g.actions.map((a) => (a.endsWith(".") ? { action: { startsWith: a } } : { action: a })) });
  if (f.actor) and.push({ actorId: f.actor });
  if (f.entityType) and.push({ entityType: f.entityType });
  if (f.entityId) and.push({ entityId: f.entityId });
  if (isDate(f.from)) and.push({ at: { gte: ktmStart(f.from!) } });
  if (isDate(f.to)) and.push({ at: { lte: ktmEnd(f.to!) } });
  if (f.q?.trim()) and.push({ OR: [{ summary: { contains: f.q.trim(), mode: "insensitive" } }, { actorName: { contains: f.q.trim(), mode: "insensitive" } }, { ip: f.q.trim() }] });
  return and.length ? { AND: and } : {};
}

/** Newest first, keyset-paginated (stable under new inserts): pass the last row's id as `before`. */
export async function getActivity(f: ActivityFilter, opts: { take?: number; before?: string } = {}) {
  const take = Math.min(opts.take ?? 50, 200);
  const cursor = opts.before ? await db.auditLog.findUnique({ where: { id: opts.before }, select: { at: true, id: true } }) : null;
  const where = activityWhere(f);
  const rows = await db.auditLog.findMany({
    where: cursor ? { AND: [where, { OR: [{ at: { lt: cursor.at } }, { at: cursor.at, id: { lt: cursor.id } }] }] } : where,
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: take + 1,
  });
  return { rows: rows.slice(0, take), more: rows.length > take };
}

export function entityHref(type: string, id: string | null): string | null {
  switch (type) {
    case "Product": return id ? `/admin/products/${id}` : "/admin/products";
    case "Order": return id ? `/admin/orders/${id}` : "/admin/orders";
    case "PurchaseOrder": return id ? `/admin/purchasing/${id}` : "/admin/purchasing";
    case "Supplier": return "/admin/suppliers";
    case "Coupon": return "/admin/coupons";
    case "DeliveryRate": return "/admin/delivery";
    case "Expense": return "/admin/finance";
    case "CodRemittance": return "/admin/cod";
    case "Shift": case "DayClose": return "/admin/closing";
    case "User": return "/admin/customers";
    default: return null;
  }
}
