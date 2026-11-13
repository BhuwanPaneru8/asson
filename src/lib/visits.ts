import "server-only";
import type { Prisma, VisitStatus } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store as storeCfg } from "./config";
import { isMediaUrl } from "./media-url";
import { can, type Role } from "./permissions";
import { canActAt, requireStoreAccess, scopeFor, type Scope } from "./scope";

// Store visit audits. An area manager (ops.manage over the shop) or HQ walks a shop with a template:
// every item is answered pass / fail / n/a as they go (saved per item, so a dropped phone loses nothing).
// Submitting scores it (passes ÷ answered, n/a left out) and turns every fail into an action the shop must
// fix by a date (sooner if critical). Someone at the shop other than the auditor acknowledges the visit.
// The shop marks actions done with a note/photo; the auditor or HQ verifies or sends them back.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class VisitError extends Error {}

export type TemplateSection = { name: string; items: { text: string; critical?: boolean }[] };
export type VisitItem = { section: string; text: string; critical: boolean; result?: "PASS" | "FAIL" | "NA"; note?: string; photos?: string[] };
export const visitRef = (n: number) => `SV-${n}`;
export const STATUS_LABEL: Record<VisitStatus, string> = { DRAFT: "In progress", SUBMITTED: "Waiting for the shop", ACKNOWLEDGED: "Acknowledged" };

const managesShop = async (user: Actor, storeId: string, tx: Tx) => can(user, "ops.manage") && canActAt(await scopeFor(user, tx), storeId);

export async function saveTemplate(tx: Tx, author: Actor, d: { id?: string; name: string; sections: TemplateSection[]; active: boolean }) {
  if (!(await scopeFor(author, tx)).all || !can(author, "ops.manage")) throw new VisitError("Visit checklists are set by HQ.");
  const sections = d.sections
    .map((s) => ({ name: s.name.trim(), items: s.items.map((i) => ({ text: i.text.trim(), ...(i.critical ? { critical: true } : {}) })).filter((i) => i.text) }))
    .filter((s) => s.name && s.items.length);
  if (!sections.length) throw new VisitError("Add at least one section with items.");
  if (sections.reduce((n, s) => n + s.items.length, 0) > 150) throw new VisitError("Up to 150 items.");
  const data = { name: d.name.trim(), sections, active: d.active };
  const t = d.id ? await tx.visitTemplate.update({ where: { id: d.id }, data }) : await tx.visitTemplate.create({ data });
  await audit(tx, author, { action: "visit.template", entity: ["VisitTemplate", t.id], summary: `Visit checklist “${data.name}” ${d.id ? "updated" : "created"} (${sections.reduce((n, s) => n + s.items.length, 0)} items)` });
  return t;
}

