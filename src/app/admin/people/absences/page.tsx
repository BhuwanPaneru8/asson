import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ktmDate } from "@/lib/pos";
import { balances } from "@/lib/people";
import { absenceList, DECISION_LABEL } from "@/lib/absences";
import { scopeFor } from "@/lib/scope";
import { formatDateTime } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { AbsenceDecide, AbsenceReopen } from "@/components/admin/people-forms";

export const metadata = { title: "Missed shifts" };
const TONE = { OPEN: "warn", UNPAID: "danger", LEAVE: "neutral", WORKED: "success" } as const;

export default async function AbsencesPage() {
  const me = await requirePermission("people");
  const scope = await scopeFor(me);
  const today = ktmDate();
  const { open, decided } = await absenceList(scope, today);
  // leave left per person, so the manager only offers leave they still have
  const people = [...new Set(open.map((a) => a.userId))];
  const left = new Map(await Promise.all(people.map(async (u) => [u, (await balances(db, u, today)).map((b) => ({ key: b.key, label: b.label, left: b.left }))] as const)));
  return (
    <>
      <PageHeader
        title="Missed shifts"
        description="Published shifts nobody clocked in for. Decide each one: unpaid (a day's pay comes off that month), taken as leave, or worked (they forgot to clock in). Payroll can't be approved while a month has missed shifts to decide."
        actions={<Link href="/admin/people" className="text-[13.5px] underline underline-offset-4">← People</Link>}
      />
      <Card title={`To decide (${open.length})`}>
        {!open.length ? <p className="p-5 text-[13.5px] text-muted">Nothing to decide. Missed shifts appear here within an hour of the shift ending.</p> : (
          <ul className="divide-y divide-line text-[13.5px]">{open.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <span><span className="font-medium">{a.name}</span> · {a.day} {a.label} · {a.store}<span className="block text-[12px] text-muted">rostered, never clocked in</span></span>
              {a.userId === me.id ? <span className="text-[13px] text-muted">another manager decides yours</span> : <AbsenceDecide id={a.id} name={a.name} leaveTypes={left.get(a.userId) ?? []} />}
            </li>
          ))}</ul>
        )}
      </Card>
      <Card title="Decided in the last 45 days" className="mt-4">
        {!decided.length ? <p className="p-5 text-[13.5px] text-muted">No decisions yet.</p> : (
          <ul className="divide-y divide-line text-[13.5px]">{decided.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-2.5">
              <span><span className="font-medium">{a.name}</span> · {a.day} {a.label} · {a.storeCode}{" "}<Pill tone={TONE[a.status]}>{DECISION_LABEL[a.status]}</Pill>
                <span className="block text-[12px] text-muted">{[a.leave, a.note && `“${a.note}”`, a.decidedBy && `by ${a.decidedBy}`, a.decidedAt && formatDateTime(a.decidedAt)].filter(Boolean).join(" · ")}</span></span>
              {(a.status === "UNPAID" || a.status === "LEAVE") && a.userId !== me.id && <AbsenceReopen id={a.id} />}
            </li>
          ))}</ul>
        )}
      </Card>
    </>
  );
}
