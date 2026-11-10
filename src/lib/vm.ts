import "server-only";
import type { Prisma, VmStatus } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { isMediaUrl } from "./media-url";
import { can, type Role } from "./permissions";
import { canActAt, requireStoreAccess, scopeFor, type Scope } from "./scope";

// Visual merchandising: HQ sends a brief (reference photos, the shots each shop must send, scoring criteria,
// a due date). Shop staff send photos per area; a reviewer (HQ, or the shop's manager, never the person who
// sent them) approves with a score or asks for a redo with feedback. A review names the round it looked at,
// so nobody approves photos they haven't seen if the shop resubmitted in the meantime.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class VmError extends Error {}

export type VmArea = { name: string; hint?: string };
export type VmCriterion = { text: string };
export type VmPhoto = { area: string; url: string };
export const vmRef = (n: number) => `VM-${n}`;
export const STATUS_LABEL: Record<VmStatus | "PENDING", string> = { PENDING: "Not sent", SUBMITTED: "Waiting for review", APPROVED: "Approved", REDO: "Redo asked" };
const MAX_SCORE = 2;

function photosOk(urls: string[]) {
  for (const u of urls) if (!isMediaUrl(u)) throw new VmError("Upload photos with the photo button.");
}

export async function createBrief(tx: Tx, author: Actor, d: { title: string; instructions: string; refPhotos: string[]; areas: VmArea[]; criteria: VmCriterion[]; storeIds: string[]; dueAt: Date }, now = new Date()) {
  if (!(await scopeFor(author, tx)).all) throw new VmError("Visual merchandising briefs come from HQ.");
  const areas = d.areas.map((a) => ({ name: a.name.trim(), hint: a.hint?.trim() || undefined })).filter((a) => a.name);
  const criteria = d.criteria.map((c) => ({ text: c.text.trim() })).filter((c) => c.text);
  if (!areas.length) throw new VmError("List at least one shot the shops must send (e.g. Window).");
  if (new Set(areas.map((a) => a.name.toLowerCase())).size !== areas.length) throw new VmError("Each shot needs a different name.");
  if (!criteria.length) throw new VmError("Add at least one thing the reviewer scores.");
  if (d.refPhotos.length > 6) throw new VmError("Up to 6 reference photos.");
  photosOk(d.refPhotos);
  if (d.dueAt <= now) throw new VmError("The due date must be in the future.");
  if (d.storeIds.length) {
    const shops = await tx.store.count({ where: { id: { in: d.storeIds }, kind: "SHOP", active: true } });
    if (shops !== new Set(d.storeIds).size) throw new VmError("Briefs go to active shops only.");
  }
  const b = await tx.vmBrief.create({ data: { title: d.title.trim(), instructions: d.instructions.trim(), refPhotos: d.refPhotos, areas, criteria, storeIds: [...new Set(d.storeIds)], dueAt: d.dueAt, createdById: author.id, createdAt: now } });
  await audit(tx, author, { action: "vm.brief", entity: ["VmBrief", b.id], summary: `${vmRef(b.number)} “${b.title}” to ${d.storeIds.length ? `${d.storeIds.length} shop(s)` : "every shop"}, due ${d.dueAt.toISOString().slice(0, 10)}` });
  return b;
}

export async function closeBrief(tx: Tx, author: Actor, id: string, now = new Date()) {
  if (!(await scopeFor(author, tx)).all) throw new VmError("Only HQ closes briefs.");
  const r = await tx.vmBrief.updateMany({ where: { id, closedAt: null }, data: { closedAt: now } });
  if (!r.count) throw new VmError("Already closed.");
  await audit(tx, author, { action: "vm.close", entity: ["VmBrief", id], summary: "Brief closed" });
}

const targets = (b: { storeIds: string[] }, storeId: string) => !b.storeIds.length || b.storeIds.includes(storeId);

