import "server-only";
import type { IssueCategory, IssuePriority, IssueStatus, Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store as storeCfg } from "./config";
import { can, type Role } from "./permissions";
import { canActAt, requireStoreAccess, scopeFor, type Scope } from "./scope";
import { isMediaUrl } from "./media-url";
import { formatPrice } from "./utils";

// Issue reports from locations to HQ: broken equipment, maintenance, safety, IT.
// Who can do what:
//   - anyone working at a location reports issues there, sees them, comments, and reopens a resolved one
//   - ops.manage over that location (a manager for their shops, HQ for all) assigns, changes priority/status, records cost
//   - the assignee (a maintenance person, an IT contractor's account) sees what's assigned and moves its status
// Every change writes a timeline event; each issue row is locked while it changes, so two people acting at
// once both land in order instead of one silently overwriting the other.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class IssueError extends Error {}

export const CATEGORY_LABEL: Record<IssueCategory, string> = { EQUIPMENT: "Equipment", BUILDING: "Building", IT: "IT / internet", SAFETY: "Safety", STOCK: "Stock / delivery", OTHER: "Other" };
export const STATUS_LABEL: Record<IssueStatus, string> = { OPEN: "Open", IN_PROGRESS: "Being fixed", ON_HOLD: "On hold", RESOLVED: "Resolved" };
export const UNRESOLVED: IssueStatus[] = ["OPEN", "IN_PROGRESS", "ON_HOLD"];
export const issueRef = (n: number) => `ISS-${n}`;

function checkPhotos(photos: string[]) {
  if (photos.length > 6) throw new IssueError("Up to 6 photos.");
  for (const p of photos) if (!isMediaUrl(p)) throw new IssueError("Upload photos with the photo button.");
}

export const dueFrom = (from: Date, priority: IssuePriority) => new Date(from.getTime() + storeCfg.issues.dueHours[priority] * 3_600_000);

/** Lock the row, then decide what this person may do with it. */
async function load(tx: Tx, user: Actor, id: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Issue" WHERE "id" = ${id} FOR UPDATE`;
  if (!row) throw new IssueError("Issue not found.");
  const issue = await tx.issue.findUniqueOrThrow({ where: { id } });
  const scope = await scopeFor(user, tx);
  const here = canActAt(scope, issue.storeId);
  const manages = here && can(user, "ops.manage");
  const assigned = issue.assigneeId === user.id;
  if (!here && !assigned) throw new IssueError("This issue isn't at your location.");
  return { issue, here, manages, assigned };
}

async function event(tx: Tx, issueId: string, by: Actor, d: { message: string; status?: IssueStatus; photos?: string[] }) {
  await tx.issueEvent.create({ data: { issueId, byId: by.id, byName: by.name, message: d.message, status: d.status ?? null, photos: d.photos ?? [] } });
}

export async function reportIssue(tx: Tx, user: Actor, d: { storeId: string; category: IssueCategory; priority: IssuePriority; title: string; description: string; photos: string[] }, now = new Date()) {
  await requireStoreAccess(user, d.storeId, tx);
  checkPhotos(d.photos);
  const issue = await tx.issue.create({ data: { ...d, createdById: user.id, dueAt: dueFrom(now, d.priority), createdAt: now } });
  await event(tx, issue.id, user, { message: "Reported", status: "OPEN", photos: d.photos });
  await audit(tx, user, { action: "issue.report", entity: ["Issue", issue.id], summary: `${issueRef(issue.number)} reported (${d.priority.toLowerCase()}, ${CATEGORY_LABEL[d.category]}): ${d.title}` });
  return issue;
}

/** A note on the timeline, optionally with photos. The first one from anyone but the reporter counts as HQ's response. */
export async function comment(tx: Tx, user: Actor, id: string, d: { message: string; photos: string[] }, now = new Date()) {
  const { issue } = await load(tx, user, id);
  checkPhotos(d.photos);
  if (!d.message.trim() && !d.photos.length) throw new IssueError("Write something or add a photo.");
  await event(tx, id, user, { message: d.message.trim(), photos: d.photos });
  const photos = [...issue.photos, ...d.photos].slice(0, 6);
  await tx.issue.update({ where: { id }, data: { photos, ...(issue.respondedAt || user.id === issue.createdById ? {} : { respondedAt: now }) } });
}

export type IssueChange = { status?: IssueStatus; assigneeId?: string | null; priority?: IssuePriority; cost?: number; note?: string };

/**
 * Change status / assignee / priority / cost. Managers of the location can change anything; the assignee can
 * move the status. Resolving needs a note saying what was done. Changing priority moves the due time
 * (counted from when it was reported).
 */
