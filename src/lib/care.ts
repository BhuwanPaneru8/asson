import "server-only";
import { randomBytes } from "node:crypto";
import type { CareCategory, CareChannel, CareStatus, IssuePriority, Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store as storeCfg } from "./config";
import { makeT, type Locale } from "./i18n";
import { canActAt, scopeFor, type Scope } from "./scope";

// Customer care: every complaint and order problem, from any channel, in one queue.
//   - customers write from Help or an order page (no sign-in needed) and follow the case at /help/case/<token>
//   - staff log phone, WhatsApp, shop and social cases for the customer
//   - `respondBy` is set whenever the customer is waiting on us and cleared when we reply; past it = overdue
//   - a reply to the customer texts them a link; notes stay internal
//   - HQ (all locations) sees every case; a manager sees cases about their shops; anyone sees what's assigned to them
// Case rows are locked while they change, so a customer reply and a staff reply at the same moment both land.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class CareError extends Error {}

export const careRef = (n: number) => `C-${n}`;
export const CHANNEL_LABEL: Record<CareChannel, string> = { WEB: "Website", PHONE: "Phone", WHATSAPP: "WhatsApp", SHOP: "In a shop", EMAIL: "Email", SOCIAL: "Social media" };
export const CATEGORY_LABEL: Record<CareCategory, string> = { ORDER: "Order", DELIVERY: "Delivery", PAYMENT: "Payment / refund", QUALITY: "Faulty item", EXCHANGE: "Size / exchange", SERVICE: "Shop service", OTHER: "Other" };
export const STATUS_LABEL: Record<CareStatus, string> = { NEW: "New", OPEN: "Open", WAITING: "Waiting for customer", RESOLVED: "Resolved" };
export const UNRESOLVED: CareStatus[] = ["NEW", "OPEN", "WAITING"];

/** 98XXXXXXXX from "+977 98-XXXXXXXX" etc.; null if it isn't a Nepali mobile. */
export function normalisePhone(raw?: string | null) {
  const d = (raw ?? "").replace(/\D/g, "").replace(/^977/, "");
  return /^9[678]\d{8}$/.test(d) ? d : null;
}

const replyDue = (from: Date, p: IssuePriority) => new Date(from.getTime() + storeCfg.care.replyHours[p] * 3_600_000);
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type NewCase = {
  channel: CareChannel; category: CareCategory; priority?: IssuePriority; subject: string; message: string;
  name: string; phone?: string | null; email?: string | null; locale?: Locale;
  userId?: string | null; orderId?: string | null; storeId?: string | null;
};

/**
 * Open a case. `by` is the staff member logging it (phone, shop…); null when the customer wrote in.
 * A second identical submission within 10 minutes (double tap, flaky network) joins the first case instead.
 */