/** A shop sends (or resends after a redo) one photo or more for every area. */
export async function submit(tx: Tx, user: Actor, d: { briefId: string; storeId: string; photos: VmPhoto[]; note?: string }, now = new Date()) {
  await requireStoreAccess(user, d.storeId, tx);
  const b = await tx.vmBrief.findUnique({ where: { id: d.briefId } });
  if (!b) throw new VmError("Brief not found.");
  if (b.closedAt) throw new VmError("This brief is closed.");
  const shop = await tx.store.findUniqueOrThrow({ where: { id: d.storeId }, select: { kind: true, name: true } });
  if (shop.kind !== "SHOP" || !targets(b, d.storeId)) throw new VmError(`This brief isn't for ${shop.name}.`);
  const areas = b.areas as VmArea[];
  photosOk(d.photos.map((p) => p.url));
  if (d.photos.length > areas.length * 4) throw new VmError("Up to 4 photos per shot.");
  for (const p of d.photos) if (!areas.some((a) => a.name === p.area)) throw new VmError(`“${p.area}” isn't one of the shots.`);
  const missing = areas.filter((a) => !d.photos.some((p) => p.area === a.name)).map((a) => a.name);
  if (missing.length) throw new VmError(`Add a photo of: ${missing.join(", ")}.`);

  // first send creates the row (ON CONFLICT: two people sending at once can't both create it; Prisma upsert
  // isn't atomic, gotcha 30k); later sends lock it and start a new round
  const note = d.note?.trim() ?? "";
  const [created] = await tx.$queryRaw<{ id: string }[]>`INSERT INTO "VmSubmission" ("id", "briefId", "storeId", "status", "round", "photos", "note", "submittedById", "submittedAt", "scores", "feedback")
    VALUES (${`vs_${crypto.randomUUID()}`}, ${b.id}, ${d.storeId}, 'SUBMITTED', 1, ${JSON.stringify(d.photos)}::jsonb, ${note}, ${user.id}, (${now}::timestamptz AT TIME ZONE 'UTC'), '{}', '')
    ON CONFLICT ("briefId", "storeId") DO NOTHING RETURNING "id"`;
  let id: string, round: number;
  if (created) { id = created.id; round = 1; }
  else {
    const [s] = await tx.$queryRaw<{ id: string; status: VmStatus; round: number }[]>`SELECT "id", "status", "round" FROM "VmSubmission" WHERE "briefId" = ${b.id} AND "storeId" = ${d.storeId} FOR UPDATE`;
    if (s.status === "APPROVED") throw new VmError("Already approved: nothing more to send.");
    if (s.status === "SUBMITTED") throw new VmError("Already sent: waiting for review.");
    id = s.id; round = s.round + 1;
    await tx.vmSubmission.update({ where: { id }, data: { status: "SUBMITTED", round, photos: d.photos, note, submittedById: user.id, submittedAt: now, reviewedById: null, reviewedAt: null, scores: [], score: null } });
  }
  await tx.vmEvent.create({ data: { submissionId: id, round, status: "SUBMITTED", message: note || (round > 1 ? "Sent again" : "Sent"), byId: user.id, byName: user.name, createdAt: now } });
  return { id, round, late: now > b.dueAt };
}

/**
 * Approve with a 0–2 score per criterion (total as %), or ask for a redo with feedback. The reviewer must
 * manage the shop (HQ or its manager) and can't review photos they sent themselves.
 */
