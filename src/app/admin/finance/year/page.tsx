import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ktmDate } from "@/lib/pos";
import { REGISTERS } from "@/lib/accounting";
import { yearChecklist, yearPack } from "@/lib/fiscal-year";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { CloseYear, ReopenYear, StartYear } from "@/components/admin/year-forms";

export const metadata = { title: "Fiscal year" };
const th = "px-3 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wider text-muted whitespace-nowrap";
const money = (v: number) => (v < 0 ? `−${formatPrice(-v)}` : formatPrice(v));

export default async function YearPage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  await requirePermission("finance");
  const years = await db.fiscalYearClose.findMany({ orderBy: { from: "desc" } });
  const want = (await searchParams).fy;
  const y = years.find((x) => x.label === want) ?? years[0];
  const today = ktmDate();
  // a starting guess for the next year to set up: Shrawan 1 ≈ 17 July (check it)
  const startAd = Number(today.slice(0, 4)) - (today.slice(5) < "07-17" ? 1 : 0);
  const guess = years.length ? { label: `${Number(years[0].label.slice(0, 4)) + 1}/${String((Number(years[0].label.slice(0, 4)) + 2) % 100).padStart(2, "0")}`, from: "", to: "" } : { label: `${startAd + 57}/${String((startAd + 58) % 100).padStart(2, "0")}`, from: "", to: "" };
  const [c, pack] = y ? await Promise.all([yearChecklist(y.label), yearPack(y.label)]) : [null, null];
  const closed = !!y?.closedAt && (!y.reopenedAt || y.reopenedAt < y.closedAt);
  return (
    <>
      <PageHeader title={y ? `Fiscal year ${y.label}` : "Fiscal year"} description="Sign off a year (Shrawan–Ashadh) once every month in it is closed, its VAT is filed for every day, payroll TDS/SSF is deposited and the bank is explained. The pack below is what the auditor needs." actions={<span className="flex flex-wrap gap-1.5">{years.map((x) => <Link key={x.id} href={`/admin/finance/year?fy=${encodeURIComponent(x.label)}`} className={cn("rounded-full border px-3 py-1 text-[13px]", x.label === y?.label ? "border-ink bg-ink text-white" : "border-line bg-white")}>{x.label}</Link>)}</span>} />
      <Card title="Set up a year" className="mb-4"><StartYear guess={guess} /></Card>
      {y && c && pack && (
        <>
          <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_360px]">
            <Card title={`Checklist · ${y.from} to ${y.to}`}>
              <ul className="divide-y divide-line">{c.items.map((i) => (
                <li key={i.key} className="flex items-start justify-between gap-3 px-5 py-3 text-[14px]">
                  <span className="min-w-0"><span className="flex items-center gap-2">{i.count === 0 ? <span className="text-success">✓</span> : <span className={i.blocking ? "text-danger" : "text-warn"}>{i.blocking ? "✕" : "!"}</span>}<span className={i.count ? "" : "text-muted"}>{i.label}</span>{i.count > 0 && i.blocking && <Pill tone="danger">blocks closing</Pill>}</span>{i.count > 0 && i.detail && <span className="mt-0.5 block text-[12.5px] text-muted">{i.detail}</span>}</span>
                  {i.count > 0 && <Link href={i.href} className="shrink-0 text-[13px] underline underline-offset-4">Fix</Link>}
                </li>
              ))}</ul>
            </Card>
            <Card title={closed ? "Closed" : "Close the year"}>
              <div className="space-y-3 p-5 text-[14px]">
                {closed ? <><p>Closed by {y.closedByName} on {formatDateTime(y.closedAt!)}.{y.reopenReason ? ` Last reopened: “${y.reopenReason}”.` : ""}</p><ReopenYear label={y.label} /></>
                  : y.to >= today ? <p className="text-muted">The year hasn&apos;t ended yet.</p>
                  : <><p className={c.blocking ? "text-danger" : "text-ink-soft"}>{c.blocking ? `${c.blocking} item(s) block closing.` : c.warnings ? `${c.warnings} warning(s): you can still close.` : "Everything is done."}</p><CloseYear label={y.label} warnings={c.warnings} disabled={c.blocking > 0} /></>}
              </div>
            </Card>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Net sales", money(pack.total.netSales)], ["Net profit", money(pack.total.netProfit)], ["VAT paid", money(pack.vat.paid)], ["Salary TDS", money(pack.tds.tds)]].map(([l, v]) => (
              <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className="mt-1 text-[18px] font-semibold tabular-nums sm:text-[22px]">{v}</p></div></Card>
            ))}
          </div>
          <Card title="Profit and loss by month" className="mb-4">
            <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={cn(th, "text-left")}>Month</th><th className={th}>Net sales</th><th className={th}>Gross profit</th><th className={th}>Expenses</th><th className={th}>Net profit</th></tr></thead>
              <tbody className="divide-y divide-line">{pack.monthly.map((m) => (
                <tr key={m.label}><td className="px-3 py-2">{m.label}</td><td className="px-3 py-2 text-right tabular-nums">{money(m.pl.netSales)}</td><td className="px-3 py-2 text-right tabular-nums">{money(m.pl.grossProfit)}</td><td className="px-3 py-2 text-right tabular-nums">{money(-m.pl.totalExpenses)}</td><td className={cn("px-3 py-2 text-right tabular-nums", m.pl.netProfit < 0 && "text-danger")}>{money(m.pl.netProfit)}</td></tr>
              ))}</tbody>
              <tfoot className="border-t-2 border-ink font-semibold"><tr><td className="px-3 py-2">Year</td><td className="px-3 py-2 text-right tabular-nums">{money(pack.total.netSales)}</td><td className="px-3 py-2 text-right tabular-nums">{money(pack.total.grossProfit)}</td><td className="px-3 py-2 text-right tabular-nums">{money(-pack.total.totalExpenses)}</td><td className="px-3 py-2 text-right tabular-nums">{money(pack.total.netProfit)}</td></tr></tfoot>
            </table></div>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Registers for the year (CSV)">
              <ul className="divide-y divide-line text-[14px]">{(Object.keys(REGISTERS) as (keyof typeof REGISTERS)[]).map((k) => (
                <li key={k}><a href={`/admin/finance/export/${k}?from=${y.from}&to=${y.to}`} className="flex justify-between px-5 py-2.5 hover:bg-cloud/40"><span>{REGISTERS[k].label}</span><span className="text-muted">download</span></a></li>
              ))}
                <li><Link href={`/admin/payroll/statutory/tds.csv?fy=${encodeURIComponent(y.label)}`} className="flex justify-between px-5 py-2.5 hover:bg-cloud/40"><span>Salary TDS by employee</span><span className="text-muted">download</span></Link></li>
              </ul>
            </Card>
            <Card title="Balances (as they stand now)">
              <dl className="space-y-1 p-5 text-[14px]">
                <div className="flex justify-between"><dt>Stock at cost</dt><dd className="tabular-nums">{money(pack.stock.atCost)} · {pack.stock.units.toLocaleString("en-IN")} units</dd></div>
                <div className="flex justify-between"><dt>Owed to suppliers</dt><dd className="tabular-nums">{money(pack.payables.owed)}</dd></div>
                <div className="flex justify-between"><dt>Cash in safes / open tills</dt><dd className="tabular-nums">{money(pack.cash.safes)} / {money(pack.cash.tills)}</dd></div>
                <div className="flex justify-between"><dt>VAT output / input (filed)</dt><dd className="tabular-nums">{money(pack.vat.output)} / {money(pack.vat.input)}</dd></div>
                <p className="pt-2 text-[12px] text-muted">Closing records these figures in the year&apos;s snapshot. Stock and cash are as they stand when you close, so close soon after the year ends.</p>
              </dl>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
