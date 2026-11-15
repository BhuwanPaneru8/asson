import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ktmDate } from "@/lib/pos";
import { fiscalYearOf, type Band } from "@/lib/payroll-rules";
import { yearEndCheck } from "@/lib/payroll";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { TaxYearEditor } from "@/components/admin/payroll-forms";

export const metadata = { title: "Tax bands" };

export default async function TaxBandsPage() {
  await requirePermission("payroll");
  const fy = fiscalYearOf(ktmDate().slice(0, 7));
  const [current, all, check] = await Promise.all([db.payrollTaxYear.findUnique({ where: { fiscalYear: fy } }), db.payrollTaxYear.findMany({ orderBy: { fiscalYear: "desc" } }), yearEndCheck(fy)]);
  const confirmer = current?.confirmedById ? await db.user.findUnique({ where: { id: current.confirmedById }, select: { name: true } }) : null;
  return (
    <>
      <PageHeader title="Income-tax bands" description="Yearly bands in rupees for salary TDS. Payroll won't run for a fiscal year until someone confirms its bands; any edit needs confirming again." />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><TaxYearEditor key={current?.updatedAt.toISOString() ?? "new"} fiscalYear={fy} initial={current ? { single: current.single as Band[], married: current.married as Band[], ssfFirstBandZero: current.ssfFirstBandZero } : null} confirmed={!!current?.confirmedAt} source={current?.source ?? ""} /></div>
        <Card title="All years">
          <ul className="divide-y divide-line text-[13.5px]">{all.length ? all.map((t) => <li key={t.id} className="px-5 py-2.5"><span className="font-medium">FY {t.fiscalYear}</span> · {t.confirmedAt ? `confirmed ${formatDateTime(t.confirmedAt)}${t.fiscalYear === fy && confirmer ? ` by ${confirmer.name}` : ""}` : <span className="text-warn">not confirmed</span>}{t.source && <span className="block text-[12px] text-muted">{t.source}</span>}</li>) : <li className="px-5 py-4 text-muted">None yet.</li>}</ul>
        </Card>
      </div>
      <Card title={`Year-end check · FY ${fy}`} className="mt-4">
        {!check.rows.length ? <p className="p-5 text-[13.5px] text-muted">No payroll for FY {fy} yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr>{["Person", "Months", "Gross so far", "TDS so far", "Tax due on this pay", "Difference"].map((h, i) => <th key={h} className={`px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-wider text-muted ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">{check.rows.map((r) => (
                <tr key={r.name}>
                  <td className="px-4 py-2 font-medium">{r.name}{r.settled && <span className="text-[12px] font-normal text-muted"> · settled in {check.lastMonth}</span>}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.months}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatPrice(r.gross)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatPrice(r.tds)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.expected == null ? "—" : formatPrice(r.expected)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${r.gap && Math.abs(r.gap) >= 100_00 ? "font-medium text-warn" : "text-muted"}`}>{r.gap == null ? "—" : r.settled ? (r.settled.refund ? `${formatPrice(r.settled.refund)} to claim back` : "settled") : Math.abs(r.gap) < 100_00 ? "on track" : r.gap > 0 ? `${formatPrice(r.gap)} under-deducted` : `${formatPrice(-r.gap)} over-deducted`}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">Monthly TDS projects each month&apos;s pay over 12 months, so raises, bonuses, commission and joining mid-year make the year drift, almost always towards too much deducted (tax rises with income). Until {check.lastMonth} this compares TDS so far with the tax the pay so far would owe at the same pace; the {check.lastMonth} payroll settles it exactly (that month&apos;s TDS is the year&apos;s tax minus what was already deducted).</p>
      </Card>
    </>
  );
}