export async function review(tx: Tx, reviewer: Actor, d: { submissionId: string; round: number; approve: boolean; scores?: number[]; feedback?: string }, now = new Date()) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "VmSubmission" WHERE "id" = ${d.submissionId} FOR UPDATE`;
  if (!row) throw new VmError("Submission not found.");
  const s = await tx.vmSubmission.findUniqueOrThrow({ where: { id: d.submissionId }, include: { brief: true } });
  if (!can(reviewer.role as Role, "ops.manage") || !canActAt(await scopeFor(reviewer, tx), s.storeId)) throw new VmError("Only HQ or the shop's manager reviews displays.");
  if (s.submittedById === reviewer.id) throw new VmError("Someone else must review photos you sent.");
  if (s.status !== "SUBMITTED") throw new VmError("Nothing waiting for review.");
  if (s.round !== d.round) throw new VmError("The shop sent new photos since you opened this. Look at them first.");
  const feedback = d.feedback?.trim() ?? "";
  let scores: number[] = [], score: number | null = null;
  if (d.approve) {
    const criteria = s.brief.criteria as VmCriterion[];
    scores = d.scores ?? [];
    if (scores.length !== criteria.length || scores.some((x) => !Number.isInteger(x) || x < 0 || x > MAX_SCORE)) throw new VmError("Score every point 0, 1 or 2.");
    score = Math.round((scores.reduce((a, b) => a + b, 0) / (criteria.length * MAX_SCORE)) * 100);
  } else if (!feedback) throw new VmError("Say what to change.");
  const status: VmStatus = d.approve ? "APPROVED" : "REDO";
  await tx.vmSubmission.update({ where: { id: s.id }, data: { status, reviewedById: reviewer.id, reviewedAt: now, feedback, scores, score } });
  await tx.vmEvent.create({ data: { submissionId: s.id, round: s.round, status, message: d.approve ? `Approved · ${score}%${feedback ? `: ${feedback}` : ""}` : feedback, byId: reviewer.id, byName: reviewer.name, createdAt: now } });
  await audit(tx, reviewer, { action: "vm.review", entity: ["VmSubmission", s.id], summary: `${vmRef(s.brief.number)} round ${s.round}: ${d.approve ? `approved ${score}%` : "redo"}` });
  return { status, score };
}

// ---------- reading ----------

const shopsFor = (scope: Scope) => db.store.findMany({ where: { active: true, kind: "SHOP", ...(scope.all ? {} : { id: { in: scope.storeIds } }) }, orderBy: { name: "asc" }, select: { id: true, name: true } });

/** Briefs with a status per shop the person can see: HQ sees every shop, shop staff and managers their own. */
export async function briefsFor(user: { id: string; role: string }, now = new Date()) {
  const scope = await scopeFor(user);
  const shops = await shopsFor(scope);
  const ids = shops.map((s) => s.id);
  const briefs = await db.vmBrief.findMany({
    where: scope.all ? {} : { OR: [{ storeIds: { isEmpty: true } }, { storeIds: { hasSome: ids } }] },
    orderBy: [{ closedAt: { sort: "desc", nulls: "first" } }, { dueAt: "asc" }], take: 50,
    include: { submissions: { where: { storeId: { in: ids } }, select: { storeId: true, status: true, score: true, submittedAt: true } } },
  });
  return briefs.map((b) => {
    const mine = shops.filter((s) => targets(b, s.id));
    const subs = new Map(b.submissions.map((s) => [s.storeId, s]));
    const count = (st: VmStatus) => mine.filter((s) => subs.get(s.id)?.status === st).length;
    return {
      ...b, shops: mine.length, approved: count("APPROVED"), waiting: count("SUBMITTED"), redo: count("REDO"),
      notSent: mine.filter((s) => !subs.get(s.id)).length, overdue: !b.closedAt && now > b.dueAt,
    };
  });
}

/** One brief: each shop's state, for the shops this person can see. */
export async function briefDetail(user: { id: string; role: string }, number: number, now = new Date()) {
  const b = await db.vmBrief.findUnique({ where: { number }, include: { submissions: { include: { events: { orderBy: { createdAt: "asc" } } } } } });
  if (!b) return null;
  const scope = await scopeFor(user);
  const shops = (await shopsFor(scope)).filter((s) => targets(b, s.id));
  if (!shops.length && !scope.all) return null;
  const subs = new Map(b.submissions.map((s) => [s.storeId, s]));
  const reviewer = can(user.role as Role, "ops.manage");
  return {
    brief: { ...b, areas: b.areas as VmArea[], criteria: b.criteria as VmCriterion[], submissions: undefined },
    reviewer, hq: scope.all,
    rows: shops.map((s) => {
      const sub = subs.get(s.id) ?? null;
      return { store: s, sub: sub && { ...sub, photos: sub.photos as VmPhoto[] }, late: sub ? sub.submittedAt > b.dueAt : !b.closedAt && now > b.dueAt };
    }),
  };
}

/** Average approved score per shop over the last `days` (first-time approvals count the same as redone ones). */
export async function leaderboard(scope: Scope, days = 90, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000);
  const ids = scope.all ? null : scope.storeIds;
  return db.$queryRaw<{ storeId: string; name: string; avg: number; reviewed: number; firstTime: number; late: number }[]>`
    SELECT s."id" AS "storeId", s."name",
      ROUND(AVG(v."score"))::int AS "avg", COUNT(*)::int AS "reviewed",
      COUNT(*) FILTER (WHERE v."round" = 1)::int AS "firstTime",
      COUNT(*) FILTER (WHERE v."submittedAt" > b."dueAt")::int AS "late"
    FROM "VmSubmission" v JOIN "Store" s ON s."id" = v."storeId" JOIN "VmBrief" b ON b."id" = v."briefId"
    WHERE v."status" = 'APPROVED' AND v."reviewedAt" >= (${since}::timestamptz AT TIME ZONE 'UTC')
      AND (${ids}::text[] IS NULL OR v."storeId" = ANY(${ids}::text[]))
    GROUP BY s."id", s."name" ORDER BY "avg" DESC, s."name"`;
}

/** For the Today page: briefs a shop still has to send (or redo). */
export async function vmToDo(storeId: string) {
  const briefs = await db.vmBrief.findMany({ where: { closedAt: null, OR: [{ storeIds: { isEmpty: true } }, { storeIds: { has: storeId } }] }, orderBy: { dueAt: "asc" }, include: { submissions: { where: { storeId }, select: { status: true } } } });
  const s = await db.store.findUnique({ where: { id: storeId }, select: { kind: true } });
  if (s?.kind !== "SHOP") return [];
  return briefs.filter((b) => !b.submissions[0] || b.submissions[0].status === "REDO").map((b) => ({ number: b.number, title: b.title, dueAt: b.dueAt, redo: b.submissions[0]?.status === "REDO" }));
}
