import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type Role } from "@/lib/permissions";
import { CATEGORY_LABEL, issueRef, issueStats, listIssues, STATUS_LABEL, type IssueFilter } from "@/lib/issues";
import { scopeFor, storeFilter } from "@/lib/scope";
import { cn, formatDateTime, formatPrice, now } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { ReportIssueForm } from "@/components/admin/issue-forms";

export const metadata = { title: "Issues" };
const th = "px-3 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";

const due = (d: Date, at: number) => {
  const h = Math.round((d.getTime() - at) / 3_600_000);
  return h >= 0 ? (h < 48 ? `due in ${h}h` : `due in ${Math.round(h / 24)}d`) : (-h < 48 ? `${-h}h overdue` : `${Math.round(-h / 24)}d overdue`);
};

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ status?: string; store?: string; mine?: string; overdue?: string }> }) {
  const me = await requirePermission("self.time");
  const sp = await searchParams;
  const scope = await scopeFor(me);
  const manager = can(me.role as Role, "ops.manage");
  const f: IssueFilter = { status: sp.status === "resolved" || sp.status === "all" ? sp.status : "open", storeId: sp.store || undefined, mine: sp.mine === "1", overdue: sp.overdue === "1" };
  const [issues, locations, stats] = await Promise.all([
    listIssues(me, f),
    db.store.findMany({ where: { active: true, ...storeFilter(scope) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
    manager ? issueStats(scope) : Promise.resolve([]),
  ]);
  const at = now();
  const q = (p: Record<string, string | undefined>) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries({ status: sp.status, store: sp.store, mine: sp.mine, overdue: sp.overdue, ...p })) if (v) u.set(k, v); const s = u.toString(); return `/admin/issues${s ? `?${s}` : ""}`; };
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-[13px]", on ? "border-ink bg-ink text-white" : "border-line bg-white");
  return (
    <>
      <PageHeader title="Issues" description="Broken equipment, maintenance, IT and safety problems at shops and warehouses, and who's fixing them." />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <Link href={q({ status: undefined, overdue: undefined })} className={chip(f.status === "open" && !f.overdue)}>Open</Link>
            <Link href={q({ status: undefined, overdue: "1" })} className={chip(!!f.overdue)}>Overdue</Link>
            <Link href={q({ mine: f.mine ? undefined : "1" })} className={chip(!!f.mine)}>Assigned to me</Link>
            <Link href={q({ status: "resolved", overdue: undefined })} className={chip(f.status === "resolved")}>Resolved</Link>
            <Link href={q({ status: "all", overdue: undefined })} className={chip(f.status === "all")}>All</Link>
            {locations.length > 1 && <form action="/admin/issues" className="ml-auto">{Object.entries({ status: sp.status, mine: sp.mine, overdue: sp.overdue }).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}<select name="store" defaultValue={sp.store ?? ""} className="h-8 rounded-md border border-line bg-white px-2 text-[13px]" aria-label="Filter by location">
              <option value="">Every location</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select> <button className="h-8 rounded-md border border-line px-2 text-[13px]">Show</button></form>}
          </div>
          <Card>
            {!issues.length ? <p className="p-6 text-[14px] text-muted">No issues here. Report one when something needs fixing.</p> : (
              <ul className="divide-y divide-line">{issues.map((i) => (
                <li key={i.id}><Link href={`/admin/issues/${i.number}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-cloud/40">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium"><span className="text-muted">{issueRef(i.number)}</span> {i.title}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">{i.store.name} · {CATEGORY_LABEL[i.category]} · {formatDateTime(i.createdAt)}{i.assignee ? ` · ${i.assignee.name}` : " · not assigned"}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-[12.5px]">
                    <span className="flex gap-1">{i.priority === "URGENT" && <Pill tone="danger">Urgent</Pill>}<Pill tone={i.status === "RESOLVED" ? "success" : i.status === "ON_HOLD" ? "warn" : "neutral"}>{STATUS_LABEL[i.status]}</Pill></span>
                    {i.status !== "RESOLVED" && <span className={i.overdue ? "font-medium text-danger" : "text-muted"}>{due(i.dueAt, at)}</span>}
                  </div>
                </Link></li>
              ))}</ul>
            )}
          </Card>
          {manager && stats.length > 0 && (
            <Card title="By location · last 30 days">
              <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
                <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Location</th><th className={th}>Open</th><th className={th}>Overdue</th><th className={th}>Fixed</th><th className={th}>Median time to fix</th><th className={th}>Repair cost</th></tr></thead>
                <tbody className="divide-y divide-line">{stats.map((s) => (
                  <tr key={s.storeId}><td className="px-3 py-2 font-medium"><Link href={q({ store: s.storeId })} className="hover:underline">{s.name}</Link></td><td className="px-3 py-2 tabular-nums">{s.open}</td><td className={cn("px-3 py-2 tabular-nums", s.overdue && "font-medium text-danger")}>{s.overdue}</td><td className="px-3 py-2 tabular-nums">{s.resolved}</td><td className="px-3 py-2 tabular-nums">{s.medianHours == null ? "—" : s.medianHours < 48 ? `${Math.round(s.medianHours)}h` : `${Math.round(s.medianHours / 24)}d`}</td><td className="px-3 py-2 tabular-nums">{s.cost ? formatPrice(s.cost) : "—"}</td></tr>
                ))}</tbody>
              </table></div>
            </Card>
          )}
        </div>
        <div>{locations.length ? <ReportIssueForm locations={locations} /> : <Card><p className="p-5 text-[14px] text-muted">You aren&apos;t assigned to a location, so you can&apos;t report issues.</p></Card>}</div>
      </div>
    </>
  );
}