export async function updateIssue(tx: Tx, user: Actor, id: string, c: IssueChange, now = new Date()) {
  const { issue, manages, assigned } = await load(tx, user, id);
  if (!manages && !assigned) throw new IssueError("Only the location's manager, HQ or the assignee can change this.");
  if (!manages && (c.assigneeId !== undefined || c.priority !== undefined || c.cost !== undefined)) throw new IssueError("Only a manager or HQ can assign, re-prioritise or record cost.");
  const note = c.note?.trim() ?? "";
  const data: Prisma.IssueUncheckedUpdateInput = {};
  const said: string[] = [];

  if (c.status && c.status !== issue.status) {
    if (c.status === "RESOLVED" && !note) throw new IssueError("Say what was done to fix it.");
    data.status = c.status;
    data.resolvedAt = c.status === "RESOLVED" ? now : null;
    if (c.status !== "RESOLVED" && issue.status === "RESOLVED") { data.escalatedAt = null; data.dueAt = dueFrom(now, c.priority ?? issue.priority); }
    said.push(STATUS_LABEL[c.status]);
  }
  if (c.assigneeId !== undefined && c.assigneeId !== issue.assigneeId) {
    if (c.assigneeId) {
      const a = await tx.user.findUnique({ where: { id: c.assigneeId }, select: { name: true, role: true } });
      if (!a || a.role === "CUSTOMER") throw new IssueError("Assign it to an active staff member.");
      said.push(`Assigned to ${a.name}`);
    } else said.push("Unassigned");
    data.assigneeId = c.assigneeId;
  }
  if (c.priority && c.priority !== issue.priority) {
    data.priority = c.priority;
    if (!data.dueAt) data.dueAt = dueFrom(issue.createdAt, c.priority);
    if ((data.dueAt as Date) > now) data.escalatedAt = null;
    said.push(`Priority ${c.priority.toLowerCase()}`);
  }
  if (c.cost !== undefined && c.cost !== issue.cost) {
    if (!Number.isInteger(c.cost) || c.cost < 0) throw new IssueError("Cost can't be negative.");
    data.cost = c.cost;
    said.push(`Cost ${formatPrice(c.cost)}`);
  }
  if (!said.length && !note) throw new IssueError("Nothing changed.");
  if (!issue.respondedAt && user.id !== issue.createdById) data.respondedAt = now;

  await tx.issue.update({ where: { id }, data });
  await event(tx, id, user, { message: [said.join(" · "), note].filter(Boolean).join(": "), status: data.status as IssueStatus | undefined });
  await audit(tx, user, { action: "issue.update", entity: ["Issue", id], summary: `${issueRef(issue.number)}: ${said.join(", ") || "note"}${note ? ` (${note.slice(0, 120)})` : ""}` });
}

/** Someone at the location says it's still broken: back to open with a fresh due time. */
export async function reopenIssue(tx: Tx, user: Actor, id: string, why: string, now = new Date()) {
  const { issue, here } = await load(tx, user, id);
  if (!here) throw new IssueError("Only people at the location can reopen it.");
  if (issue.status !== "RESOLVED") throw new IssueError("It's still open.");
  if (!why.trim()) throw new IssueError("Say what's still wrong.");
  await tx.issue.update({ where: { id }, data: { status: "OPEN", resolvedAt: null, escalatedAt: null, dueAt: dueFrom(now, issue.priority) } });
  await event(tx, id, user, { message: `Reopened: ${why.trim()}`, status: "OPEN" });
  await audit(tx, user, { action: "issue.reopen", entity: ["Issue", id], summary: `${issueRef(issue.number)} reopened: ${why.trim().slice(0, 120)}` });
}

/** Background job: flag issues that passed their due time while unresolved (once each), so HQ sees them first. */
export async function escalateOverdue(now = new Date()) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; number: number }[]>`
      UPDATE "Issue" SET "escalatedAt" = (${now}::timestamptz AT TIME ZONE 'UTC'), "updatedAt" = (${now}::timestamptz AT TIME ZONE 'UTC')
      WHERE "status" IN ('OPEN', 'IN_PROGRESS', 'ON_HOLD') AND "escalatedAt" IS NULL
        AND "dueAt" < (${now}::timestamptz AT TIME ZONE 'UTC')
      RETURNING "id", "number"`;
    if (rows.length) await tx.issueEvent.createMany({ data: rows.map((r) => ({ issueId: r.id, byId: null, byName: "System", message: "Overdue: flagged to HQ", photos: [] })) });
    return { escalated: rows.length };
  });
}

// ---------- reading ----------

export type IssueFilter = { status?: "open" | "resolved" | "all"; storeId?: string; mine?: boolean; overdue?: boolean };

