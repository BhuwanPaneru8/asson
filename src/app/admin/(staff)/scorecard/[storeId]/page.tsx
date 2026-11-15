import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { canActAt, scopeFor } from "@/lib/scope";
import { scorecard } from "@/lib/scorecard";
import { ktmDate } from "@/lib/pos";
import { issueRef, openIssuesAt } from "@/lib/issues";
import { careRef } from "@/lib/care";
import { visitRef, visitsAt } from "@/lib/visits";
import { cn, formatDate, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";

export const metadata = { title: "Shop scorecard" };
const DAY = 86_400_000;

export default async function ShopScorePage({ params }: { params: Promise<{ storeId: string }> }) {
  const me = await requirePermission("ops.manage");
  const { storeId } = await params;
  const scope = await scopeFor(me);
  if (!canActAt(scope, storeId)) notFound();
  const [row] = await scorecard({ scope: { all: false, storeIds: [storeId] } });
  if (!row) notFound();
  const today = ktmDate();
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.parse(`${today}T00:00:00Z`) - (13 - i) * DAY).toISOString().slice(0, 10));
  const [visits, issues, cases, templates, runs, vm] = await Promise.all([
    visitsAt(storeId, 6),
    openIssuesAt(storeId),
    db.careCase.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 8, select: { number: true, subject: true, status: true, createdAt: true } }),
    db.checklistTemplate.findMany({ where: { active: true, OR: [{ kind: null }, { kind: "SHOP" }] }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.checklistRun.findMany({ where: { storeId, date: { gte: days[0] } }, select: { templateId: true, date: true, completedAt: true, items: true } }),
    db.vmSubmission.findMany({ where: { storeId }, orderBy: { submittedAt: "desc" }, take: 6, include: { brief: { select: { number: true, title: true } } } }),
  ]);
  const cell = (t: string, d: string) => runs.find((r) => r.templateId === t && r.date === d);
  return (
    <>
      <PageHeader title={row.name} description={[row.district, row.province].filter(Boolean).join(" · ")} actions={<Link href="/admin/scorecard" className="text-[13.5px] underline underline-offset-4">All shops</Link>} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[["Operations score", row.opsScore === null ? "—" : `${row.opsScore}%`], ["Sales (30 d)", formatPrice(row.revenue)], ["Checklists done", row.checklistPct === null ? "—" : `${row.checklistPct}%`], ["Display score", row.displayAvg === null ? "—" : `${row.displayAvg}%`], ["Last visit", row.visitScore === null ? "—" : `${row.visitScore}%`]].map(([l, v]) => (
          <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className="mt-1 text-[22px] font-semibold tabular-nums">{v}</p></div></Card>
        ))}
      </div>
      {row.flags.length > 0 && <Card className="mb-4"><ul className="space-y-1 p-4 text-[14px] text-danger">{row.flags.map((f) => <li key={f}>• {f}</li>)}</ul></Card>}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Checklists · last 14 days">
          {!templates.length ? <p className="p-5 text-[14px] text-muted">No checklists set.</p> : (
            <div className="overflow-x-auto p-4"><table className="text-[12px]"><tbody>{templates.map((t) => (
              <tr key={t.id}><td className="pr-3 font-medium">{t.name}</td>{days.map((d) => { const r = cell(t.id, d); return <td key={d} title={`${d}: ${r?.completedAt ? "done" : r ? "partly" : "not started"}`} className="p-0.5"><span className={cn("block h-5 w-5 rounded", r?.completedAt ? "bg-success" : r ? "bg-warn/70" : d === today ? "bg-cloud" : "bg-danger/30")} /></td>; })}</tr>
            ))}</tbody></table><p className="mt-2 text-[11.5px] text-muted">Green done · amber partly · red not started · grey today</p></div>
          )}
        </Card>
        <Card title="Store visits">
          {!visits.length ? <p className="p-5 text-[14px] text-muted">Never visited.</p> : <ul className="divide-y divide-line">{visits.map((v) => <li key={v.number}><Link href={`/admin/visits/${v.number}`} className="flex justify-between gap-3 px-5 py-2.5 text-[14px] hover:bg-cloud/40"><span><span className="text-muted">{visitRef(v.number)}</span> {v.auditorName} · {formatDate(v.submittedAt ?? v.startedAt)}</span><span className="font-semibold tabular-nums">{v.score === null ? v.status === "DRAFT" ? "in progress" : "—" : `${v.score}%`}</span></Link></li>)}</ul>}
        </Card>
        <Card title="Display audits">
          {!vm.length ? <p className="p-5 text-[14px] text-muted">Nothing sent yet.</p> : <ul className="divide-y divide-line">{vm.map((s) => <li key={s.id}><Link href={`/admin/vm/${s.brief.number}?store=${storeId}`} className="flex justify-between gap-3 px-5 py-2.5 text-[14px] hover:bg-cloud/40"><span>{s.brief.title}</span><span>{s.status === "APPROVED" ? <span className="font-semibold tabular-nums">{s.score}%</span> : <Pill tone={s.status === "REDO" ? "danger" : "warn"}>{s.status === "REDO" ? "Redo" : "To review"}</Pill>}</span></Link></li>)}</ul>}
        </Card>
        <Card title={`Open issues · ${issues.length}`}>
          {!issues.length ? <p className="p-5 text-[14px] text-muted">Nothing broken.</p> : <ul className="divide-y divide-line">{issues.map((i) => <li key={i.number}><Link href={`/admin/issues/${i.number}`} className="flex justify-between gap-3 px-5 py-2.5 text-[14px] hover:bg-cloud/40"><span><span className="text-muted">{issueRef(i.number)}</span> {i.title}</span>{i.overdue && <span className="text-[12.5px] font-medium text-danger">overdue</span>}</Link></li>)}</ul>}
        </Card>
        <Card title="Customer care about this shop">
          {!cases.length ? <p className="p-5 text-[14px] text-muted">No cases.</p> : <ul className="divide-y divide-line">{cases.map((c) => <li key={c.number}><Link href={`/admin/care/${c.number}`} className="flex justify-between gap-3 px-5 py-2.5 text-[14px] hover:bg-cloud/40"><span><span className="text-muted">{careRef(c.number)}</span> {c.subject}</span><span className="text-[12.5px] text-muted">{formatDate(c.createdAt)}</span></Link></li>)}</ul>}
        </Card>
      </div>
    </>
  );
}
