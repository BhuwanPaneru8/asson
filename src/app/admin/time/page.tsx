import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ktmDate } from "@/lib/pos";
import { balances, leaveNo, leaveType, minutesOf } from "@/lib/people";
import { scopeFor, storeFilter } from "@/lib/scope";
import Link from "next/link";
import { formatDateTime, formatPrice, now } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { ClockCard, LeaveForm, WithdrawButton } from "@/components/admin/people-forms";

export const metadata = { title: "My time" };
const hrs = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
const TONE = { PENDING: "warn", APPROVED: "success", REJECTED: "danger", CANCELLED: "neutral" } as const;

export default async function MyTimePage() {
  const me = await requirePermission("self.time");
  const scope = await scopeFor(me);
  const today = ktmDate();
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00+05:45`);
  const [locations, open, entries, bal, requests, slips] = await Promise.all([
    db.store.findMany({ where: { active: true, ...storeFilter(scope) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.attendance.findFirst({ where: { userId: me.id, clockOut: null }, include: { store: { select: { name: true } } } }),
    db.attendance.findMany({ where: { userId: me.id, clockIn: { gte: monthStart } }, orderBy: { clockIn: "desc" }, include: { store: { select: { code: true } } } }),
    balances(db, me.id, today),
    db.leaveRequest.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.payslip.findMany({ where: { userId: me.id, run: { status: "PAID" } }, orderBy: { run: { month: "desc" } }, take: 12, select: { id: true, net: true, run: { select: { month: true } } } }),
  ]);
  const t = now();
  const month = entries.reduce((s, e) => s + (e.clockOut ? minutesOf(e) : 0), 0);
  return (
    <>
      <PageHeader title="My time" description="Clock in when you start, out when you finish. Your hours and leave feed payroll, so keep them right; a manager can fix a mistake." />
      <div className="mb-4"><ClockCard open={open ? { storeName: open.store.name, since: formatDateTime(open.clockIn) } : null} since={open ? hrs(minutesOf(open, new Date(t))) + " so far" : undefined} locations={locations} /></div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Card title={`This month · ${hrs(month)}`}>
            {!entries.length ? <p className="p-5 text-[13.5px] text-muted">No entries yet this month.</p> : (
              <ul className="divide-y divide-line text-[13.5px]">{entries.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 px-5 py-2"><span>{formatDateTime(e.clockIn)} <span className="text-muted">· {e.store.code}</span>{e.autoClosed && <> <Pill tone="warn">forgot to clock out: ask your manager</Pill></>}{e.editedById && <span className="text-muted"> · corrected</span>}</span><span className="tabular-nums">{e.clockOut ? hrs(minutesOf(e)) : "open"}</span></li>
              ))}</ul>
            )}
          </Card>
          <Card title="Leave this year">
            <table className="w-full text-[13.5px]"><tbody className="divide-y divide-line">{bal.map((b) => (
              <tr key={b.key}><td className="px-5 py-2"><span className="font-medium">{b.label}</span>{!b.paid && <span className="text-muted"> · unpaid</span>}<span className="block text-[12px] text-muted">{b.note}</span></td>
                <td className="px-5 py-2 text-right tabular-nums">{b.left == null ? "—" : <><span className="font-medium">{b.left}</span> left</>}<span className="block text-[12px] text-muted">{b.used} taken{b.pending ? ` · ${b.pending} waiting` : ""}</span></td></tr>
            ))}</tbody></table>
          </Card>
        </div>
        <div className="space-y-4">
          <LeaveForm types={bal.map((b) => ({ key: b.key, label: b.label, left: b.left }))} today={today} />
          {slips.length > 0 && (
            <Card title="My payslips">
              <ul className="divide-y divide-line text-[13.5px]">{slips.map((p) => <li key={p.id}><Link href={`/admin/payroll/slip/${p.id}`} className="flex justify-between px-5 py-2.5 hover:bg-cloud/40"><span className="font-medium">{p.run.month}</span><span className="tabular-nums">{formatPrice(p.net)} net</span></Link></li>)}</ul>
            </Card>
          )}
          {requests.length > 0 && (
            <Card title="My requests">
              <ul className="divide-y divide-line text-[13.5px]">{requests.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-2.5">
                  <span>{leaveNo(r.number)} · {leaveType(r.type)?.label ?? r.type} · {r.fromDate}{r.toDate !== r.fromDate ? ` to ${r.toDate}` : ""} ({r.days} day{r.days === 1 ? "" : "s"}){r.decisionNote && <span className="block text-[12px] text-muted">“{r.decisionNote}”</span>}</span>
                  <span className="flex shrink-0 items-center gap-3"><Pill tone={TONE[r.status]}>{r.status.toLowerCase()}</Pill>{(r.status === "PENDING" || (r.status === "APPROVED" && r.fromDate > today)) && <WithdrawButton id={r.id} />}</span>
                </li>
              ))}</ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
