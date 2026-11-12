import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { runTotals } from "@/lib/payroll";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { RunActions, SlipAdjust } from "@/components/admin/payroll-forms";

export const metadata = { title: "Payroll month" };
const th = "px-3 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";
const td = "px-3 py-2 text-right tabular-nums";

export default async function PayrollMonthPage({ params }: { params: Promise<{ month: string }> }) {
  await requirePermission("payroll");
  const r = await db.payrollRun.findUnique({ where: { month: (await params).month }, include: { slips: { include: { user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } } } });
  if (!r) notFound();
  const t = runTotals(r.slips);
  const draft = r.status === "DRAFT";
  return (
    <>
      <PageHeader title={`Payroll ${r.month}`} description={`FY ${r.fiscalYear} · ${r.status === "PAID" ? `paid ${formatDateTime(r.paidAt!)}` : r.status === "APPROVED" ? `approved ${formatDateTime(r.approvedAt!)}, not paid yet` : "draft: rebuild after fixing the timesheet; adjust bonuses and absences per person"}`}
        actions={<div className="flex items-center gap-2"><a href={`/admin/payroll/${r.month}/export.csv`} className="rounded-md border border-line bg-white px-3 py-2 text-[13.5px] hover:border-ink">Download CSV</a><RunActions month={r.month} status={r.status} /></div>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Net pay to staff", t.net], ["TDS to deposit (IRD)", t.tds], ["SSF to deposit", t.ssfEmployee + t.ssfEmployer], ["Gross salaries", t.gross], ["Cost to the company", t.cost]].map(([k, v]) => (
          <div key={k as string} className="rounded-lg border border-line bg-white p-4"><p className="text-[12px] uppercase tracking-wider text-muted">{k}</p><p className="mt-1 text-[20px] font-semibold tabular-nums">{formatPrice(v as number)}</p></div>
        ))}
      </div>
      <Card title={`Payslips (${t.people})`} action={<Pill tone={r.status === "PAID" ? "success" : r.status === "APPROVED" ? "warn" : "neutral"}>{r.status.toLowerCase()}</Pill>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13.5px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Person</th><th className={`${th} text-right`}>Days worked</th><th className={`${th} text-right`}>Unpaid days</th><th className={`${th} text-right`}>Basic + allow.</th><th className={`${th} text-right`}>Bonus</th><th className={`${th} text-right`}>Commission</th><th className={`${th} text-right`}>Gross</th><th className={`${th} text-right`}>SSF 11%</th><th className={`${th} text-right`}>TDS</th><th className={`${th} text-right`}>Net</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-line">{r.slips.map((s) => (
              <tr key={s.id} className="align-top">
                <td className="px-3 py-2"><Link href={`/admin/payroll/slip/${s.id}`} className="font-medium underline-offset-4 hover:underline">{s.user.name}</Link>{s.inSsf && <span className="text-[12px] text-muted"> · SSF</span>}{s.note && <span className="block text-[12px] text-muted">{s.note}</span>}</td>
                <td className={td}>{s.daysWorked} / {s.workingDays}</td>
                <td className={td}>{s.unpaidDays}{s.absenceDays || s.extraUnpaidDays ? <span className="text-[12px] text-muted"> ({[s.absenceDays && `${s.absenceDays} missed`, s.extraUnpaidDays && `${s.extraUnpaidDays} added`].filter(Boolean).join(", ")})</span> : null}</td>
                <td className={td}>{formatPrice(s.basic + s.allowance)}</td>
                <td className={td}>{s.bonus ? formatPrice(s.bonus) : "—"}</td>
                <td className={td}>{s.commission ? formatPrice(s.commission) : "—"}</td>
                <td className={td}>{formatPrice(s.gross)}</td>
                <td className={td}>{formatPrice(s.ssfEmployee)}</td>
                <td className={td}>{formatPrice(s.incomeTax)}</td>
                <td className={`${td} font-semibold`}>{formatPrice(s.net)}</td>
                <td className="px-3 py-2">{draft && <SlipAdjust id={s.id} bonus={s.bonus} extraUnpaidDays={s.extraUnpaidDays} note={s.note ?? ""} />}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">Unpaid days come from approved unpaid leave on the timesheet, missed shifts a manager decided were unpaid (People → Missed shifts), plus any you add. Monthly TDS projects this month&apos;s pay over 12 months; year-end differences are settled by your accountant. Deposit SSF within 15 days of month end and TDS by the IRD deadline.</p>
      </Card>
    </>
  );
}
