import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { scopeFor } from "@/lib/scope";
import { cashierReport, networkAlerts, networkReport, type Grouping } from "@/lib/network";
import { cn, formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Network" };

const th = "px-3 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";
const num = "px-3 py-2 text-right tabular-nums";

export default async function NetworkPage({ searchParams }: { searchParams: Promise<{ days?: string; group?: string }> }) {
  const me = await requirePermission("insights");
  const showCost = can(me.role, "finance");
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const group: Grouping = sp.group === "district" || sp.group === "province" ? sp.group : "location";
  const scope = await scopeFor(me);
  const [{ rows, total }, cashiers, alerts] = await Promise.all([networkReport({ days, scope, group }), cashierReport({ days, scope }), networkAlerts(scope)]);
  const href = (q: Record<string, string>) => `/admin/network?${new URLSearchParams({ days: String(days), group, ...q })}`;
  const chip = (on: boolean) => cn("rounded-md px-3 py-1.5 text-[13px]", on ? "bg-ink text-white" : "border border-line bg-white hover:border-ink");
  const growth = (g: number | null) => (g == null ? <span className="text-muted">new</span> : <span className={g >= 0 ? "text-success" : "text-danger"}>{g >= 0 ? "▲" : "▼"} {Math.abs(g)}%</span>);
  const tile = (l: string, v: React.ReactNode, sub: React.ReactNode) => <div className="rounded-lg border border-line bg-white p-4"><p className="text-[12px] uppercase tracking-wider text-muted">{l}</p><p className="mt-1 text-[22px] font-semibold tabular-nums">{v}</p><p className="text-[12.5px] text-muted">{sub}</p></div>;

  return (
    <>
      <PageHeader title="Network" description={`Every ${scope.all ? "" : "one of your "}location${scope.all ? " in the business" : "s"}: sales credited to where the goods came from (till and online), stock, and what needs chasing today.`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((d) => <Link key={d} href={href({ days: String(d) })} className={chip(days === d)}>{d} days</Link>)}
        <span className="mx-1 h-5 w-px bg-line" />
        {(["location", "district", "province"] as const).map((g) => <Link key={g} href={href({ group: g })} className={chip(group === g)}>By {g}</Link>)}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tile("Revenue", formatPrice(total.revenue), <>{growth(total.growth)} vs previous {days} days</>)}
        {tile("Units sold", total.units.toLocaleString("en-IN"), `${total.orders.toLocaleString("en-IN")} orders`)}
        {tile("Locations", total.locations, scope.all ? "active" : "yours")}
        {showCost ? tile("Margin", total.margin == null ? "—" : `${total.margin}%`, "after discounts") : tile("Avg. order", total.orders ? formatPrice(Math.round(total.revenue / total.orders)) : "—", "per order")}
        {showCost ? tile("Stock at cost", formatPrice(total.stockValue), "on hand now") : tile("Per location", total.locations ? formatPrice(Math.round(total.revenue / total.locations)) : "—", "average revenue")}
      </div>

      {alerts.length > 0 && (
        <Card title={`Needs attention (${alerts.length})`} className="mb-4">
          <ul className="divide-y divide-line">
            {alerts.slice(0, 30).map((a, i) => (
              <li key={i}><Link href={a.href} className={cn("flex items-center gap-2 px-5 py-2.5 text-[13.5px] hover:bg-cloud/40", a.tone === "danger" ? "text-danger" : "text-warn")}><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {a.text}</Link></li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={`League table · by ${group}`} className="mb-4">
        {!rows.length ? <p className="p-8 text-center text-muted">No locations yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>#</th><th className={th}>{group === "location" ? "Location" : group === "district" ? "District" : "Province"}</th><th className={cn(th, "text-right")}>Revenue</th><th className={cn(th, "text-right")}>Change</th><th className={cn(th, "text-right")}>Units</th><th className={cn(th, "text-right")}>Orders</th>{showCost && <th className={cn(th, "text-right")}>Margin</th>}<th className={cn(th, "text-right")}>Stock</th><th className={cn(th, "text-right")}>Cover</th><th className={cn(th, "text-right")}>Sell-through</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <td className="px-3 py-2 text-muted tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2"><span className="font-medium">{r.label}</span>{r.sub && <span className="block text-[12px] text-muted">{r.sub}</span>}{group !== "location" && <span className="block text-[12px] text-muted">{r.locations} location{r.locations === 1 ? "" : "s"}</span>}</td>
                    <td className={cn(num, "font-semibold")}>{formatPrice(r.revenue)}</td>
                    <td className={num}>{growth(r.growth)}</td>
                    <td className={num}>{r.units.toLocaleString("en-IN")}</td>
                    <td className={num}>{r.orders.toLocaleString("en-IN")}</td>
                    {showCost && <td className={num}>{r.margin == null ? "—" : `${r.margin}%`}</td>}
                    <td className={num}>{r.stockUnits.toLocaleString("en-IN")}</td>
                    <td className={cn(num, r.coverDays != null && r.coverDays < 7 && "text-danger")}>{r.coverDays == null ? "—" : `${r.coverDays} d`}</td>
                    <td className={num}>{r.sellThrough == null ? "—" : `${r.sellThrough}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">Cover = how many days today&apos;s stock lasts at this period&apos;s sales speed (red under a week). Sell-through = sold ÷ (sold + still in stock).</p>
      </Card>

      <Card title="At the tills">
        {!cashiers.length ? <p className="p-8 text-center text-muted">No till sales in this period.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Cashier</th><th className={cn(th, "text-right")}>Sales</th><th className={cn(th, "text-right")}>Revenue</th><th className={cn(th, "text-right")}>Avg. basket</th><th className={cn(th, "text-right")}>Discount given</th></tr></thead>
              <tbody className="divide-y divide-line">
                {cashiers.map((c) => (
                  <tr key={c.name}><td className="px-3 py-2 font-medium">{c.name}</td><td className={num}>{c.sales}</td><td className={num}>{formatPrice(c.revenue)}</td><td className={num}>{formatPrice(c.basket)}</td><td className={cn(num, c.discountPct > 5 && "text-warn")}>{c.discountPct}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
