import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { store as storeCfg } from "@/lib/config";
import { ktmDate } from "@/lib/pos";
import { scopeFor, storeFilter } from "@/lib/scope";
import { addDays, rosterOverview, rosterVsActual, rosterWeek, weekStartOf } from "@/lib/rosters";
import { cn, formatDateTime } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { Holidays, MinStaff, RosterGrid } from "@/components/admin/roster-forms";
import { swapsToApprove } from "@/lib/shift-swaps";
import { ApproveSwaps } from "@/components/admin/swap-forms";

export const metadata = { title: "Rosters" };

const RESULT_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = { "on time": "success", late: "warn", "left early": "warn", "late, left early": "warn", "no-show": "danger" };

export default async function RostersPage({ searchParams }: { searchParams: Promise<{ store?: string; week?: string }> }) {
  const me = await requirePermission("people");
  const scope = await scopeFor(me);
  const sp = await searchParams;
  const locations = await db.store.findMany({ where: { active: true, ...storeFilter(scope) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true } });
  const today = ktmDate();
  const thisWeek = weekStartOf(today);
  const week = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? weekStartOf(sp.week) : addDays(thisWeek, 7); // plan next week by default
  const here = locations.find((l) => l.id === sp.store) ?? locations[0];
  if (!here) return <PageHeader title="Rosters" description="You aren't assigned to a location." />;
  const [w, overview, actual, holidays, toApprove] = await Promise.all([
    rosterWeek(here.id, week),
    locations.length > 1 ? rosterOverview(scope, week) : Promise.resolve([]),
    rosterVsActual([here.id], addDays(today, -13), today),
    db.holiday.findMany({ where: { date: { gte: addDays(today, -7) } }, orderBy: { date: "asc" }, take: 30 }),
    swapsToApprove(scope),
  ]);
  const qs = (p: { store?: string; week?: string }) => `/admin/rosters?store=${p.store ?? here.id}&week=${p.week ?? week}`;
  const misses = actual.rows.filter((r) => r.result !== "on time" && r.result !== "to come").reverse().slice(0, 20);
  return (
    <>
      <PageHeader title={`Rosters · ${here.name}`} description="Plan who works when, one week at a time. Staff see their shifts on Today once the week is published; afterwards the plan is checked against clock-ins." actions={<MinStaff storeId={here.id} value={w.store.minStaff} />} />
      {locations.length > 1 && <div className="mb-3 flex flex-wrap gap-1.5">{locations.map((l) => <Link key={l.id} href={qs({ store: l.id })} className={cn("rounded-full border px-3 py-1 text-[13px]", l.id === here.id ? "border-ink bg-ink text-white" : "border-line bg-white")}>{l.name}</Link>)}</div>}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-[14px]">
        <Link href={qs({ week: addDays(week, -7) })} className="rounded-md border border-line bg-white px-3 py-1.5 hover:border-ink">← Previous</Link>
        <b>Week of {week}</b>{week === thisWeek && <span className="text-muted">(this week)</span>}
        <Link href={qs({ week: addDays(week, 7) })} className="rounded-md border border-line bg-white px-3 py-1.5 hover:border-ink">Next →</Link>
        {w.published ? <Pill tone={w.changedSincePublish ? "warn" : "success"}>{w.changedSincePublish ? "changed since publishing: publish again" : `published ${formatDateTime(w.published.at)}`}</Pill> : <Pill tone="warn">draft: staff can&apos;t see it</Pill>}
      </div>
      {toApprove.length > 0 && <Card title={`Shift swaps to approve · ${toApprove.length}`} className="mb-4"><ApproveSwaps rows={toApprove} /></Card>}
      {w.warnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-warn/40 bg-[#fbeee0] px-4 py-3 text-[13.5px] text-[#7a4a10]">
          <p className="font-semibold">{w.warnings.length} thing{w.warnings.length === 1 ? "" : "s"} to check</p>
          <ul className="mt-1 list-disc pl-5">{w.warnings.slice(0, 12).map((x, i) => <li key={i}>{x.text}</li>)}</ul>
        </div>
      )}
      <Card className="mb-4">
        {!w.rows.length ? <p className="p-5 text-[14px] text-muted">Nobody is assigned to {here.name}. Assign people in Team.</p>
          : <RosterGrid key={`${here.id}:${week}:${w.rows.map((r) => r.days.map((d) => d.shift ? d.shift.start + d.shift.end : "").join()).join()}`} storeId={here.id} weekStart={week} heads={w.dates} rows={w.rows} minStaff={w.store.minStaff} maxHours={storeCfg.people.maxWeekHours} />}
      </Card>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title={`Roster vs clock-ins · last 14 days${actual.onTimePct != null ? ` · ${actual.onTimePct}% on time` : ""}`} className="xl:col-span-2">
          {!actual.people.length ? <p className="p-5 text-[14px] text-muted">No published shifts have happened yet.</p> : (
            <div className="grid gap-0 lg:grid-cols-2">
              <table className="w-full text-[13.5px]">
                <thead className="border-b border-line text-left text-[11.5px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-2">Person</th><th className="px-2 text-right">Shifts</th><th className="px-2 text-right">Late</th><th className="px-2 text-right">Early</th><th className="px-4 text-right">No-show</th></tr></thead>
                <tbody className="divide-y divide-line">{actual.people.map((p) => (
                  <tr key={p.name}><td className="px-4 py-2">{p.name}</td><td className="px-2 text-right tabular-nums">{p.shifts}</td><td className={cn("px-2 text-right tabular-nums", p.late > 0 && "text-warn")}>{p.late}</td><td className="px-2 text-right tabular-nums">{p.early}</td><td className={cn("px-4 text-right tabular-nums", p.noShow > 0 && "font-semibold text-danger")}>{p.noShow}</td></tr>
                ))}</tbody>
              </table>
              <ul className="divide-y divide-line border-t border-line text-[13px] lg:border-l lg:border-t-0">{misses.length ? misses.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2"><span><span className="tabular-nums text-muted">{r.date.slice(5)}</span> {r.name} · {r.label}</span><Pill tone={RESULT_TONE[r.result] ?? "neutral"}>{r.result}{r.result.startsWith("late") && r.lateBy ? ` ${r.lateBy} min` : ""}</Pill></li>
              )) : <li className="px-4 py-3 text-muted">Everyone turned up on time. 👏</li>}</ul>
            </div>
          )}
        </Card>
        <Card title="Public holidays"><Holidays list={holidays} canEdit={can(me.role, "team.manage")} /></Card>
      </div>
      {overview.length > 0 && (
        <Card title={`All your locations · week of ${week}`} className="mt-4">
          <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
            <thead className="border-b border-line text-left text-[11.5px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-2">Location</th><th className="px-3 text-right">Shifts</th><th className="px-3 text-right">Days short</th><th className="px-4">Status</th></tr></thead>
            <tbody className="divide-y divide-line">{overview.map((o) => (
              <tr key={o.id}><td className="px-4 py-2"><Link href={qs({ store: o.id })} className="hover:underline">{o.name}</Link></td><td className="px-3 text-right tabular-nums">{o.shifts}</td><td className={cn("px-3 text-right tabular-nums", o.short > 0 && "font-semibold text-danger")}>{o.short}</td><td className="px-4"><Pill tone={o.published ? "success" : o.shifts ? "warn" : "neutral"}>{o.published ? "published" : o.shifts ? "draft" : "not planned"}</Pill></td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
    </>
  );
}
