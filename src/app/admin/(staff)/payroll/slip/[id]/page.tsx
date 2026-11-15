import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { formatPrice } from "@/lib/utils";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Payslip" };

/** Owner sees any payslip; staff see their own once the month is paid. */
export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("self.time");
  const s = await db.payslip.findUnique({ where: { id: (await params).id }, include: { run: true, user: { select: { name: true, employment: { select: { pan: true } } } } } });
  if (!s || !(can(me, "payroll") || (s.userId === me.id && s.run.status === "PAID"))) notFound();
  const row = (k: string, v: number, minus = false) => <div className="flex justify-between py-1"><dt className="text-ink-soft">{k}</dt><dd className="tabular-nums">{minus && v ? "−" : ""}{formatPrice(v)}</dd></div>;
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <div className="rounded-lg border border-line bg-white p-6 text-[14px]">
        <div className="flex justify-between border-b border-line pb-3"><div><p className="font-display text-2xl">{store.name}</p><p className="text-muted">Payslip · {s.run.month}</p></div><div className="text-right"><p className="font-semibold">{s.user.name}</p>{s.user.employment?.pan && <p className="text-muted">PAN {s.user.employment.pan}</p>}<p className="text-muted">{s.run.status === "PAID" ? "Paid" : s.run.status.toLowerCase()}</p></div></div>
        <p className="py-3 text-[13px] text-muted">{s.daysWorked} of {s.workingDays} working days worked · {s.leaveDays} leave day(s) · {s.unpaidDays} unpaid</p>
        <dl className="border-t border-line pt-2">
          {row("Basic salary", s.basic)}
          {s.allowance > 0 && row("Allowance", s.allowance)}
          {s.unpaidDeduction > 0 && row(`Unpaid days (${s.unpaidDays})`, s.unpaidDeduction, true)}
          {s.bonus > 0 && row("Bonus", s.bonus)}
          {s.commission > 0 && row("Sales commission", s.commission)}
          <div className="flex justify-between border-t border-line py-1.5 font-semibold"><dt>Gross</dt><dd className="tabular-nums">{formatPrice(s.gross)}</dd></div>
          {s.inSsf && row("SSF (11% of basic)", s.ssfEmployee, true)}
          {row(s.yearTax != null ? "Income tax (TDS), year-end settlement" : "Income tax (TDS)", s.incomeTax, true)}
          <div className="flex justify-between border-t-2 border-ink py-2 text-[16px] font-semibold"><dt>Net pay</dt><dd className="tabular-nums">{formatPrice(s.net)}</dd></div>
        </dl>
        {s.inSsf && <p className="mt-2 text-[12.5px] text-muted">Your employer also pays {formatPrice(s.ssfEmployer)} (20% of basic) into your Social Security Fund account.</p>}
        {s.yearTax != null && <p className="mt-2 text-[12.5px] text-muted">Last month of FY {s.run.fiscalYear}: your tax for the whole year is {formatPrice(s.yearTax)}. This month&apos;s TDS is what was still due after the earlier months{s.taxAdjustment ? ` (${s.taxAdjustment > 0 ? "+" : "−"}${formatPrice(Math.abs(s.taxAdjustment))} against the usual monthly amount)` : ""}.{s.taxRefundDue > 0 ? ` ${formatPrice(s.taxRefundDue)} more than the year's tax was deducted; you can claim it back from the Inland Revenue Department.` : ""}</p>}
        {s.note && <p className="mt-2 text-[12.5px] text-muted">Note: {s.note}</p>}
      </div>
    </div>
  );
}
