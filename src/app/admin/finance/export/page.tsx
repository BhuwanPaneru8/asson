import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { ktmDate } from "@/lib/pos";
import { accountingSummary, REGISTERS } from "@/lib/accounting";
import { cn, formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Accounting export" };

const day = /^\d{4}-\d{2}-\d{2}$/;

export default async function AccountingExportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePermission("finance");
  const sp = await searchParams;
  const today = ktmDate();
  const from = sp.from && day.test(sp.from) ? sp.from : `${today.slice(0, 7)}-01`;
  const to = sp.to && day.test(sp.to) && sp.to >= from ? sp.to : today;
  const s = await accountingSummary({ from, to });
  const qs = `from=${from}&to=${to}`;
  const counts: Record<keyof typeof REGISTERS, number> = { sales: s.sales.count, returns: s.returns.count, purchases: s.purchases.count, payments: s.payments.count, expenses: s.expenses.count };
  const line = (l: string, v: number, strong = false) => <div className={cn("flex justify-between py-1.5", strong && "border-t border-line pt-2 font-semibold")}><dt>{l}</dt><dd className="tabular-nums">{formatPrice(v)}</dd></div>;

  return (
    <>
      <PageHeader title="Accounting export" description="Registers for your accountant and the VAT return, for any period. Amounts in rupees; every price and delivery fee includes 13% VAT, split out per document. Dates are AD (Nepal time)." />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-[13px] font-medium text-ink-soft">From<input type="date" name="from" defaultValue={from} max={today} className="mt-1 block h-10 rounded-md border border-line bg-white px-3 text-[14px]" /></label>
        <label className="text-[13px] font-medium text-ink-soft">To<input type="date" name="to" defaultValue={to} max={today} className="mt-1 block h-10 rounded-md border border-line bg-white px-3 text-[14px]" /></label>
        <button className="h-10 rounded-md bg-ink px-4 text-[14px] text-white">Show</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="VAT for this period">
          <dl className="px-5 py-3 text-[14px]">
            {line(`Output VAT on sales (${s.sales.count})`, s.sales.vat)}
            {line(`less VAT on returns (${s.returns.count})`, -s.returns.vat)}
            {line(`Input VAT on supplier bills (${s.purchases.count})`, -s.vat.input)}
            {line(s.vat.payable >= 0 ? "VAT payable" : "VAT to carry forward", Math.abs(s.vat.payable), true)}
          </dl>
          {s.purchases.missingPan > 0 && <p className="mx-5 mb-4 flex items-start gap-2 rounded-md bg-[#fbf1df] px-3 py-2 text-[13px] text-warn"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{s.purchases.missingPan} VAT bill{s.purchases.missingPan > 1 ? "s are" : " is"} from suppliers without a PAN. Add it under <Link href="/admin/suppliers" className="underline">Suppliers</Link> so the input VAT can be claimed.</span></p>}
          <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">Input VAT on expenses isn&apos;t tracked; add expense VAT bills as supplier bills if you want to claim it. Check the figures with your accountant before filing.</p>
        </Card>
        <Card title="Totals">
          <dl className="px-5 py-3 text-[14px]">
            {line("Sales incl. VAT", s.sales.total)}
            {line("Returns incl. VAT", -s.returns.total)}
            {line("Net sales incl. VAT", s.sales.total - s.returns.total, true)}
            {line("Supplier bills", s.purchases.total)}
            {line("Paid to suppliers", s.payments.total)}
            {line("Expenses", s.expenses.total)}
          </dl>
        </Card>
      </div>

      <Card title="Download registers (CSV)" className="mt-4">
        <ul className="divide-y divide-line">
          {(Object.keys(REGISTERS) as (keyof typeof REGISTERS)[]).map((k) => (
            <li key={k} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px]">
              <span><b>{REGISTERS[k].label}</b> <span className="text-muted">· {counts[k]} row{counts[k] === 1 ? "" : "s"}</span></span>
              {/* plain link with download: never prefetched */}
              <a href={`/admin/finance/export/${k}?${qs}`} download className="flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[13.5px] hover:border-ink"><Download className="h-4 w-4" /> CSV</a>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">Opens in Excel or Google Sheets, and imports into Tally as CSV. Downloads are recorded in the activity log.</p>
      </Card>
    </>
  );
}
