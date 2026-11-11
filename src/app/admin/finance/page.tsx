import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { EXPENSE_LABEL, monthBounds, profitAndLoss, stockValuation } from "@/lib/finance";
import { ktmDate } from "@/lib/pos";
import { formatDate, formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { ExpenseForm, RecurringForm } from "@/components/admin/expense-form";
import { isMonthClosed } from "@/lib/month-close";

export const metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePermission("finance");
  const thisMonth = ktmDate().slice(0, 7);
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth;
  const { start, end, next } = monthBounds(month);
  const [pl, stock, expenses, locations, recurring] = await Promise.all([
    profitAndLoss(start, end, `${month}-01`, `${next}-01`),
    stockValuation(),
    db.expense.findMany({ where: { date: { gte: `${month}-01`, lt: `${next}-01` } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { store: { select: { name: true } } } }),
    db.store.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.recurringCost.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }], include: { store: { select: { name: true } } } }),
  ]);
  const closed = await isMonthClosed(month);
  const label = new Date(`${month}-15T12:00:00+05:45`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const row = (l: string, v: number, opts: { bold?: boolean; neg?: boolean; muted?: boolean } = {}) => (
    <div className={`flex justify-between px-5 py-2 ${opts.bold ? "border-t border-line font-semibold" : ""} ${opts.muted ? "text-muted" : ""}`}>
      <span>{l}</span><span className="tabular-nums">{opts.neg && v ? `−${formatPrice(v)}` : formatPrice(v)}</span>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Finance"
        description={`Profit & loss for ${label} — revenue by order date, cost of goods at the cost recorded when each item was sold.`}
        actions={<form className="flex gap-2"><input type="month" name="month" defaultValue={month} max={thisMonth} aria-label="Month" className="h-10 rounded-md border border-line bg-white px-3 text-[14px]" /><button className="h-10 rounded-md border border-line bg-white px-3 text-[14px] hover:border-ink">Go</button><Link href={`/admin/finance/shops?month=${month}`} className="flex h-10 items-center rounded-md border border-line bg-white px-3 text-[14px] hover:border-ink">Profit by shop</Link><Link href={`/admin/finance/budgets?month=${month}`} className="flex h-10 items-center rounded-md border border-line bg-white px-3 text-[14px] hover:border-ink">Budgets</Link><Link href="/admin/finance/bank" className="flex h-10 items-center rounded-md border border-line bg-white px-3 text-[14px] hover:border-ink">Bank statements</Link><Link href={`/admin/finance/close?month=${month}`} className="flex h-10 items-center rounded-md border border-line bg-white px-3 text-[14px] hover:border-ink">Month-end close</Link><Link href="/admin/finance/export" className="flex h-10 items-center rounded-md bg-ink px-3 text-[14px] text-white">Accounting export</Link></form>}
      />
      {closed && <p className="mb-4 rounded-md bg-cloud px-4 py-3 text-[14px]">{month} is closed: its expenses, bills and payments are locked. <Link href={`/admin/finance/close?month=${month}`} className="underline">Month-end close</Link></p>}
      {(pl.unitsWithoutCost > 0 || stock.skusWithoutCost > 0) && (
        <p className="mb-4 flex gap-2 rounded-md bg-[#fbf1df] px-4 py-3 text-[14px] text-warn"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {pl.unitsWithoutCost > 0 && `${pl.unitsWithoutCost} units sold this month had no purchase cost, so profit is overstated. `}
          {stock.skusWithoutCost > 0 && `${stock.skusWithoutCost} SKUs in stock have no cost — set it in the product editor or receive them through a purchase order.`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Net sales", formatPrice(pl.netSales), `${pl.orders} orders`],
          ["Gross profit", formatPrice(pl.grossProfit), `${pl.grossMargin}% margin`],
          ["Net profit", formatPrice(pl.netProfit), `after ${formatPrice(pl.totalExpenses)} expenses`],
          ["Stock value (cost)", formatPrice(stock.atCost), `${stock.units.toLocaleString("en-IN")} units · retail ${formatPrice(stock.atRetail)}`],
        ].map(([l, v, s]) => <Card key={l} className="p-5"><p className="text-[13px] text-muted">{l}</p><p className="mt-1 whitespace-nowrap text-[22px] font-semibold tabular-nums">{v}</p><p className="text-[12.5px] text-muted">{s}</p></Card>)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title={`Profit & loss · ${label}`}>
          <div className="py-2 text-[14px]">
            {row("Gross sales", pl.gross)}
            {row("Discounts", pl.discounts, { neg: true, muted: true })}
            {row("Returns & refunds", pl.refunds, { neg: true, muted: true })}
            {row("Net sales", pl.netSales, { bold: true })}
            {row("Cost of goods sold", pl.cogs, { neg: true, muted: true })}
            {row("Gross profit", pl.grossProfit, { bold: true })}
            {row("Delivery charged to customers", pl.deliveryIncome, { muted: true })}
            {pl.expenses.map((e) => <div key={e.category}>{row(e.label, e.amount, { neg: true, muted: true })}</div>)}
            {row("Net profit", pl.netProfit, { bold: true })}
          </div>
        </Card>
        <Card title="Most profitable products">
          <table className="w-full text-[13.5px]">
            <thead><tr className="text-left text-[11.5px] uppercase tracking-wider text-muted"><th className="px-5 py-2">Product</th><th className="text-right">Units</th><th className="text-right">Revenue</th><th className="text-right">Profit</th><th className="px-5 text-right">Margin</th></tr></thead>
            <tbody className="divide-y divide-line">
              {pl.products.slice(0, 12).map((p) => (
                <tr key={p.id}><td className="px-5 py-2"><Link href={`/admin/products/${p.id}`} className="hover:underline">{p.name}</Link></td><td className="text-right tabular-nums">{p.units}</td><td className="text-right tabular-nums">{formatPrice(p.revenue)}</td><td className="text-right font-medium tabular-nums">{formatPrice(p.profit)}</td><td className={`px-5 text-right tabular-nums ${p.margin < 30 ? "text-warn" : ""}`}>{p.margin}%</td></tr>
              ))}
            </tbody>
          </table>
          {!pl.products.length && <p className="p-5 text-muted">No sales this month.</p>}
        </Card>
      </div>

      <Card title="Expenses" className="mt-4">
        <ExpenseForm defaultDate={month === thisMonth ? ktmDate() : `${month}-01`} locations={locations} />
        <table className="w-full text-[13.5px]">
          <tbody className="divide-y divide-line">
            {expenses.map((e) => (
              <tr key={e.id}><td className="px-5 py-2 text-muted">{formatDate(`${e.date}T12:00:00+05:45`)}</td><td>{EXPENSE_LABEL[e.category]}</td><td>{e.description}{e.paidVia ? <span className="text-muted"> · {e.paidVia}</span> : null}</td><td className="text-[12.5px] text-muted">{e.store?.name ?? "HQ"}</td><td className={`px-5 text-right tabular-nums ${e.amount < 0 ? "text-success" : ""}`}>{formatPrice(e.amount)}</td></tr>
            ))}
          </tbody>
        </table>
        {!expenses.length && <p className="px-5 pb-5 text-muted">No expenses recorded for this month.</p>}
      </Card>

      <Card title="Monthly costs (posted automatically on the 1st)" className="mt-4">
        <ul className="divide-y divide-line">{recurring.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-[13.5px]">
            <span className={c.active ? "" : "text-muted line-through"}>{c.store?.name ?? "HQ"} · {EXPENSE_LABEL[c.category]} · {c.description}<span className="text-muted"> · from {c.startMonth}{c.endMonth ? ` to ${c.endMonth}` : ""}</span></span>
            <span className="flex items-center gap-3"><span className="font-medium tabular-nums">{formatPrice(c.amount)}</span><RecurringForm locations={locations} thisMonth={thisMonth} initial={c} /></span>
          </li>
        ))}</ul>
        <div className="border-t border-line"><RecurringForm locations={locations} thisMonth={thisMonth} /></div>
      </Card>
    </>
  );
}
