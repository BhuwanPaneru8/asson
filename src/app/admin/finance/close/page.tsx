import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { closeChecklist, closeOverview } from "@/lib/month-close";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { CloseMonthButton, ReopenMonth } from "@/components/admin/close-forms";

export const metadata = { title: "Month-end close" };

export default async function ClosePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePermission("finance");
  const months = await closeOverview();
  const sp = (await searchParams).month;
  const pick = months.find((m) => m.month === sp) ?? months.find((m) => !m.current && !m.closed) ?? months[1];
  const c = await closeChecklist(pick.month);
  const snap = pick.row?.snapshot as { pl?: { netSales: number; netProfit: number } } | undefined;
  return (
    <>
      <PageHeader title="Month-end close" description="Close each finished month once its books are complete. A closed month is locked: no expense, supplier bill or payment dated in it can be added, changed or voided until it's reopened (with a reason)." actions={<Link href={`/admin/finance?month=${pick.month}`} className="text-[13.5px] underline underline-offset-4">P&L for {pick.month}</Link>} />
      <div className="mb-4 flex flex-wrap gap-1.5">{months.map((m) => (
        <Link key={m.month} href={`/admin/finance/close?month=${m.month}`} className={cn("rounded-full border px-3 py-1 text-[13px]", m.month === pick.month ? "border-ink bg-ink text-white" : "border-line bg-white")}>{m.month}{m.closed ? " ✓" : m.current ? " (now)" : ""}</Link>
      ))}</div>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card title={`${pick.month} checklist`}>
          <ul className="divide-y divide-line">{c.items.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px]">
              <span className="flex items-center gap-2">{i.count === 0 ? <span className="text-success">✓</span> : <span className={i.blocking ? "text-danger" : "text-warn"}>{i.blocking ? "✕" : "!"}</span>}<span className={i.count ? "" : "text-muted"}>{i.label}</span>{i.count > 0 && i.blocking && <Pill tone="danger">blocks closing</Pill>}</span>
              <span className="flex items-center gap-3">{i.count > 0 && <span className="font-semibold tabular-nums">{i.count}</span>}{i.count > 0 && <Link href={i.href} className="text-[13px] underline underline-offset-4">Fix</Link>}</span>
            </li>
          ))}</ul>
        </Card>
        <div className="space-y-4">
          <Card title="P&L">
            <div className="space-y-1 p-5 text-[14px]">
              <p className="flex justify-between"><span>Net sales</span><span className="tabular-nums">{formatPrice(c.pl.netSales)}</span></p>
              <p className="flex justify-between"><span>Gross profit</span><span className="tabular-nums">{formatPrice(c.pl.grossProfit)}</span></p>
              <p className="flex justify-between"><span>Expenses</span><span className="tabular-nums">−{formatPrice(c.pl.totalExpenses)}</span></p>
              <p className="flex justify-between border-t border-line pt-1 font-semibold"><span>Net profit</span><span className="tabular-nums">{formatPrice(c.pl.netProfit)}</span></p>
              {pick.closed && snap?.pl && snap.pl.netProfit !== c.pl.netProfit && <p className="text-[12.5px] text-danger">At closing it was {formatPrice(snap.pl.netProfit)}: sales or returns dated in the month have changed since.</p>}
            </div>
          </Card>
          <Card title={pick.closed ? "Closed" : pick.current ? "Still running" : "Ready?"}>
            <div className="space-y-3 p-5 text-[14px]">
              {pick.closed ? <>
                <p>Closed by {pick.row!.closedByName} on {formatDateTime(pick.row!.closedAt!)}{pick.row!.closes > 1 ? ` (closed ${pick.row!.closes} times; last reopened: “${pick.row!.reopenReason}”)` : ""}.</p>
                <ReopenMonth month={pick.month} />
              </> : pick.current ? <p className="text-muted">The month isn&apos;t over yet.</p> : <>
                <p className={c.blocking ? "text-danger" : "text-ink-soft"}>{c.blocking ? `${c.blocking} item(s) block closing.` : c.warnings ? `${c.warnings} warning(s): you can still close.` : "Everything is done."}</p>
                <CloseMonthButton month={pick.month} warnings={c.warnings} disabled={c.blocking > 0} />
              </>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