/** Start a walk-through. One draft per shop at a time (a unique index makes a double tap safe). */
export async function startVisit(tx: Tx, auditor: Actor, d: { templateId: string; storeId: string }, now = new Date()) {
  if (!(await managesShop(auditor, d.storeId, tx))) throw new VisitError("Only HQ or an area manager over this shop can visit it.");
  const shop = await tx.store.findUnique({ where: { id: d.storeId }, select: { kind: true, active: true, name: true } });
  if (!shop || shop.kind !== "SHOP" || !shop.active) throw new VisitError("Visits are for active shops.");
  const t = await tx.visitTemplate.findUnique({ where: { id: d.templateId } });
  if (!t || !t.active) throw new VisitError("Checklist not found.");
  // lock the shop row so two people starting at once queue up (the partial unique index is the backstop)
  await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id" = ${d.storeId} FOR UPDATE`;
  const existing = await tx.storeVisit.findFirst({ where: { storeId: d.storeId, status: "DRAFT" }, select: { number: true, auditorName: true } });
  if (existing) throw new VisitError(`${existing.auditorName} already has a visit in progress here (${visitRef(existing.number)}). Finish or delete it first.`);
  const items: VisitItem[] = (t.sections as TemplateSection[]).flatMap((s) => s.items.map((i) => ({ section: s.name, text: i.text, critical: !!i.critical })));
  try {
    return await tx.storeVisit.create({ data: { templateId: t.id, storeId: d.storeId, auditorId: auditor.id, auditorName: auditor.name, items, startedAt: now } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new VisitError("A visit is already in progress at this shop.");
    throw e;
  }
}

async function lockVisit(tx: Tx, id: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "StoreVisit" WHERE "id" = ${id} FOR UPDATE`;
  if (!row) throw new VisitError("Visit not found.");
  return tx.storeVisit.findUniqueOrThrow({ where: { id } });
}

/** Answer one item during the walk-through (only the auditor, only while it's a draft). */
export async function answer(tx: Tx, auditor: Actor, id: string, index: number, a: { result: "PASS" | "FAIL" | "NA" | null; note?: string; photos?: string[] }) {
  const v = await lockVisit(tx, id);
  if (v.auditorId !== auditor.id) throw new VisitError("Only the person doing the visit can fill it in.");
  if (v.status !== "DRAFT") throw new VisitError("This visit has been submitted.");
  const items = v.items as VisitItem[];
  if (!(index >= 0 && index < items.length)) throw new VisitError("That item isn't on this visit.");
  const photos = a.photos ?? items[index].photos ?? [];
  if (photos.length > 4 || photos.some((p) => !isMediaUrl(p))) throw new VisitError("Up to 4 photos per item, from the photo button.");
  items[index] = { section: items[index].section, text: items[index].text, critical: items[index].critical, ...(a.result ? { result: a.result } : {}), note: (a.note ?? items[index].note ?? "").slice(0, 1000), photos };
  await tx.storeVisit.update({ where: { id }, data: { items } });
  return items[index];
}

export const scoreOf = (items: VisitItem[]) => {
  const pass = items.filter((i) => i.result === "PASS").length, fail = items.filter((i) => i.result === "FAIL").length;
  return pass + fail ? Math.round((pass / (pass + fail)) * 100) : null;
};

/** Finish the visit: every item answered, every fail explained; fails become actions with due dates. */
export async function submitVisit(tx: Tx, auditor: Actor, id: string, summary: string, now = new Date()) {
  const v = await lockVisit(tx, id);
  if (v.auditorId !== auditor.id) throw new VisitError("Only the person doing the visit can submit it.");
  if (v.status !== "DRAFT") throw new VisitError("Already submitted.");
  const items = v.items as VisitItem[];
  const open = items.filter((i) => !i.result).length;
  if (open) throw new VisitError(`${open} item(s) still to answer.`);
  const unexplained = items.filter((i) => i.result === "FAIL" && !i.note?.trim()).length;
  if (unexplained) throw new VisitError(`Say what's wrong for ${unexplained} failed item(s).`);
  const score = scoreOf(items);
  const fails = items.map((it, index) => ({ it, index })).filter(({ it }) => it.result === "FAIL");
  const day = 86_400_000;
  await tx.storeVisit.update({ where: { id }, data: { status: "SUBMITTED", submittedAt: now, score, criticalFails: fails.filter(({ it }) => it.critical).length, summary: summary.trim().slice(0, 4000) } });
  if (fails.length) await tx.visitAction.createMany({ data: fails.map(({ it, index }) => ({ visitId: id, storeId: v.storeId, itemIndex: index, text: `${it.section}: ${it.text}`, note: it.note ?? "", critical: it.critical, dueAt: new Date(now.getTime() + (it.critical ? storeCfg.visits.criticalFixDays : storeCfg.visits.fixDays) * day), createdAt: now })) });
  await audit(tx, auditor, { action: "visit.submit", entity: ["StoreVisit", id], summary: `${visitRef(v.number)} submitted: ${score ?? "—"}%, ${fails.length} to fix (${fails.filter(({ it }) => it.critical).length} critical)` });
  return { score, actions: fails.length };
}

/** The auditor gives up on a draft (wrong shop, wrong checklist). Submitted visits are never deleted. */
export async function discardDraft(tx: Tx, auditor: Actor, id: string) {
  const v = await lockVisit(tx, id);
  if (v.status !== "DRAFT") throw new VisitError("Submitted visits are kept.");
  if (v.auditorId !== auditor.id && !(await scopeFor(auditor, tx)).all) throw new VisitError("Only the person doing the visit can delete it.");
  await tx.storeVisit.delete({ where: { id } });
  await audit(tx, auditor, { action: "visit.discard", entity: ["StoreVisit", id], summary: `${visitRef(v.number)} draft deleted` });
}

/** Someone at the shop (not the auditor) confirms they've read the visit and its actions. */
export async function acknowledge(tx: Tx, user: Actor, id: string, note: string, now = new Date()) {
  const v = await lockVisit(tx, id);
  await requireStoreAccess(user, v.storeId, tx);
  if (v.auditorId === user.id) throw new VisitError("Someone at the shop, not the auditor, acknowledges the visit.");
  if (v.status !== "SUBMITTED") throw new VisitError(v.status === "DRAFT" ? "The visit isn't finished yet." : "Already acknowledged.");
  await tx.storeVisit.update({ where: { id }, data: { status: "ACKNOWLEDGED", ackById: user.id, ackByName: user.name, ackAt: now, ackNote: note.trim().slice(0, 2000) } });
}

/** The shop says an action is fixed (note required, photo optional). */
export async function completeAction(tx: Tx, user: Actor, actionId: string, d: { note: string; photos: string[] }, now = new Date()) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "VisitAction" WHERE "id" = ${actionId} FOR UPDATE`;
  if (!row) throw new VisitError("Action not found.");
  const a = await tx.visitAction.findUniqueOrThrow({ where: { id: actionId } });
  await requireStoreAccess(user, a.storeId, tx);
  if (a.status !== "OPEN") throw new VisitError("Already marked fixed.");
  if (!d.note.trim()) throw new VisitError("Say what was done.");
  if (d.photos.length > 4 || d.photos.some((p) => !isMediaUrl(p))) throw new VisitError("Up to 4 photos, from the photo button.");
  await tx.visitAction.update({ where: { id: actionId }, data: { status: "DONE", doneById: user.id, doneByName: user.name, doneAt: now, doneNote: d.note.trim().slice(0, 2000), donePhotos: d.photos } });
}

/** The auditor or HQ checks the fix: verified, or back to open (with a fresh deadline) if it isn't fixed. */
export async function checkAction(tx: Tx, user: Actor, actionId: string, ok: boolean, now = new Date()) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "VisitAction" WHERE "id" = ${actionId} FOR UPDATE`;
  if (!row) throw new VisitError("Action not found.");
  const a = await tx.visitAction.findUniqueOrThrow({ where: { id: actionId }, include: { visit: { select: { auditorId: true, number: true } } } });
  if (!(await managesShop(user, a.storeId, tx))) throw new VisitError("Only the auditor, an area manager or HQ checks fixes.");
  if (a.doneById === user.id) throw new VisitError("Someone else checks a fix you made.");
  if (a.status !== "DONE") throw new VisitError(a.status === "OPEN" ? "Not marked fixed yet." : "Already verified.");
  const days = (a.critical ? storeCfg.visits.criticalFixDays : storeCfg.visits.fixDays) * 86_400_000;
  await tx.visitAction.update({ where: { id: actionId }, data: ok ? { status: "VERIFIED", verifiedAt: now } : { status: "OPEN", doneAt: null, doneById: null, doneByName: null, dueAt: new Date(now.getTime() + days) } });
  await audit(tx, user, { action: "visit.action", entity: ["VisitAction", actionId], summary: `${visitRef(a.visit.number)} “${a.text.slice(0, 80)}”: ${ok ? "fix verified" : "not fixed, reopened"}` });
}

// ---------- reading ----------

/** Every shop the person can see, with its last visit, score trend, open/overdue actions and whether a visit is due. */
export async function visitOverview(scope: Scope, now = new Date()) {
  const ids = scope.all ? null : scope.storeIds;
  return db.$queryRaw<{ storeId: string; name: string; lastNumber: number | null; lastAt: Date | null; lastScore: number | null; prevScore: number | null; draft: number | null; open: number; overdue: number }[]>`
    SELECT s."id" AS "storeId", s."name",
      last."number" AS "lastNumber", last."submittedAt" AS "lastAt", last."score" AS "lastScore", prev."score" AS "prevScore",
      (SELECT d."number" FROM "StoreVisit" d WHERE d."storeId" = s."id" AND d."status" = 'DRAFT') AS "draft",
      (SELECT COUNT(*)::int FROM "VisitAction" a WHERE a."storeId" = s."id" AND a."status" = 'OPEN') AS "open",
      (SELECT COUNT(*)::int FROM "VisitAction" a WHERE a."storeId" = s."id" AND a."status" = 'OPEN' AND a."dueAt" < (${now}::timestamptz AT TIME ZONE 'UTC')) AS "overdue"
    FROM "Store" s
    LEFT JOIN LATERAL (SELECT v."number", v."submittedAt", v."score" FROM "StoreVisit" v WHERE v."storeId" = s."id" AND v."status" <> 'DRAFT' ORDER BY v."submittedAt" DESC LIMIT 1) last ON TRUE
    LEFT JOIN LATERAL (SELECT v."score" FROM "StoreVisit" v WHERE v."storeId" = s."id" AND v."status" <> 'DRAFT' ORDER BY v."submittedAt" DESC OFFSET 1 LIMIT 1) prev ON TRUE
    WHERE s."kind" = 'SHOP' AND s."active" AND (${ids}::text[] IS NULL OR s."id" = ANY(${ids}::text[]))
    ORDER BY "overdue" DESC, last."submittedAt" ASC NULLS FIRST, s."name"`
    .then((rows) => rows.map((r) => ({ ...r, due: !r.lastAt || now.getTime() - r.lastAt.getTime() > storeCfg.visits.everyDays * 86_400_000 })));
}

export async function visitDetail(user: { id: string; role: string }, number: number) {
  const v = await db.storeVisit.findUnique({ where: { number }, include: { store: { select: { name: true } }, actions: { orderBy: [{ critical: "desc" }, { itemIndex: "asc" }] } } });
  if (!v) return null;
  const scope = await scopeFor(user);
  if (!canActAt(scope, v.storeId) && v.auditorId !== user.id) return null;
  return { visit: { ...v, items: v.items as VisitItem[] }, isAuditor: v.auditorId === user.id, manages: can(user, "ops.manage") && canActAt(scope, v.storeId), atShop: canActAt(scope, v.storeId) };
}

export const visitsAt = (storeId: string, take = 20) => db.storeVisit.findMany({ where: { storeId }, orderBy: { startedAt: "desc" }, take, select: { number: true, status: true, score: true, criticalFails: true, auditorName: true, startedAt: true, submittedAt: true } });

/** For the Today page: actions the shop still has to fix, and a visit waiting for acknowledgement. */
export async function visitToDo(storeId: string, now = new Date()) {
  const [actions, toAck] = await Promise.all([
    db.visitAction.findMany({ where: { storeId, status: "OPEN" }, orderBy: { dueAt: "asc" }, select: { id: true, text: true, dueAt: true, critical: true, visit: { select: { number: true } } } }),
    db.storeVisit.findMany({ where: { storeId, status: "SUBMITTED" }, select: { number: true, score: true } }),
  ]);
  return { actions: actions.map((a) => ({ ...a, overdue: a.dueAt < now })), toAck };
}
