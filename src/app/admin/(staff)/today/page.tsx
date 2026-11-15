import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { announcementsFor, checklistsAt } from "@/lib/ops";
import { issueRef, openIssuesAt, STATUS_LABEL } from "@/lib/issues";
import { vmRef, vmToDo } from "@/lib/vm";
import { visitRef, visitToDo } from "@/lib/visits";
import { targetProgress } from "@/lib/budgets";
import { myShifts } from "@/lib/rosters";
import { swapsFor } from "@/lib/shift-swaps";
import { mySops } from "@/lib/training";
import { myPath } from "@/lib/handbook";
import { MySwaps, OfferSwap } from "@/components/admin/swap-forms";
import { ktmDate } from "@/lib/pos";
import { formatPrice } from "@/lib/utils";
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
  const [sops, shifts, swaps, news, lists, issues, displays, visits, target, path] = await Promise.all([mySops(me), myShifts(me.id), swapsFor(me.id), announcementsFor(me), here ? checklistsAt(here.id) : Promise.resolve([]), here ? openIssuesAt(here.id) : Promise.resolve([]), here ? vmToDo(here.id) : Promise.resolve([]), here ? visitToDo(here.id) : Promise.resolve({ actions: [], toAck: [] }), here ? targetProgress(here.id) : Promise.resolve(null), myPath(me)]);
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
          {target && (
            <Card title="This month's sales target">
              <div className="space-y-2 p-5">
                <p className="text-[14px]"><span className="text-[22px] font-semibold tabular-nums">{formatPrice(target.actual)}</span> <span className="text-muted">of {formatPrice(target.target)} · {target.achieved}%</span></p>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-cloud"><div className={`h-full rounded-full ${target.pace === "behind" ? "bg-danger" : "bg-success"}`} style={{ width: `${Math.min(100, target.achieved)}%` }} /><div className="absolute top-0 h-full w-0.5 bg-ink/60" style={{ left: `${Math.min(100, Math.round((target.expectedByNow / target.target) * 100))}%` }} title="where we should be by now" /></div>
                <p className={`text-[13px] ${target.pace === "behind" ? "font-medium text-danger" : "text-muted"}`}>{target.pace === "ahead" ? "Ahead of target" : target.pace === "on track" ? "Close to target" : "Behind target"}: heading for {formatPrice(target.forecast)} by month-end.</p>
              </div>
            </Card>
          )}
          {(visits.actions.length > 0 || visits.toAck.length > 0) && (
            <Card title={`From store visits · ${visits.actions.length} to fix`}>
              <ul className="divide-y divide-line">
                {visits.toAck.map((v) => <li key={`ack-${v.number}`}><Link href={`/admin/visits/${v.number}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40"><span><span className="text-muted">{visitRef(v.number)}</span> New visit report{v.score != null ? ` · ${v.score}%` : ""}</span><span className="shrink-0 text-[12.5px] font-medium">read and acknowledge</span></Link></li>)}
                {visits.actions.map((a) => <li key={a.id}><Link href={`/admin/visits/${a.visit.number}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40"><span className="min-w-0 truncate">{a.critical && <span className="mr-1 text-danger">●</span>}{a.text}</span><span className={`shrink-0 text-[12.5px] ${a.overdue ? "font-medium text-danger" : "text-muted"}`}>{a.overdue ? "overdue" : `by ${formatDateTime(a.dueAt)}`}</span></Link></li>)}
              </ul>
            </Card>
          )}
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
        <div className="space-y-4">
        {path.done < path.of && (() => {
          const next = path.items.find((i) => i.state !== "done")!;
          return (
            <Card title={`Your handbook path · ${path.done} of ${path.of}`} action={<Link href="/admin/handbook" className="text-[13px] underline underline-offset-4">Handbook</Link>}>
              <Link href={`/admin/handbook/${next.slug}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40">
                <span><span className="text-muted">Next: </span>{next.title}</span>
                <span className="shrink-0 text-[12.5px] font-medium text-warn">{next.state === "changed" ? "changed: read again" : next.state === "read" ? "questions to pass" : `${next.minutes} min`}</span>
              </Link>
            </Card>
          );
        })()}
        {sops.some((x) => x.required && x.state !== "signed") && (
          <Card title={`Training to read and sign · ${sops.filter((x) => x.required && x.state !== "signed").length}`} action={<Link href="/admin/training" className="text-[13px] underline underline-offset-4">All</Link>}>
            <ul className="divide-y divide-line">{sops.filter((x) => x.required && x.state !== "signed").slice(0, 5).map((x) => (
              <li key={x.id}><Link href={`/admin/training/${x.slug}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40"><span>{x.title}</span><span className="shrink-0 text-[12.5px] font-medium text-warn">{x.state === "changed" ? "changed: read again" : "to read"}</span></Link></li>
            ))}</ul>
          </Card>
        )}
        <Card title="My shifts · next 7 days">
          {!shifts.length ? <p className="p-5 text-[14px] text-muted">No published shifts for you this week.</p> : (
            <ul className="divide-y divide-line text-[14px]">{shifts.map((s) => (
              <li key={s.date} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-2.5 ${s.date === ktmDate() ? "bg-accent-soft/40" : ""}`}><span><b>{s.date === ktmDate() ? "Today" : s.weekday}</b> <span className="text-muted">{s.date.slice(5)}</span>{s.holiday && <span className="ml-1 text-[12px] text-accent">{s.holiday}</span>}</span><span className="ml-auto"><span className="font-mono">{s.label}</span> · {s.store}</span>{s.date !== ktmDate() && !swaps.mine.some((m) => m.shiftId === s.id) && <OfferSwap shiftId={s.id} colleagues={swaps.colleagues} />}</li>
            ))}</ul>
          )}
        </Card>
        {(swaps.forMe.length > 0 || swaps.mine.length > 0 || swaps.recent.length > 0) && <Card title={swaps.forMe.length ? `Shift swaps · ${swaps.forMe.length} for you` : "Shift swaps"}><MySwaps forMe={swaps.forMe} mine={swaps.mine} recent={swaps.recent} /></Card>}
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
      </div>
    </>
  );
}
