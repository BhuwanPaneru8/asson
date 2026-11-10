import "server-only";
import { db } from "./db";
import { provinceOf, store as storeCfg } from "./config";
import { salesByLocation } from "./network";
import { ktmDate } from "./pos";
import type { Scope } from "./scope";

// One row per shop that brings every part of running it together: sales, daily checklists, display
// audits, store visits, issues and customer care. Each figure is computed in SQL grouped by shop (77+ shops
// stay one query per area, never a query per shop). The operations score is the plain average of the
// parts a shop has data for (checklists done, display score, last visit score), shown with its parts, so a
// manager can always see why a shop scores what it does.

const DAY = 86_400_000;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export type ScoreRow = {
  storeId: string; name: string; district: string | null; province: string | null;
  revenue: number; growth: number | null;
  checklistPct: number | null; checklistsDue: number; checklistsDone: number;
  displayAvg: number | null; displaysLate: number;
  visitScore: number | null; visitNumber: number | null; daysSinceVisit: number | null; fixesOpen: number; fixesLate: number;
  issuesOpen: number; issuesLate: number;
  careCases: number; careLate: number; careCsat: number | null;
  opsScore: number | null; flags: string[];
};

export async function scorecard(opts: { scope: Scope; days?: number; now?: Date }): Promise<ScoreRow[]> {
  const now = opts.now ?? new Date();
  const days = opts.days ?? 30;
  const since = new Date(now.getTime() - days * DAY);
  const ids = opts.scope.all ? null : opts.scope.storeIds;
  const today = ktmDate(now);
  const firstDay = addDays(today, -days); // checklist days counted: firstDay … yesterday (today isn't over)

  const [shops, sales, before, templates, runs, vm, vmLate, visits, fixes, issues, care] = await Promise.all([
    db.store.findMany({ where: { active: true, kind: "SHOP", ...(ids ? { id: { in: ids } } : {}) }, orderBy: { name: "asc" }, select: { id: true, name: true, district: true } }),
    salesByLocation({ start: since, end: now }),
    salesByLocation({ start: new Date(since.getTime() - days * DAY), end: since }),
    db.checklistTemplate.findMany({ where: { active: true, OR: [{ kind: null }, { kind: "SHOP" }] }, select: { id: true, createdAt: true } }),
    db.$queryRaw<{ storeId: string; done: number }[]>`
      SELECT r."storeId", COUNT(*)::int AS "done" FROM "ChecklistRun" r JOIN "ChecklistTemplate" t ON t."id" = r."templateId"
      WHERE t."active" AND r."completedAt" IS NOT NULL AND r."date" >= ${firstDay} AND r."date" < ${today}
      GROUP BY r."storeId"`,
    db.$queryRaw<{ storeId: string; avg: number }[]>`
      SELECT "storeId", ROUND(AVG("score"))::int AS "avg" FROM "VmSubmission"
      WHERE "status" = 'APPROVED' AND "reviewedAt" >= (${since}::timestamptz AT TIME ZONE 'UTC') GROUP BY "storeId"`,
    // briefs past due that a shop hasn't got approved (not sent, waiting or redo)
    db.$queryRaw<{ storeId: string; n: number }[]>`
      SELECT s."id" AS "storeId", COUNT(*)::int AS "n" FROM "VmBrief" b
      JOIN "Store" s ON s."kind" = 'SHOP' AND s."active" AND (cardinality(b."storeIds") = 0 OR s."id" = ANY(b."storeIds"))
      LEFT JOIN "VmSubmission" v ON v."briefId" = b."id" AND v."storeId" = s."id"
      WHERE b."closedAt" IS NULL AND b."dueAt" < (${now}::timestamptz AT TIME ZONE 'UTC') AND (v."id" IS NULL OR v."status" <> 'APPROVED')
      GROUP BY s."id"`,
    db.$queryRaw<{ storeId: string; number: number; score: number | null; submittedAt: Date }[]>`
      SELECT DISTINCT ON ("storeId") "storeId", "number", "score", "submittedAt" FROM "StoreVisit"
      WHERE "status" <> 'DRAFT' ORDER BY "storeId", "submittedAt" DESC`,
    db.$queryRaw<{ storeId: string; open: number; late: number }[]>`
      SELECT "storeId", COUNT(*)::int AS "open", COUNT(*) FILTER (WHERE "dueAt" < (${now}::timestamptz AT TIME ZONE 'UTC'))::int AS "late"
      FROM "VisitAction" WHERE "status" = 'OPEN' GROUP BY "storeId"`,
    db.$queryRaw<{ storeId: string; open: number; late: number }[]>`
      SELECT "storeId", COUNT(*)::int AS "open", COUNT(*) FILTER (WHERE "dueAt" < (${now}::timestamptz AT TIME ZONE 'UTC'))::int AS "late"
      FROM "Issue" WHERE "status" <> 'RESOLVED' GROUP BY "storeId"`,
    db.$queryRaw<{ storeId: string; cases: number; late: number; rated: number; happy: number }[]>`
      SELECT "storeId", COUNT(*) FILTER (WHERE "createdAt" >= (${since}::timestamptz AT TIME ZONE 'UTC'))::int AS "cases",
        COUNT(*) FILTER (WHERE "respondBy" < (${now}::timestamptz AT TIME ZONE 'UTC'))::int AS "late",
        COUNT(*) FILTER (WHERE "ratedAt" >= (${since}::timestamptz AT TIME ZONE 'UTC'))::int AS "rated",
        COUNT(*) FILTER (WHERE "ratedAt" >= (${since}::timestamptz AT TIME ZONE 'UTC') AND "rating" >= 4)::int AS "happy"
      FROM "CareCase" WHERE "storeId" IS NOT NULL GROUP BY "storeId"`,
  ]);

  // checklist cells due per shop: each active template, each finished day since it existed
  const due = templates.reduce((n, t) => {
    const from = ktmDate(t.createdAt) > firstDay ? ktmDate(t.createdAt) : firstDay;
    return n + Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY));
  }, 0);
  const by = <T extends { storeId: string }>(rows: T[]) => new Map(rows.map((r) => [r.storeId, r]));
  const [runM, vmM, vmLateM, visitM, fixM, issueM, careM] = [by(runs), by(vm), by(vmLate), by(visits), by(fixes), by(issues), by(care)];

  return shops.map((s) => {
    const rev = sales.get(s.id)?.revenue ?? 0, prev = before.get(s.id)?.revenue ?? 0;
    const done = runM.get(s.id)?.done ?? 0;
    const checklistPct = due ? Math.min(100, Math.round((done / due) * 100)) : null;
    const v = visitM.get(s.id);
    const daysSinceVisit = v ? Math.floor((now.getTime() - v.submittedAt.getTime()) / DAY) : null;
    const parts = [checklistPct, vmM.get(s.id)?.avg ?? null, v?.score ?? null].filter((x): x is number => x !== null);
    const row: ScoreRow = {
      storeId: s.id, name: s.name, district: s.district, province: s.district ? provinceOf(s.district) ?? null : null,
      revenue: rev, growth: prev ? Math.round(((rev - prev) / prev) * 1000) / 10 : null,
      checklistPct, checklistsDue: due, checklistsDone: done,
      displayAvg: vmM.get(s.id)?.avg ?? null, displaysLate: vmLateM.get(s.id)?.n ?? 0,
      visitScore: v?.score ?? null, visitNumber: v?.number ?? null, daysSinceVisit, fixesOpen: fixM.get(s.id)?.open ?? 0, fixesLate: fixM.get(s.id)?.late ?? 0,
      issuesOpen: issueM.get(s.id)?.open ?? 0, issuesLate: issueM.get(s.id)?.late ?? 0,
      careCases: careM.get(s.id)?.cases ?? 0, careLate: careM.get(s.id)?.late ?? 0,
      careCsat: careM.get(s.id)?.rated ? Math.round((careM.get(s.id)!.happy / careM.get(s.id)!.rated) * 100) : null,
      opsScore: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null,
      flags: [],
    };
    if (row.fixesLate) row.flags.push(`${row.fixesLate} visit fix${row.fixesLate > 1 ? "es" : ""} late`);
    if (row.issuesLate) row.flags.push(`${row.issuesLate} issue${row.issuesLate > 1 ? "s" : ""} overdue`);
    if (row.careLate) row.flags.push(`${row.careLate} customer${row.careLate > 1 ? "s" : ""} waiting too long`);
    if (row.displaysLate) row.flags.push(`${row.displaysLate} display brief${row.displaysLate > 1 ? "s" : ""} late`);
    if (daysSinceVisit === null || daysSinceVisit > storeCfg.visits.everyDays) row.flags.push(daysSinceVisit === null ? "never visited" : `not visited for ${daysSinceVisit} days`);
    if (checklistPct !== null && checklistPct < 80) row.flags.push(`checklists ${checklistPct}% done`);
    return row;
  });
}

export const SORTS = { ops: "Operations score", sales: "Sales", growth: "Growth", flags: "Needs attention", name: "Name" } as const;
export type Sort = keyof typeof SORTS;

export function sortRows(rows: ScoreRow[], sort: Sort) {
  const nulls = (v: number | null) => (v === null ? -Infinity : v);
  const cmp: Record<Sort, (a: ScoreRow, b: ScoreRow) => number> = {
    ops: (a, b) => nulls(a.opsScore) - nulls(b.opsScore), // worst first: that's where to look
    sales: (a, b) => b.revenue - a.revenue,
    growth: (a, b) => nulls(a.growth) - nulls(b.growth),
    flags: (a, b) => b.flags.length - a.flags.length,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return [...rows].sort((a, b) => cmp[sort](a, b) || a.name.localeCompare(b.name));
}
