import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { announcementsFor, checklistsAt } from "@/lib/ops";
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
  const [news, lists] = await Promise.all([announcementsFor(me), here ? checklistsAt(here.id) : Promise.resolve([])]);
  const unread = news.filter((a) => a.requiresAck && !a.readAt);
  return (
    <>
      <PageHeader title="Today" description="Messages from HQ and today's checklists for your location." />
      {locations.length > 1 && <div className="mb-4 flex flex-wrap gap-1.5">{locations.map((l) => <Link key={l.id} href={`/admin/today?store=${l.id}`} className={`rounded-full border px-3 py-1 text-[13px] ${l.id === here?.id ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>{l.name}</Link>)}</div>}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {!here ? <p className="text-[14px] text-muted">You aren&apos;t assigned to a location yet.</p>
            : !lists.length ? <Card><p className="p-5 text-[14px] text-muted">No checklists for {here.name} today.</p></Card>
            : lists.map((c) => <ChecklistCard key={c.templateId} templateId={c.templateId} storeId={here.id} name={c.name} dueBy={c.dueBy} items={c.items} completed={!!c.completedAt} />)}
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
