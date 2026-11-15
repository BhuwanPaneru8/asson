import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { ktmDate } from "@/lib/pos";
import { fiscalYearOf } from "@/lib/payroll-rules";
import { KIND_LABEL, statutoryOverview, tdsAnnual } from "@/lib/statutory";
import { cn, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { RecordStatutory } from "@/components/admin/statutory-forms";

export const metadata = { title: "TDS and SSF" };
const th = "px-3 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted whitespace-nowrap";

export default async function StatutoryPage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  await requirePermission("payroll");
  const today = ktmDate();
  const fy = (await searchParams).fy?.match(/^\d{4}\/\d{2}$/) ? (await searchParams).fy! : fiscalYearOf(today.slice(0, 7));
  const [rows, annual] = await Promise.all([statutoryOverview(), tdsAnnual(fy)]);
  const overdue = rows.filter((r) => r.state === "overdue");
  return (
    <>
      <PageHeader title="TDS and SSF" description="What each paid payroll owes the IRD (salary TDS) and the Social Security Fund, when it's due, and when it was deposited. Deposits are also matched from the bank statement." actions={<Link href="/admin/payroll" className="text-[13.5px] underline underline-offset-4">Payroll</Link>} />
      {overdue.length > 0 && <p className="mb-4 rounded-md bg-[#fbe9e7] px-4 py-3 text-[14px] text-danger">{overdue.length} deposit(s) overdue: {overdue.map((o) => `${KIND_LABEL[o.kind]} for ${o.run.month} (${formatPrice(o.amount)}, due ${o.dueOn})`).join("; ")}. Late deposits attract interest and fines.</p>}
      <Card title="Deposits" className="mb-4">
        {!rows.length ? <p className="p-6 text-[14px] text-muted">Nothing yet: deposits appear when a payroll is marked paid.</p> : (
          <ul className="divide-y divide-line">{rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[14px]">
              <span><b>{KIND_LABEL[r.kind]}</b> · payroll {r.run.month} · <span className="tabular-nums">{formatPrice(r.amount)}</span> · due {r.dueOn}</span>
              <span className="flex flex-wrap items-center gap-2">
                <Pill tone={r.state === "paid" ? "success" : r.state === "overdue" || r.state === "paid late" ? "danger" : "warn"}>{r.state}</Pill>
                {r.paidOn ? <span className="text-[13px] text-muted">{formatPrice(r.paidAmount ?? 0)} on {r.paidOn} · {r.reference}{r.statementLine ? " · on the bank statement" : ""}</span> : <RecordStatutory id={r.id} amount={r.amount} today={today} label={`${r.kind} ${r.run.month}`} />}
              </span>
            </li>
          ))}</ul>
        )}
      </Card>
      <Card title={`Salary TDS by employee · FY ${fy}`} action={<span className="flex gap-3 text-[13px]"><Link href={`/admin/payroll/statutory?fy=${String(Number(fy.slice(0, 4)) - 1)}/${fy.slice(2, 4)}`} className="underline">previous year</Link><Link href={`/admin/payroll/statutory/tds.csv?fy=${encodeURIComponent(fy)}`} className="underline">Download CSV</Link></span>}>
        {!annual.rows.length ? <p className="p-6 text-[14px] text-muted">No paid payroll in this fiscal year.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Employee</th><th className={th}>PAN</th><th className={th}>Months</th><th className={cn(th, "text-right")}>Gross</th><th className={cn(th, "text-right")}>SSF (11%)</th><th className={cn(th, "text-right")}>TDS</th></tr></thead>
            <tbody className="divide-y divide-line">{annual.rows.map((r) => (
              <tr key={r.name}><td className="px-3 py-2 font-medium">{r.name}</td><td className={cn("px-3 py-2", !r.pan && r.tds > 0 && "text-danger")}>{r.pan || (r.tds > 0 ? "missing" : "—")}</td><td className="px-3 py-2 tabular-nums">{r.months}</td><td className="px-3 py-2 text-right tabular-nums">{formatPrice(r.gross)}</td><td className="px-3 py-2 text-right tabular-nums">{formatPrice(r.ssf)}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{formatPrice(r.tds)}</td></tr>
            ))}</tbody>
            <tfoot className="border-t-2 border-ink font-semibold"><tr><td className="px-3 py-2" colSpan={3}>Total</td><td className="px-3 py-2 text-right tabular-nums">{formatPrice(annual.total.gross)}</td><td className="px-3 py-2 text-right tabular-nums">{formatPrice(annual.total.ssf)}</td><td className="px-3 py-2 text-right tabular-nums">{formatPrice(annual.total.tds)}</td></tr></tfoot>
          </table></div>
        )}
        {annual.missingPan > 0 && <p className="border-t border-line px-4 py-3 text-[12.5px] text-danger">{annual.missingPan} employee(s) had tax withheld but have no PAN: add it under Payroll → Pay terms before filing.</p>}
      </Card>
    </>
  );
}
