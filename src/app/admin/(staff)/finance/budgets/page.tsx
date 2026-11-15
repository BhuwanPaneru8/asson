import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ktmDate } from "@/lib/pos";
import { budgetReport, shiftMonth } from "@/lib/budgets";
import { cn, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { BudgetEditor } from "@/components/admin/budget-editor";

export const metadata = { title: "Budgets" };
const th = "px-3 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wider text-muted whitespace-nowrap";
const money = (v: number | null) => (v === null ? "—" : v < 0 ? `−${formatPrice(-v)}` : formatPrice(v));

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePermission("finance");
  const thisMonth = ktmDate().slice(0, 7);
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : thisMonth;
  const [r, locations, budgets] = await Promise.all([
    month <= thisMonth ? budgetReport(month) : Promise.resolve(null),
    db.store.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.shopBudget.findMany({ where: { month } }),
  ]);
  const b = new Map(budgets.map((x) => [x.storeId, x]));
  const label = new Date(`${month}-15T12:00:00+05:45`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const pct = Math.round((r?.progress ?? 0) * 100);
  return (
    <>
      <PageHeader title={`Budgets · ${label}`} description="Each location's sales target, margin target and cost budget, against the month's actuals. For the month in progress: where each should be by now and where it's heading." actions={<span className="flex items-center gap-2 text-[13.5px]"><Link href={`/admin/finance/budgets?month=${shiftMonth(month, -1)}`} className="underline">← {shiftMonth(month, -1)}</Link><Link href={`/admin/finance/budgets?month=${shiftMonth(month, 1)}`} className="underline">{shiftMonth(month, 1)} →</Link><Link href={`/admin/finance/shops?month=${month}`} className="ml-2 underline">Profit by shop</Link></span>} />
      {r && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Sales target", formatPrice(r.total.target)], [`Actual (${pct}% of the month gone)`, formatPrice(r.total.actual)], ["Heading for", r.progress < 1 ? formatPrice(r.total.forecast) : "—"], ["Locations behind", String(r.total.behind)]].map(([l, v]) => (
              <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className={cn("mt-1 text-[22px] font-semibold tabular-nums", l === "Locations behind" && r.total.behind > 0 && "text-danger")}>{v}</p></div></Card>
            ))}
          </div>
          <Card title="Plan vs actual" className="mb-4">
            <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={cn(th, "text-left")}>Location</th><th className={th}>Target</th><th className={th}>Actual</th><th className={th}>Achieved</th>{r.progress < 1 && <><th className={th}>Expected by now</th><th className={th}>Heading for</th></>}<th className={th}>Gross margin</th><th className={th}>Costs vs budget</th><th className={th}>Profit vs plan</th></tr></thead>
              <tbody className="divide-y divide-line">{r.rows.map((x) => (
                <tr key={x.storeId}>
                  <td className="px-3 py-2"><span className="font-medium">{x.name}</span>{x.pace && <span className="ml-1.5"><Pill tone={x.pace === "behind" ? "danger" : x.pace === "ahead" ? "success" : "neutral"}>{x.pace}</Pill></span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(x.target)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(x.netSales)}</td>
                  <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", x.achieved !== null && x.achieved >= 100 && "text-success")}>{x.achieved === null ? "—" : `${x.achieved}%`}</td>
                  {r.progress < 1 && <><td className="px-3 py-2 text-right tabular-nums text-muted">{money(x.expectedByNow)}</td><td className={cn("px-3 py-2 text-right tabular-nums", x.pace === "behind" && "text-danger")}>{x.target ? money(x.forecast) : "—"}</td></>}
                  <td className="px-3 py-2 text-right tabular-nums">{x.grossMargin === null ? "—" : `${x.grossMargin}%`}{x.marginTarget !== null && <span className={cn("block text-[12px]", x.grossMargin !== null && x.grossMargin < x.marginTarget ? "text-danger" : "text-muted")}>target {x.marginTarget}%</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(x.staff + x.rent + x.other)}{x.costBudget !== null && <span className={cn("block text-[12px]", (x.costVariance ?? 0) < 0 ? "text-danger" : "text-muted")}>budget {money(x.costBudget)}</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(x.profit)}{x.profitPlan !== null && <span className={cn("block text-[12px]", (x.profitVariance ?? 0) < 0 ? "text-danger" : "text-success")}>{(x.profitVariance ?? 0) >= 0 ? "+" : ""}{money(x.profitVariance)} vs plan</span>}</td>
                </tr>
              ))}</tbody>
            </table></div>
            {r.unplanned > 0 && <p className="border-t border-line px-4 py-3 text-[12.5px] text-warn">{r.unplanned} shop(s) have no plan for this month.</p>}
          </Card>
        </>
      )}
      <Card title={`Set the plan · ${label}`}>
        <BudgetEditor month={month} initial={locations.map((l) => { const x = b.get(l.id); return { storeId: l.id, name: l.name, sales: x?.sales ?? null, marginPct: x?.marginPm == null ? null : x.marginPm / 10, costs: x?.costs ?? null }; })} />
      </Card>
    </>
  );
}
