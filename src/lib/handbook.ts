import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { can, defaultJob, jobOf, JOBS, type JobKey, type Permission, type StaffRole } from "./permissions";
import type { Scope } from "./scope";
import { STAFF_ROLES } from "./training";
import { PAGES, PATHS, pageBySlug } from "@/handbook";
import type { HandbookPage } from "@/handbook/types";

// Handbook progress: what each person has read and the questions they've passed, and their onboarding path
// (the pages for their job plus the procedures their role must sign in Training).

type Tx = Prisma.TransactionClient;
type Reader = { id: string; role: string; job?: string | null; permissions: readonly Permission[] };
export class HandbookError extends Error {}

export const PASS_MARK = 80;

export const jobKeyOf = (u: { role: string; job?: string | null }): JobKey =>
  (jobOf(u.job)?.key ?? defaultJob(u.role as StaffRole));

export const canOpen = (u: Reader, p: HandbookPage) => !p.restricted || can(u, p.restricted);

export const pathFor = (job: JobKey) => PATHS.find((p) => p.job === job) ?? PATHS[0];

/** Where one person stands on one page. */
export type PageState = "done" | "read" | "changed" | "todo";
function stateOf(p: HandbookPage, row?: { version: number; quizScore: number | null }): PageState {
  if (!row) return "todo";
  if (row.version < p.version) return "changed";
  if (p.quiz?.length && (row.quizScore ?? 0) < PASS_MARK) return "read"; // read, questions not passed yet
  return "done";
}

export async function readsOf(userId: string) {
  const rows = await db.handbookRead.findMany({ where: { userId } });
  return new Map(rows.map((r) => [r.slug, r]));
}

/** This person's onboarding path: their job's pages in order, each with its state. */
export async function myPath(u: Reader) {
  const job = jobKeyOf(u);
  const reads = await readsOf(u.id);
  const items = pathFor(job).read.map((slug) => pageBySlug(slug)).filter((p): p is HandbookPage => !!p && canOpen(u, p))
    .map((p) => ({ slug: p.slug, title: p.title, minutes: p.minutes, hasQuiz: !!p.quiz?.length, state: stateOf(p, reads.get(p.slug)) }));
  const done = items.filter((i) => i.state === "done").length;
  return { job, jobLabel: JOBS.find((j) => j.key === job)!.label, items, done, of: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 100, reads, stateOf: (p: HandbookPage) => stateOf(p, reads.get(p.slug)) };
}

export async function markRead(tx: Tx, u: Reader, slug: string) {
  const p = pageBySlug(slug);
  if (!p || !canOpen(u, p)) throw new HandbookError("That page isn't available.");
  await tx.$executeRaw`INSERT INTO "HandbookRead" ("userId", "slug", "version", "readAt") VALUES (${u.id}, ${slug}, ${p.version}, NOW())
    ON CONFLICT ("userId", "slug") DO UPDATE SET "version" = EXCLUDED."version", "readAt" = NOW(),
      "quizScore" = CASE WHEN "HandbookRead"."version" < EXCLUDED."version" THEN NULL ELSE "HandbookRead"."quizScore" END`;
  return { version: p.version };
}

/** Marks the answers on the server (the browser never gets the right answers before submitting). */
export async function submitQuiz(tx: Tx, u: Reader, slug: string, answers: number[]) {
  const p = pageBySlug(slug);
  if (!p || !canOpen(u, p) || !p.quiz?.length) throw new HandbookError("That page has no questions.");
  if (answers.length !== p.quiz.length || answers.some((a) => !Number.isInteger(a))) throw new HandbookError("Answer every question.");
  const right = p.quiz.map((q, i) => q.answer === answers[i]);
  const score = Math.round((right.filter(Boolean).length / p.quiz.length) * 100);
  await tx.$executeRaw`INSERT INTO "HandbookRead" ("userId", "slug", "version", "readAt", "quizScore", "quizAt") VALUES (${u.id}, ${slug}, ${p.version}, NOW(), ${score}, NOW())
    ON CONFLICT ("userId", "slug") DO UPDATE SET "version" = EXCLUDED."version", "quizAt" = NOW(),
      "quizScore" = CASE WHEN "HandbookRead"."version" < EXCLUDED."version" THEN EXCLUDED."quizScore" ELSE GREATEST(COALESCE("HandbookRead"."quizScore", 0), EXCLUDED."quizScore") END`;
  return { score, passed: score >= PASS_MARK, results: p.quiz.map((q, i) => ({ right: right[i], answer: q.answer, why: q.why })) };
}

/** Handbook search: title, summary and text, best matches first. */
export function searchPages(u: Reader, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1).slice(0, 6);
  if (!words.length) return [];
  return PAGES.filter((p) => canOpen(u, p)).map((p) => {
    const title = p.title.toLowerCase(), summary = p.summary.toLowerCase(), body = p.body.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (!title.includes(w) && !summary.includes(w) && !body.includes(w)) return { p, score: 0 };
      score += (title.includes(w) ? 10 : 0) + (summary.includes(w) ? 4 : 0) + Math.min(body.split(w).length - 1, 5);
    }
    return { p, score };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 25).map((r) => r.p);
}

/** Team onboarding: each staff member at these locations (everyone for HQ), their path and training sign-offs. */
export async function teamProgress(scope: Scope) {
  const people = await db.user.findMany({
    where: { role: { in: [...STAFF_ROLES] }, ...(scope.all ? {} : { locations: { some: { storeId: { in: scope.storeIds } } } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, job: true, createdAt: true, permAdd: true, permRemove: true, locations: { select: { store: { select: { name: true } } } } },
  });
  const ids = people.map((p) => p.id);
  const [reads, sops, signoffs] = await Promise.all([
    db.handbookRead.findMany({ where: { userId: { in: ids } } }),
    db.sop.findMany({ where: { active: true }, select: { id: true, roles: true, version: true } }),
    db.sopSignoff.findMany({ where: { userId: { in: ids } } }),
  ]);
  const now = Date.now();
  return people.map((person) => {
    const job = jobKeyOf(person);
    const mine = new Map(reads.filter((r) => r.userId === person.id).map((r) => [r.slug, r]));
    const path = pathFor(job).read.map((s) => pageBySlug(s)).filter((p): p is HandbookPage => !!p);
    const done = path.filter((p) => stateOf(p, mine.get(p.slug)) === "done").length;
    const due = sops.filter((s) => s.roles.includes(person.role));
    const signed = due.filter((s) => signoffs.some((x) => x.sopId === s.id && x.userId === person.id && x.version >= s.version)).length;
    const scores = [...mine.values()].map((r) => r.quizScore).filter((s): s is number => s != null);
    const last = [...mine.values()].reduce<Date | null>((d, r) => (!d || r.readAt > d ? r.readAt : d), null);
    return {
      id: person.id, name: person.name, role: person.role, job, jobLabel: JOBS.find((j) => j.key === job)!.label,
      where: person.locations.map((l) => l.store.name).join(", "), joined: person.createdAt,
      read: done, of: path.length, signed, sopsDue: due.length,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      lastActive: last,
      complete: done === path.length && signed === due.length,
      /** no reading for 14 days (or never) */
      stuck: !last || now - last.getTime() > 14 * 86_400_000,
    };
  });
}
