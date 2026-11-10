import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store as storeCfg } from "./config";
import { ktmDate } from "./pos";
import { canActAt, requireStoreAccess, scopeFor, type Scope } from "./scope";

// The shop operations hub: HQ announcements (with read receipts) and daily checklists per location.
// A checklist run is created on its first tick as a snapshot of the template's items, so editing a template
// never rewrites what a shop did on an earlier day. Ticks lock the run row, so two people ticking at once
// can't lose each other's work.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class OpsError extends Error {}

export type CheckItem = { text: string; doneById?: string | null; doneByName?: string | null; doneAt?: string | null };

// ---------- announcements ----------

export async function publishAnnouncement(tx: Tx, author: Actor, d: { title: string; body: string; storeIds: string[]; requiresAck: boolean; expiresAt?: Date | null }) {
  const scope = await scopeFor(author, tx);
  if (!d.storeIds.length && !scope.all) throw new OpsError("Only HQ can send to every location. Pick your locations.");
  for (const id of d.storeIds) if (!canActAt(scope, id)) throw new OpsError("You can only send to locations you work at.");
  const a = await tx.announcement.create({ data: { ...d, expiresAt: d.expiresAt ?? null, createdById: author.id } });
  await audit(tx, author, { action: "announcement.publish", entity: ["Announcement", a.id], summary: `Announcement “${d.title}” to ${d.storeIds.length ? `${d.storeIds.length} location(s)` : "every location"}` });
  return a;
}

/** Where someone works: every active location for HQ, else their assigned ones. */
async function myStores(user: { id: string; role: string }, scope?: Scope) {
  const s = scope ?? (await scopeFor(user));
  return s.all ? null : s.storeIds; // null = all
}

/** Live announcements this person should see, newest first, with whether they've read each. */
export async function announcementsFor(user: { id: string; role: string }, now = new Date()) {
  const mine = await myStores(user);
  const rows = await db.announcement.findMany({
    where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }], ...(mine ? { OR: [{ storeIds: { isEmpty: true } }, { storeIds: { hasSome: mine } }] } : {}) },
    orderBy: { createdAt: "desc" }, take: 30,
    include: { reads: { where: { userId: user.id }, select: { readAt: true } } },
  });
  return rows.map((a) => ({ id: a.id, title: a.title, body: a.body, requiresAck: a.requiresAck, createdAt: a.createdAt, readAt: a.reads[0]?.readAt ?? null }));
}

export async function acknowledge(tx: Tx, user: Actor, id: string) {
  const a = await tx.announcement.findUnique({ where: { id }, select: { storeIds: true } });
  if (!a) throw new OpsError("Announcement not found.");
  const mine = await myStores(user, await scopeFor(user, tx));
  if (mine && a.storeIds.length && !a.storeIds.some((s) => mine.includes(s))) throw new OpsError("This announcement isn't for your location.");
  await tx.announcementRead.upsert({ where: { announcementId_userId: { announcementId: id, userId: user.id } }, create: { announcementId: id, userId: user.id }, update: {} });
}

/** Who it was for (staff at the targeted locations, plus HQ for "every location") and who has read it. */
export async function readStats(id: string) {
  const a = await db.announcement.findUniqueOrThrow({ where: { id }, include: { reads: { select: { userId: true } } } });
  const staff = await db.user.findMany({
    where: { role: { notIn: ["CUSTOMER"] }, ...(a.storeIds.length ? { OR: [{ allLocations: true }, { role: "ADMIN" }, { locations: { some: { storeId: { in: a.storeIds } } } }] } : {}) },
    select: { id: true, name: true },
  });
  const read = new Set(a.reads.map((r) => r.userId));
  return { total: staff.length, read: staff.filter((s) => read.has(s.id)).length, notRead: staff.filter((s) => !read.has(s.id)).map((s) => s.name) };
}

// ---------- checklists ----------

export async function saveTemplate(tx: Tx, author: Actor, d: { id?: string; name: string; items: string[]; kind: "SHOP" | "WAREHOUSE" | null; dueBy?: string | null; active: boolean }) {
  if (!(await scopeFor(author, tx)).all) throw new OpsError("Checklists apply to the whole network: HQ sets them.");
  const items = d.items.map((t) => t.trim()).filter(Boolean);
  if (!items.length) throw new OpsError("Add at least one item.");
  if (d.dueBy && !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.dueBy)) throw new OpsError("Due time is HH:mm, e.g. 10:30.");
  const data = { name: d.name.trim(), items: items.map((text) => ({ text })), kind: d.kind, dueBy: d.dueBy || null, active: d.active };
  const t = d.id ? await tx.checklistTemplate.update({ where: { id: d.id }, data }) : await tx.checklistTemplate.create({ data });
  await audit(tx, author, { action: "checklist.template", entity: ["ChecklistTemplate", t.id], summary: `Checklist “${data.name}” ${d.id ? "updated" : "created"} (${items.length} items)${d.active ? "" : ", off"}` });
  return t;
}

