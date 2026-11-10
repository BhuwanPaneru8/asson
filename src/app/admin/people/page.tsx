import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { ktmDate } from "@/lib/pos";
import { leaveNo, leaveType, managesPerson, minutesOf, timesheet } from "@/lib/people";
import { scopeFor } from "@/lib/scope";
import { ROLE_LABEL } from "@/lib/permissions";
import { cn, formatDateTime, now } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { DecideButtons, FixEntryForm } from "@/components/admin/people-forms";

export const metadata = { title: "People" };
const th = "px-4 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";
const hrs = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
/** a moment as Nepal local "YYYY-MM-DDTHH:mm" for <input type="datetime-local"> */
const local = (d: Date) => `${ktmDate(d)}T${new Intl.DateTimeFormat("en-GB", { timeZone: store.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d)}`;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const me = await requirePermission("people");
  const scope = await scopeFor(me);
  const sp = await searchParams;
  const thisMonth = ktmDate().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") && sp.month! <= thisMonth ? sp.month! : thisMonth;
  const prev = (() => { const d = new Date(`${month}-15T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const next = (() => { const d = new Date(`${month}-15T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 7); })();
  const inScope = scope.all ? {} : { storeId: { in: scope.storeIds } };
  const [inNow, pendingAll, toFix, sheet] = await Promise.all([
    db.attendance.findMany({ where: { ...inScope, clockOut: null }, orderBy: { clockIn: "asc" }, include: { user: { select: { name: true, role: true } }, store: { select: { name: true } } } }),
    db.leaveRequest.findMany({ where: { status: "PENDING", userId: { not: me.id } }, orderBy: { fromDate: "asc" }, include: { user: { select: { name: true } } } }),
    db.attendance.findMany({ where: { ...inScope, autoClosed: true }, orderBy: { clockIn: "desc" }, take: 50, include: { user: { select: { name: true } }, store: { select: { code: true } } } }),
    timesheet(month, scope),
  ]);
  const pending = [];
  for (const r of pendingAll) if (await managesPerson(db, me, scope, r.userId)) pending.push(r);
  const t = now();
  return (
    <>
      <PageHeader title="People" description="Who's working now, leave waiting for you, entries to fix, and each person's month: the record payroll is built on." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Working now (${inNow.length})`}>
          {!inNow.length ? <p className="p-5 text-[13.5px] text-muted">Nobody is clocked in at your locations.</p> : (
            <ul className="divide-y divide-line text-[13.5px]">{inNow.map((a) => <li key={a.id} className="flex justify-between px-5 py-2"><span><span className="font-medium">{a.user.name}</span> <span className="text-muted">· {ROLE_LABEL[a.user.role]} · {a.store.name}</span></span><span className="tabular-nums text-muted">since {formatDateTime(a.clockIn)} · {hrs(minutesOf(a, new Date(t)))}</span></li>)}</ul>
          )}
        </Card>
        <Card title={`Leave waiting for you (${pending.length})`}>
          {!pending.length ? <p className="p-5 text-[13.5px] text-muted">Nothing to decide.</p> : (
            <ul className="divide-y divide-line text-[13.5px]">{pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5"><span><span className="font-medium">{r.user.name}</span> · {leaveType(r.type)?.label ?? r.type} · {r.fromDate}{r.toDate !== r.fromDate ? ` to ${r.toDate}` : ""} ({r.days} day{r.days === 1 ? "" : "s"})<span className="block text-[12px] text-muted">{leaveNo(r.number)}{r.reason ? ` · “${r.reason}”` : ""}</span></span><DecideButtons id={r.id} /></li>
            ))}</ul>
          )}
        </Card>
      </div>
      {toFix.length > 0 && (
        <Card title={`Forgotten clock-outs to fix (${toFix.length})`} className="mt-4">
          <ul className="divide-y divide-line text-[13.5px]">{toFix.map((a) => (
            <li key={a.id} className="px-5 py-2.5"><p className="flex justify-between gap-3"><span><span className="font-medium">{a.user.name}</span> · {a.store.code} · clocked in {formatDateTime(a.clockIn)}, never out</span>{a.userId !== me.id ? <FixEntryForm id={a.id} clockIn={local(a.clockIn)} clockOut={local(a.clockIn)} /> : <span className="text-muted">another manager fixes yours</span>}</p></li>
          ))}</ul>
        </Card>
      )}
      <Card title={`Month · ${month}`} className="mt-4" action={<span className="flex gap-3 text-[13px]"><Link href={`/admin/people?month=${prev}`} className="underline">← {prev}</Link>{month < thisMonth && <Link href={`/admin/people?month=${next}`} className="underline">{next} →</Link>}</span>}>
        {!sheet.length ? <p className="p-8 text-center text-[14px] text-muted">No attendance at your locations this month.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Person</th><th className={cn(th, "text-right")}>Days worked</th><th className={cn(th, "text-right")}>Hours</th><th className={cn(th, "text-right")}>Entries</th><th className={cn(th, "text-right")}>Leave days</th><th className={cn(th, "text-right")}>To fix</th></tr></thead>
              <tbody className="divide-y divide-line">{sheet.map((r) => (
                <tr key={r.userId}><td className="px-4 py-2"><span className="font-medium">{r.name}</span> <span className="text-[12px] text-muted">{ROLE_LABEL[r.role as keyof typeof ROLE_LABEL]}</span></td><td className="px-4 py-2 text-right tabular-nums">{r.days}</td><td className="px-4 py-2 text-right tabular-nums">{hrs(r.minutes)}</td><td className="px-4 py-2 text-right tabular-nums">{r.entries}</td><td className="px-4 py-2 text-right tabular-nums">{r.leaveDays}{r.unpaidLeaveDays ? <span className="text-warn"> ({r.unpaidLeaveDays} unpaid)</span> : null}</td><td className={cn("px-4 py-2 text-right tabular-nums", r.toFix > 0 && "font-medium text-warn")}>{r.toFix}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">A day counts as worked at {store.people.presentMinutes / 60}+ hours. Leave is counted on working days only (Saturday off). This is what payroll will use.</p>
      </Card>
    </>
  );
}
