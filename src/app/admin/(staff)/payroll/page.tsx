import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ktmDate } from "@/lib/pos";
import { fiscalYearOf } from "@/lib/payroll-rules";
import { runTotals } from "@/lib/payroll";
import { formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { BuildPayroll } from "@/components/admin/payroll-forms";

export const metadata = { title: "Payroll" };
const th = "px-4 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";

export default async function PayrollPage() {
  await requirePermission("payroll");
  const thisMonth = ktmDate().slice(0, 7);
  const prev = (() => { const d = new Date(`${thisMonth}-15T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const [runs, onPayroll, staff, fy] = await Promise.all([
    db.payrollRun.findMany({ orderBy: { month: "desc" }, take: 24, include: { slips: { select: { gross: true, net: true, incomeTax: true, ssfEmployee: true, ssfEmployer: true } } } }),
    db.employment.count({ where: { active: true } }),
    db.user.count({ where: { role: { not: "CUSTOMER" } } }),
    db.payrollTaxYear.findUnique({ where: { fiscalYear: fiscalYearOf(thisMonth) } }),
  ]);
  return (
    <>
      <PageHeader title="Payroll" description="Monthly salaries from each person's pay terms and the timesheet, with SSF (11% / 20% of basic) and income tax from the bands you confirm. Paid payrolls post their cost to Expenses." actions={<BuildPayroll months={[prev, thisMonth]} />} />
      <div className="mb-4 flex flex-wrap gap-2 text-[13.5px]">
        <Link href="/admin/payroll/staff" className="rounded-md border border-line bg-white px-3 py-2 hover:border-ink">Pay terms ({onPayroll} of {staff} staff on payroll)</Link>
        <Link href="/admin/payroll/commissions" className="rounded-md border border-line bg-white px-3 py-2 hover:border-ink">Sales commission</Link>
        <Link href="/admin/payroll/statutory" className="rounded-md border border-line bg-white px-3 py-2 hover:border-ink">TDS and SSF deposits</Link>
        <Link href="/admin/payroll/tax" className="rounded-md border border-line bg-white px-3 py-2 hover:border-ink">Tax bands · FY {fiscalYearOf(thisMonth)} {fy?.confirmedAt ? "✓" : <span className="text-warn">needs confirming</span>}</Link>
      </div>
      <Card title="Payrolls">
        {!runs.length ? <p className="p-8 text-center text-[14px] text-muted">None yet. Set pay terms, confirm this year&apos;s tax bands, then build the month.</p> : (
          <table className="w-full text-[13.5px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Month</th><th className={th}>Status</th><th className={`${th} text-right`}>People</th><th className={`${th} text-right`}>Net pay</th><th className={`${th} text-right`}>TDS</th><th className={`${th} text-right`}>SSF</th><th className={`${th} text-right`}>Cost</th></tr></thead>
            <tbody className="divide-y divide-line">{runs.map((r) => { const t = runTotals(r.slips); return (
              <tr key={r.id} className="hover:bg-cloud/40"><td className="px-4 py-2.5"><Link href={`/admin/payroll/${r.month}`} className="font-medium underline-offset-4 hover:underline">{r.month}</Link></td><td className="px-4 py-2.5"><Pill tone={r.status === "PAID" ? "success" : r.status === "APPROVED" ? "warn" : "neutral"}>{r.status.toLowerCase()}</Pill></td><td className="px-4 py-2.5 text-right tabular-nums">{t.people}</td><td className="px-4 py-2.5 text-right tabular-nums">{formatPrice(t.net)}</td><td className="px-4 py-2.5 text-right tabular-nums">{formatPrice(t.tds)}</td><td className="px-4 py-2.5 text-right tabular-nums">{formatPrice(t.ssfEmployee + t.ssfEmployer)}</td><td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatPrice(t.cost)}</td></tr>
            ); })}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