const templatesFor = (kind: "SHOP" | "WAREHOUSE") => db.checklistTemplate.findMany({ where: { active: true, OR: [{ kind: null }, { kind }] }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

/** Today's checklists at one location: each template with its run (if anything has been ticked yet). */
export async function checklistsAt(storeId: string, date = ktmDate()) {
  const s = await db.store.findUniqueOrThrow({ where: { id: storeId }, select: { kind: true } });
  const [templates, runs] = await Promise.all([templatesFor(s.kind), db.checklistRun.findMany({ where: { storeId, date } })]);
  return templates.map((t) => {
    const run = runs.find((r) => r.templateId === t.id);
    const items = (run?.items as CheckItem[] | undefined) ?? (t.items as CheckItem[]);
    return { templateId: t.id, name: t.name, dueBy: t.dueBy, items, done: items.filter((i) => i.doneAt).length, completedAt: run?.completedAt ?? null };
  });
}

/** Tick or untick one item of today's checklist at a location you work at. */
export async function tick(tx: Tx, user: Actor & { name?: string }, d: { templateId: string; storeId: string; index: number; done: boolean }, date = ktmDate()) {
  await requireStoreAccess(user, d.storeId, tx);
  const t = await tx.checklistTemplate.findUnique({ where: { id: d.templateId } });
  if (!t || !t.active) throw new OpsError("Checklist not found.");
  // create today's run on first touch (snapshot of the items), then lock it
  // (Prisma's upsert isn't atomic: two first ticks at once would both try to insert. ON CONFLICT is.)
  await tx.$executeRaw`INSERT INTO "ChecklistRun" ("id", "templateId", "storeId", "date", "items")
    VALUES (${`cr_${crypto.randomUUID()}`}, ${t.id}, ${d.storeId}, ${date}, ${JSON.stringify(t.items)}::jsonb)
    ON CONFLICT ("templateId", "storeId", "date") DO NOTHING`;
  const [run] = await tx.$queryRaw<{ id: string; items: CheckItem[] }[]>`SELECT "id", "items" FROM "ChecklistRun" WHERE "templateId" = ${t.id} AND "storeId" = ${d.storeId} AND "date" = ${date} FOR UPDATE`;
  const items = run.items;
  if (!(d.index >= 0 && d.index < items.length)) throw new OpsError("That item isn't on this checklist.");
  const name = user.name ?? (await tx.user.findUnique({ where: { id: user.id }, select: { name: true } }))?.name ?? "";
  items[d.index] = d.done ? { text: items[d.index].text, doneById: user.id, doneByName: name, doneAt: new Date().toISOString() } : { text: items[d.index].text };
  const complete = items.every((i) => i.doneAt);
  await tx.checklistRun.update({ where: { id: run.id }, data: { items: items as Prisma.InputJsonValue, completedAt: complete ? new Date() : null } });
  return { done: items.filter((i) => i.doneAt).length, total: items.length, complete };
}

export type ComplianceCell = { templateId: string; done: number; total: number; completedAt: Date | null; late: boolean };

/** Every location × every checklist for a day: what's done, and what's late (past its due time, not complete). */
export async function compliance(date: string, scope: Scope, now = new Date()) {
  const [stores, templates, runs] = await Promise.all([
    db.store.findMany({ where: { active: true, ...(scope.all ? {} : { id: { in: scope.storeIds } }) }, orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true, kind: true } }),
    db.checklistTemplate.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.checklistRun.findMany({ where: { date } }),
  ]);
  const today = ktmDate(now);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: storeCfg.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const dueAt = (dueBy: string) => new Date(`${date}T${dueBy}:00+05:45`);
  return {
    templates: templates.map((t) => ({ id: t.id, name: t.name, dueBy: t.dueBy, kind: t.kind })),
    rows: stores.map((s) => ({
      storeId: s.id, name: s.name, kind: s.kind,
      cells: templates.map((t): ComplianceCell | null => {
        if (t.kind && t.kind !== s.kind) return null;
        const r = runs.find((x) => x.templateId === t.id && x.storeId === s.id);
        const items = (r?.items as CheckItem[] | undefined) ?? (t.items as CheckItem[]);
        const done = r ? items.filter((i) => i.doneAt).length : 0;
        const pastDue = !!t.dueBy && (date < today || (date === today && clock > t.dueBy));
        const late = pastDue && (!r?.completedAt || r.completedAt > dueAt(t.dueBy!));
        return { templateId: t.id, done, total: items.length, completedAt: r?.completedAt ?? null, late };
      }),
    })),
  };
}
