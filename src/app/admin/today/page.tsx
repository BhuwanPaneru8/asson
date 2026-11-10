import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { announcementsFor, checklistsAt } from "@/lib/ops";
import { issueRef, openIssuesAt, STATUS_LABEL } from "@/lib/issues";
import { vmRef, vmToDo } from "@/lib/vm";
import { scopeFor, storeFilter } from "@/lib/scope";
import { formatDateTime } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { ChecklistCard, ReadButton } from "@/components/admin/ops-forms";

export const metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const me = await requirePermission("self.time");
  const scope = await scopeFor(me);
  const locations = await db.store.findMany({ where: { active: true, ...storeFilter(scope) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true } });
  const want = (await searchParams).store;
  const here = locations.find((l) => l.id === want) ?? locations[0];
  const [news, lists, issues, displays] = await Promise.all([announcementsFor(me), here ? checklistsAt(here.id) : Promise.resolve([]), here ? openIssuesAt(here.id) : Promise.resolve([]), here ? vmToDo(here.id) : Promise.resolve([])]);
  const unread = news.filter((a) => a.requiresAck && !a.readAt);
  return (
    <>
      <PageHeader title="Today" description="Messages from HQ, today's checklists and open issues for your location." />
      {locations.length > 1 && <div className="mb-4 flex flex-wrap gap-1.5">{locations.map((l) => <Link key={l.id} href={`/admin/today?store=${l.id}`} className={`rounded-full border px-3 py-1 text-[13px] ${l.id === here?.id ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>{l.name}</Link>)}</div>}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {!here ? <p className="text-[14px] text-muted">You aren&apos;t assigned to a location yet.</p>
            : !lists.length ? <Card><p className="p-5 text-[14px] text-muted">No checklists for {here.name} today.</p></Card>
            : lists.map((c) => <ChecklistCard key={c.templateId} templateId={c.templateId} storeId={here.id} name={c.name} dueBy={c.dueBy} items={c.items} completed={!!c.completedAt} />)}
          {displays.length > 0 && (
            <Card title={`Display photos to send · ${displays.length}`}>
              <ul className="divide-y divide-line">{displays.map((v) => (
                <li key={v.number}><Link href={`/admin/vm/${v.number}?store=${here!.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40"><span className="min-w-0 truncate"><span className="text-muted">{vmRef(v.number)}</span> {v.title}</span><span className={`shrink-0 text-[12.5px] ${v.redo ? "font-medium text-danger" : "text-muted"}`}>{v.redo ? "redo asked" : `by ${formatDateTime(v.dueAt)}`}</span></Link></li>
              ))}</ul>
            </Card>
          )}
          {here && (
            <Card title={issues.length ? `Open issues · ${issues.length}` : "Issues"} action={<Link href="/admin/issues" className="text-[13px] underline underline-offset-4">Report one</Link>}>
              {!issues.length ? <p className="p-5 text-[14px] text-muted">Nothing broken at {here.name}.</p> : (
                <ul className="divide-y divide-line">{issues.map((i) => (
                  <li key={i.number}><Link href={`/admin/issues/${i.number}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40"><span className="min-w-0 truncate"><span className="text-muted">{issueRef(i.number)}</span> {i.title}</span><span className={`shrink-0 text-[12.5px] ${i.overdue ? "font-medium text-danger" : "text-muted"}`}>{i.overdue ? "overdue" : STATUS_LABEL[i.status]}</span></Link></li>
                ))}</ul>
              )}
            </Card>
          )}
        </div>
        <Card title={unread.length ? `From HQ · ${unread.length} to read` : "From HQ"}>
          {!news.length ? <p className="p-5 text-[14px] text-muted">No announcements.</p> : (
            <ul className="divide-y divide-line">{news.map((a) => (
              <li key={a.id} className={`px-5 py-3.5 ${a.requiresAck && !a.readAt ? "bg-accent-soft/40" : ""}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{a.title}</p><p className="mt-1 whitespace-pre-line text-[14px] text-ink-soft">{a.body}</p><p className="mt-1 text-[12px] text-muted">{formatDateTime(a.createdAt)}{a.readAt ? " · read" : ""}</p></div>{a.requiresAck && !a.readAt && <ReadButton id={a.id} />}</div>
              </li>
            ))}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
