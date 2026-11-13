import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type Role } from "@/lib/permissions";
import { scopeFor } from "@/lib/scope";
import { cn, formatDate } from "@/lib/utils";
import { STATUS_LABEL, visitOverview, visitRef, type TemplateSection } from "@/lib/visits";
import { store } from "@/lib/config";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { StartVisit, VisitTemplateEditor } from "@/components/admin/visit-forms";

export const metadata = { title: "Store visits" };
const th = "px-3 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";

export default async function VisitsPage() {
  const me = await requirePermission("self.time");
  const scope = await scopeFor(me);
  const manager = can(me, "ops.manage");
  const [rows, templates, recent] = await Promise.all([
    visitOverview(scope),
    db.visitTemplate.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.storeVisit.findMany({ where: scope.all ? {} : { OR: [{ storeId: { in: scope.storeIds } }, { auditorId: me.id }] }, orderBy: { startedAt: "desc" }, take: 30, include: { store: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Store visits" description={`Area managers and HQ walk each shop with a scored checklist; failed items become fixes with deadlines. Every shop should be visited at least every ${store.visits.everyDays} days.`} />
      <div className="space-y-4">
        {manager && templates.some((t) => t.active) && <Card title="Start a visit"><StartVisit templates={templates.filter((t) => t.active)} shops={rows.map((r) => ({ id: r.storeId, name: r.name }))} /></Card>}
        <Card title="Shops">
          {!rows.length ? <p className="p-6 text-[14px] text-muted">No shops.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Shop</th><th className={th}>Last visit</th><th className={th}>Score</th><th className={th}>To fix</th><th className={th}></th></tr></thead>
              <tbody className="divide-y divide-line">{rows.map((r) => (
                <tr key={r.storeId}>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className={cn("px-3 py-2", r.due && "font-medium text-danger")}>{r.lastAt ? <Link href={`/admin/visits/${r.lastNumber}`} className="hover:underline">{formatDate(r.lastAt)}</Link> : "never"}{r.due ? " · visit due" : ""}</td>
                  <td className="px-3 py-2 tabular-nums">{r.lastScore == null ? "—" : <span className={cn("font-semibold", r.lastScore >= 85 ? "text-success" : r.lastScore < 60 ? "text-danger" : "")}>{r.lastScore}%</span>}{r.prevScore != null && r.lastScore != null && <span className="ml-1 text-[12px] text-muted">{r.lastScore > r.prevScore ? "▲" : r.lastScore < r.prevScore ? "▼" : "="} {r.prevScore}%</span>}</td>
                  <td className={cn("px-3 py-2 tabular-nums", r.overdue && "font-medium text-danger")}>{r.open}{r.overdue ? ` (${r.overdue} late)` : ""}</td>
                  <td className="px-3 py-2 text-right">{r.draft && <Link href={`/admin/visits/${r.draft}`} className="text-[12.5px] underline">visit in progress</Link>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
        <Card title="Recent visits">
          {!recent.length ? <p className="p-6 text-[14px] text-muted">No visits yet.</p> : (
            <ul className="divide-y divide-line">{recent.map((v) => (
              <li key={v.id}><Link href={`/admin/visits/${v.number}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40">
                <span className="min-w-0"><span className="text-muted">{visitRef(v.number)}</span> {v.store.name}<span className="block text-[12.5px] text-muted">{v.auditorName} · {formatDate(v.startedAt)}</span></span>
                <span className="flex shrink-0 items-center gap-1.5">{v.score != null && <span className="font-semibold tabular-nums">{v.score}%</span>}{v.criticalFails > 0 && <Pill tone="danger">{v.criticalFails} critical</Pill>}<Pill tone={v.status === "ACKNOWLEDGED" ? "success" : v.status === "SUBMITTED" ? "warn" : "neutral"}>{STATUS_LABEL[v.status]}</Pill></span>
              </Link></li>
            ))}</ul>
          )}
        </Card>
        {manager && scope.all && (
          <Card title="Visit checklists">
            <ul className="divide-y divide-line">{templates.map((t) => (
              <li key={t.id} className="px-5 py-3"><div className="flex items-center justify-between gap-3"><span className="text-[14px] font-medium">{t.name}{!t.active && <span className="ml-1.5 text-[12px] text-muted">(off)</span>}<span className="block text-[12.5px] font-normal text-muted">{(t.sections as TemplateSection[]).reduce((n, s) => n + s.items.length, 0)} items</span></span><VisitTemplateEditor initial={{ id: t.id, name: t.name, sections: t.sections as TemplateSection[], active: t.active }} /></div></li>
            ))}</ul>
            <div className="border-t border-line"><p className="px-4 pt-3 text-[13px] font-medium">New checklist</p><VisitTemplateEditor /></div>
          </Card>
        )}
      </div>
    </>
  );
}