export async function openCase(tx: Tx, d: NewCase, by: Actor | null = null, now = new Date()) {
  const phone = d.phone ? normalisePhone(d.phone) : null;
  if (d.phone && !phone) throw new CareError("Enter a valid mobile number, e.g. 98XXXXXXXX.");
  const email = d.email?.trim().toLowerCase() || null;
  if (!phone && !email) throw new CareError("Enter a valid mobile number, e.g. 98XXXXXXXX.");
  if (by && d.storeId && !canActAt(await scopeFor(by, tx), d.storeId)) throw new CareError("You can only log cases for locations you work at.");
  const priority = d.priority ?? (d.category === "PAYMENT" ? "URGENT" : "NORMAL");

  const dup = await tx.careCase.findFirst({
    where: { status: { in: UNRESOLVED }, category: d.category, subject: d.subject, createdAt: { gte: new Date(now.getTime() - 10 * 60_000) }, ...(phone ? { phone } : { email }) },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (dup && dup.messages[0]?.body === d.message) return dup;

  const c = await tx.careCase.create({
    data: {
      token: randomBytes(18).toString("base64url"), channel: d.channel, category: d.category, priority, subject: d.subject, name: d.name, phone, email,
      locale: d.locale ?? "en", userId: d.userId ?? null, orderId: d.orderId ?? null, storeId: d.storeId ?? null,
      createdById: by?.id ?? null, respondBy: replyDue(now, priority), lastCustomerAt: now, createdAt: now,
      messages: { create: { kind: "CUSTOMER", body: d.message, byName: d.name, byId: null, createdAt: now } },
    },
  });
  if (by) await audit(tx, by, { action: "care.open", entity: ["CareCase", c.id], summary: `${careRef(c.number)} logged (${CHANNEL_LABEL[d.channel]}, ${CATEGORY_LABEL[d.category]}): ${d.subject}` });
  return c;
}

async function lockById(tx: Tx, id: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "CareCase" WHERE "id" = ${id} FOR UPDATE`;
  if (!row) throw new CareError("Case not found.");
  return tx.careCase.findUniqueOrThrow({ where: { id } });
}

/** Staff may act on a case when they see every location, it's about one of their shops, or it's assigned to them. */
const canHandle = (scope: Scope, c: { storeId: string | null; assigneeId: string | null }, userId: string) =>
  scope.all || (!!c.storeId && scope.storeIds.includes(c.storeId)) || c.assigneeId === userId;

async function lockForStaff(tx: Tx, staff: Actor, id: string) {
  const c = await lockById(tx, id);
  if (!canHandle(await scopeFor(staff, tx), c, staff.id)) throw new CareError("This case isn't for your locations.");
  return c;
}

/** The customer writes again (from their case page). Reopens a resolved case within `reopenDays`. */
export async function customerReply(tx: Tx, token: string, body: string, now = new Date()) {
  const found = await tx.careCase.findUnique({ where: { token }, select: { id: true } });
  if (!found) throw new CareError("Case not found.");
  const c = await lockById(tx, found.id);
  if (c.status === "RESOLVED" && c.resolvedAt!.getTime() < now.getTime() - storeCfg.care.reopenDays * 86_400_000) throw new CareError("This request was closed a while ago. Please send a new one from Help.");
  await tx.careMessage.create({ data: { caseId: c.id, kind: "CUSTOMER", body, byName: c.name, createdAt: now } });
  await tx.careCase.update({
    where: { id: c.id },
    data: { lastCustomerAt: now, respondBy: c.respondBy ?? replyDue(now, c.priority), ...(c.status === "NEW" ? {} : { status: "OPEN", resolvedAt: null }) },
  });
}

/** Reply to the customer (they see it and get an SMS). Default: the ball is now with them (WAITING); or resolve. */
export async function replyToCustomer(tx: Tx, staff: Actor, id: string, body: string, opts: { resolve?: boolean } = {}, now = new Date()) {
  const c = await lockForStaff(tx, staff, id);
  if (!body.trim()) throw new CareError("Write the reply.");
  await tx.careMessage.create({ data: { caseId: id, kind: "REPLY", body: body.trim(), byId: staff.id, byName: staff.name, createdAt: now } });
  const status: CareStatus = opts.resolve ? "RESOLVED" : "WAITING";
  await tx.careCase.update({ where: { id }, data: { status, resolvedAt: opts.resolve ? now : null, respondBy: null, firstReplyAt: c.firstReplyAt ?? now, assigneeId: c.assigneeId ?? staff.id } });
  if (c.phone) {
    const t = makeT(storeCfg.smsInNepali && c.locale === "ne" ? "ne" : "en");
    await tx.notification.create({ data: { orderId: c.orderId, channel: "SMS", template: "care_reply", to: c.phone, body: t("sms.care_reply", { store: storeCfg.name, ref: careRef(c.number), link: `${siteUrl()}/help/case/${c.token}` }) } });
  }
  await audit(tx, staff, { action: "care.reply", entity: ["CareCase", id], summary: `${careRef(c.number)}: replied${opts.resolve ? " and resolved" : ""}` });
}

export async function addNote(tx: Tx, staff: Actor, id: string, body: string, now = new Date()) {
  await lockForStaff(tx, staff, id);
  if (!body.trim()) throw new CareError("Write the note.");
  await tx.careMessage.create({ data: { caseId: id, kind: "NOTE", body: body.trim(), byId: staff.id, byName: staff.name, createdAt: now } });
}

export type CaseChange = { status?: CareStatus; assigneeId?: string | null; priority?: IssuePriority; category?: CareCategory; storeId?: string | null; orderNumber?: number | null };

/** Triage: assign, re-prioritise, re-categorise, link the shop or order, change status. Every change is a note on the case. */
export async function updateCase(tx: Tx, staff: Actor, id: string, ch: CaseChange, now = new Date()) {
  const c = await lockForStaff(tx, staff, id);
  const scope = await scopeFor(staff, tx);
  const data: Prisma.CareCaseUncheckedUpdateInput = {};
  const said: string[] = [];
  if (ch.status && ch.status !== c.status) {
    if (ch.status === "NEW") throw new CareError("A case can't go back to new.");
    data.status = ch.status;
    data.resolvedAt = ch.status === "RESOLVED" ? now : null;
    if (ch.status === "RESOLVED" || ch.status === "WAITING") data.respondBy = null;
    said.push(STATUS_LABEL[ch.status]);
  }
  if (ch.assigneeId !== undefined && ch.assigneeId !== c.assigneeId) {
    if (ch.assigneeId) {
      const a = await tx.user.findUnique({ where: { id: ch.assigneeId }, select: { name: true, role: true } });
      if (!a || a.role === "CUSTOMER") throw new CareError("Assign it to a staff member.");
      said.push(`Assigned to ${a.name}`);
    } else said.push("Unassigned");
    data.assigneeId = ch.assigneeId;
  }
  if (ch.priority && ch.priority !== c.priority) {
    data.priority = ch.priority;
    const waiting = (data.respondBy === undefined ? c.respondBy : data.respondBy) as Date | null;
    if (waiting) data.respondBy = replyDue(c.lastCustomerAt, ch.priority);
    said.push(`Priority ${ch.priority.toLowerCase()}`);
  }
  if (ch.category && ch.category !== c.category) { data.category = ch.category; said.push(CATEGORY_LABEL[ch.category]); }
  if (ch.storeId !== undefined && ch.storeId !== c.storeId) {
    if (ch.storeId && !canActAt(scope, ch.storeId)) throw new CareError("You can only link locations you work at.");
    const s = ch.storeId ? await tx.store.findUnique({ where: { id: ch.storeId }, select: { name: true } }) : null;
    if (ch.storeId && !s) throw new CareError("Location not found.");
    data.storeId = ch.storeId;
    said.push(s ? `About ${s.name}` : "Not about a shop");
  }
  if (ch.orderNumber !== undefined) {
    const o = ch.orderNumber ? await tx.order.findUnique({ where: { number: ch.orderNumber }, select: { id: true, phone: true, email: true } }) : null;
    if (ch.orderNumber && !o) throw new CareError("No order with that number.");
    if ((o?.id ?? null) !== c.orderId) {
      data.orderId = o?.id ?? null;
      if (o && !c.userId) { const owner = await tx.order.findUnique({ where: { id: o.id }, select: { userId: true } }); if (owner?.userId) data.userId = owner.userId; }
      said.push(o ? `Order ${storeCfg.orderPrefix}${String(ch.orderNumber).padStart(6, "0")} linked` : "Order unlinked");
    }
  }
  if (!said.length) throw new CareError("Nothing changed.");
  await tx.careCase.update({ where: { id }, data });
  await tx.careMessage.create({ data: { caseId: id, kind: "NOTE", body: said.join(" · "), byId: staff.id, byName: staff.name, createdAt: now } });
  await audit(tx, staff, { action: "care.update", entity: ["CareCase", id], summary: `${careRef(c.number)}: ${said.join(", ")}` });
}

// ---------- reading ----------

export type CareFilter = { view?: "open" | "overdue" | "waiting" | "mine" | "unassigned" | "resolved" | "all"; q?: string; storeId?: string };

function visible(scope: Scope, userId: string): Prisma.CareCaseWhereInput {
  return scope.all ? {} : { OR: [{ storeId: { in: scope.storeIds } }, { assigneeId: userId }] };
}

/** The queue: overdue first, then the longest-waiting. Search by C-number, phone, name, email or order number. */
export async function listCases(user: { id: string; role: string }, f: CareFilter = {}, now = new Date(), take = 200) {
  const scope = await scopeFor(user);
  const v = f.view ?? "open";
  const q = f.q?.trim();
  const digits = q?.replace(/\D/g, "");
  // a case or order number fits in 9 digits; a 10-digit mobile must not be read as one (Postgres INT4 overflows)
  const asNumber = digits && digits.length <= 9 ? Number(digits) : null;
  const search: Prisma.CareCaseWhereInput | null = !q ? null : {
    OR: [
      { name: { contains: q, mode: "insensitive" } }, { email: { contains: q.toLowerCase() } }, { subject: { contains: q, mode: "insensitive" } },
      ...(digits && digits.length >= 4 ? [{ phone: { contains: digits.replace(/^977/, "") } }] : []),
      ...(asNumber && /^(c-?)?\d+$/i.test(q) ? [{ number: asNumber }] : []),
      ...(asNumber && /^[a-z]*\d+$/i.test(q) ? [{ order: { number: asNumber } }] : []),
    ],
  };
  const where: Prisma.CareCaseWhereInput = {
    AND: [
      visible(scope, user.id),
      v === "resolved" ? { status: "RESOLVED" } : v === "all" ? {} : v === "waiting" ? { status: "WAITING" } : { status: { in: ["NEW", "OPEN"] } },
      v === "overdue" ? { respondBy: { lt: now } } : {},
      v === "mine" ? { assigneeId: user.id } : {},
      v === "unassigned" ? { assigneeId: null } : {},
      f.storeId ? { storeId: f.storeId } : {},
      search ?? {},
    ],
  };
  const rows = await db.careCase.findMany({
    where, take, orderBy: v === "resolved" || v === "all" ? { updatedAt: "desc" } : [{ respondBy: { sort: "asc", nulls: "last" } }, { lastCustomerAt: "asc" }],
    include: { assignee: { select: { name: true } }, store: { select: { name: true } }, order: { select: { number: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { kind: true, body: true } } },
  });
  return rows.map((c) => ({ ...c, overdue: !!c.respondBy && c.respondBy < now, last: c.messages[0] ?? null }));
}

export async function caseDetail(user: { id: string; role: string }, number: number) {
  const c = await db.careCase.findUnique({
    where: { number },
    include: { messages: { orderBy: { createdAt: "asc" } }, assignee: { select: { name: true } }, store: { select: { name: true } }, order: { select: { id: true, number: true, total: true, status: true, createdAt: true } }, user: { select: { id: true, name: true, email: true } } },
  });
  if (!c || !canHandle(await scopeFor(user), c, user.id)) return null;
  // the same customer's other cases and orders, so nobody asks them to repeat themselves
  const same: Prisma.CareCaseWhereInput[] = [...(c.phone ? [{ phone: c.phone }] : []), ...(c.email ? [{ email: c.email }] : []), ...(c.userId ? [{ userId: c.userId }] : [])];
  const [history, orders] = await Promise.all([
    db.careCase.findMany({ where: { id: { not: c.id }, OR: same }, orderBy: { createdAt: "desc" }, take: 10, select: { number: true, subject: true, status: true, createdAt: true } }),
    db.order.findMany({ where: { OR: [...(c.phone ? [{ phone: c.phone }] : []), ...(c.email ? [{ email: { equals: c.email, mode: "insensitive" as const } }] : []), ...(c.userId ? [{ userId: c.userId }] : [])] }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, total: true, status: true, createdAt: true, channel: true } }),
  ]);
  return { case: c, history, orders };
}

/** What the customer sees: no internal notes, our staff by first name only. */
export async function caseForCustomer(token: string) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const c = await db.careCase.findUnique({ where: { token }, include: { messages: { where: { kind: { not: "NOTE" } }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, body: true, byName: true, createdAt: true } }, order: { select: { id: true, number: true } } } });
  if (!c) return null;
  return {
    number: c.number, status: c.status, subject: c.subject, createdAt: c.createdAt, resolvedAt: c.resolvedAt, order: c.order,
    messages: c.messages.map((m) => ({ ...m, byName: m.kind === "REPLY" ? m.byName.split(" ")[0] : m.byName })),
  };
}

export const casesForUser = (userId: string) => db.careCase.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20, select: { number: true, token: true, subject: true, status: true, createdAt: true } });

/** Queue health for the last `days`: waiting on us, overdue, median first reply, resolved, by category (all in SQL). */
export async function careStats(scope: Scope, userId: string, days = 30, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000);
  const ids = scope.all ? null : scope.storeIds;
  const [row] = await db.$queryRaw<{ open: number; overdue: number; received: number; resolved: number; median: number | null }[]>`
    SELECT
      COUNT(*) FILTER (WHERE "status" IN ('NEW', 'OPEN'))::int AS "open",
      COUNT(*) FILTER (WHERE "respondBy" < (${now}::timestamptz AT TIME ZONE 'UTC'))::int AS "overdue",
      COUNT(*) FILTER (WHERE "createdAt" >= (${since}::timestamptz AT TIME ZONE 'UTC'))::int AS "received",
      COUNT(*) FILTER (WHERE "createdAt" >= (${since}::timestamptz AT TIME ZONE 'UTC') AND "status" = 'RESOLVED')::int AS "resolved",
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("firstReplyAt" - "createdAt")) / 3600)
        FILTER (WHERE "createdAt" >= (${since}::timestamptz AT TIME ZONE 'UTC') AND "firstReplyAt" IS NOT NULL))::float AS "median"
    FROM "CareCase"
    WHERE (${ids}::text[] IS NULL OR "storeId" = ANY(${ids}::text[]) OR "assigneeId" = ${userId})`;
  const byCategory = await db.$queryRaw<{ category: CareCategory; n: number }[]>`
    SELECT "category", COUNT(*)::int AS "n" FROM "CareCase"
    WHERE "createdAt" >= (${since}::timestamptz AT TIME ZONE 'UTC') AND (${ids}::text[] IS NULL OR "storeId" = ANY(${ids}::text[]) OR "assigneeId" = ${userId})
    GROUP BY "category" ORDER BY "n" DESC`;
  return { open: row.open, overdue: row.overdue, received: row.received, resolved: row.resolved, medianFirstReplyHours: row.median, byCategory: byCategory.map((c) => [c.category, c.n] as [CareCategory, number]) };
}