/** Issues this person can see: their locations' (HQ: all) plus anything assigned to them. Overdue first, then urgent, then oldest. */
export async function listIssues(user: { id: string; role: string }, f: IssueFilter = {}, now = new Date(), take = 200) {
  const scope = await scopeFor(user);
  const visible: Prisma.IssueWhereInput = scope.all ? {} : { OR: [{ storeId: { in: scope.storeIds } }, { assigneeId: user.id }] };
  const where: Prisma.IssueWhereInput = {
    AND: [
      visible,
      f.status === "resolved" ? { status: "RESOLVED" } : f.status === "all" ? {} : { status: { in: UNRESOLVED } },
      f.storeId ? { storeId: f.storeId } : {},
      f.mine ? { assigneeId: user.id } : {},
      f.overdue ? { status: { in: UNRESOLVED }, dueAt: { lt: now } } : {},
    ],
  };
  const rows = await db.issue.findMany({ where, take, orderBy: [{ createdAt: "desc" }], include: { store: { select: { name: true } }, assignee: { select: { name: true } } } });
  const rank = { URGENT: 0, NORMAL: 1, LOW: 2 };
  return rows
    .map((i) => ({ ...i, overdue: UNRESOLVED.includes(i.status) && i.dueAt < now }))
    .sort((a, b) => (a.status === "RESOLVED" ? 1 : 0) - (b.status === "RESOLVED" ? 1 : 0) || Number(b.overdue) - Number(a.overdue) || rank[a.priority] - rank[b.priority] || +a.createdAt - +b.createdAt);
}

export async function issueDetail(user: { id: string; role: string }, number: number) {
  const issue = await db.issue.findUnique({ where: { number }, include: { store: { select: { name: true } }, createdBy: { select: { name: true } }, assignee: { select: { name: true } }, events: { orderBy: { createdAt: "asc" } } } });
  if (!issue) return null;
  const scope = await scopeFor(user);
  const here = canActAt(scope, issue.storeId);
  if (!here && issue.assigneeId !== user.id) return null;
  const since = new Date(issue.createdAt.getTime() - storeCfg.issues.repeatWindowDays * 86_400_000);
  const repeats = await db.issue.count({ where: { storeId: issue.storeId, category: issue.category, id: { not: issue.id }, createdAt: { gte: since, lte: issue.createdAt } } });
  return { issue, repeats, here, manages: here && can(user, "ops.manage"), assigned: issue.assigneeId === user.id };
}

/** Per-location numbers for HQ: open, overdue, resolved in the window, median hours to fix, repair spend. */
export async function issueStats(scope: Scope, days = 30, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000);
  const ids = scope.all ? null : scope.storeIds;
  const rows = await db.$queryRaw<{ storeId: string; name: string; open: number; overdue: number; resolved: number; medianHours: number | null; cost: number }[]>`
    SELECT s."id" AS "storeId", s."name",
      COUNT(*) FILTER (WHERE i."status" <> 'RESOLVED')::int AS "open",
      COUNT(*) FILTER (WHERE i."status" <> 'RESOLVED' AND i."dueAt" < (${now}::timestamptz AT TIME ZONE 'UTC'))::int AS "overdue",
      COUNT(*) FILTER (WHERE i."resolvedAt" >= (${since}::timestamptz AT TIME ZONE 'UTC'))::int AS "resolved",
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (i."resolvedAt" - i."createdAt")) / 3600)
        FILTER (WHERE i."resolvedAt" >= (${since}::timestamptz AT TIME ZONE 'UTC')))::float AS "medianHours",
      COALESCE(SUM(i."cost") FILTER (WHERE i."resolvedAt" >= (${since}::timestamptz AT TIME ZONE 'UTC')), 0)::int AS "cost"
    FROM "Issue" i JOIN "Store" s ON s."id" = i."storeId"
    WHERE (${ids}::text[] IS NULL OR i."storeId" = ANY(${ids}::text[]))
      AND (i."status" <> 'RESOLVED' OR i."resolvedAt" >= (${since}::timestamptz AT TIME ZONE 'UTC'))
    GROUP BY s."id", s."name"
    ORDER BY "overdue" DESC, "open" DESC, s."name"`;
  return rows;
}

/** For the Today page: unresolved issues at a location, and how many are overdue. */
export async function openIssuesAt(storeId: string, now = new Date()) {
  const rows = await db.issue.findMany({ where: { storeId, status: { in: UNRESOLVED } }, orderBy: { createdAt: "asc" }, select: { number: true, title: true, status: true, priority: true, dueAt: true } });
  return rows.map((r) => ({ ...r, overdue: r.dueAt < now }));
}
