import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ktmDate } from "@/lib/pos";
import { fiscalYearOf, type Band } from "@/lib/payroll-rules";
import { formatDateTime } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { TaxYearEditor } from "@/components/admin/payroll-forms";

export const metadata = { title: "Tax bands" };

export default async function TaxBandsPage() {
  await requirePermission("payroll");
  const fy = fiscalYearOf(ktmDate().slice(0, 7));
  const [current, all] = await Promise.all([db.payrollTaxYear.findUnique({ where: { fiscalYear: fy } }), db.payrollTaxYear.findMany({ orderBy: { fiscalYear: "desc" } })]);
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
    </>
  );
}
