import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { store } from "@/lib/config";
import { getCategoryTree } from "@/lib/catalog";
import { deadStock, marginPct, reorderPlan, searchInsights, sizeColourMix, type MixRow } from "@/lib/insights";
import { cn, formatDate, formatPrice } from "@/lib/utils";
import { customerInsights, funnelInsights } from "@/lib/customer-insights";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { Demand } from "./demand";
import { Pulse } from "./pulse";

export const metadata = { title: "Insights" };

const TABS = [
  { id: "pulse", label: "KPI pulse" },
  { id: "demand", label: "Demand forecast" },
  { id: "reorder", label: "What to reorder" },
  { id: "dead", label: "Dead stock" },
  { id: "mix", label: "Sizes & colours" },
  { id: "search", label: "What shoppers search" },
  { id: "customers", label: "Customers" },
  { id: "funnel", label: "Shop funnel" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const th = "px-3 py-2.5 text-left text-[12px] font-medium uppercase tracking-wider text-muted";
const num = "px-3 py-2 text-right tabular-nums";

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ tab?: string; days?: string; category?: string }> }) {
  const me = await requirePermission("insights");
  const showCost = can(me.role, "finance");
  const sp = await searchParams;
  const tab: Tab = TABS.find((t) => t.id === sp.tab)?.id ?? "pulse";
  const href = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ tab });
    for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
    return `/admin/insights?${p}`;
  };

  return (
    <>
      <PageHeader title="Insights" description="Buying and merchandising signals from your own sales: what's going to sell, what to reorder, what isn't moving, which sizes and colours earn, and what shoppers look for." />
      <nav className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-line px-1" aria-label="Insights">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/insights?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined} className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px]", tab === t.id ? "border-ink font-medium" : "border-transparent text-muted hover:text-ink")}>{t.label}</Link>
        ))}
      </nav>
      {tab === "pulse" && <Pulse showCost={showCost} />}
      {tab === "demand" && <Demand />}
      {tab === "reorder" && <Reorder showCost={showCost} />}
      {tab === "dead" && <Dead showCost={showCost} />}
      {tab === "mix" && <Mix showCost={showCost} days={[30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 90} category={sp.category} href={href} />}
      {tab === "search" && <Searches />}
      {tab === "customers" && <Customers />}
      {tab === "funnel" && <Funnel />}
    </>
  );
}

async function Reorder({ showCost }: { showCost: boolean }) {
  const rows = await reorderPlan();
  const now = rows.filter((r) => r.urgency === "now");
  const budget = rows.reduce((s, r) => s + (r.cost ?? 0) * r.suggested, 0);
  return (
    <Card title={`${now.length} to order now · ${rows.length - now.length} soon`} action={<Link href="/admin/purchasing" className="text-[13px] underline">Start a purchase order →</Link>}>
      <p className="border-b border-line px-5 py-3 text-[13px] text-muted">
        Based on how fast each size sells (last 30 days, steadied by 90) and what&apos;s already on order. <b>Order now</b> = runs out before a new order could arrive ({store.insights.leadTimeDays} days); <b>soon</b> = within two weeks after that. Quantities cover the lead time plus {store.insights.coverDays} days.
        {showCost && budget > 0 && <> Buying everything suggested costs about <b>{formatPrice(budget)}</b>.</>}
      </p>
      {!rows.length ? <p className="p-10 text-center text-muted">Nothing is running low against its sales speed. 👍</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Item</th><th className={cn(th, "text-right")}>In stock</th><th className={cn(th, "text-right")}>On order</th><th className={cn(th, "text-right")}>Sells / week</th><th className={cn(th, "text-right")}>Lasts</th><th className={cn(th, "text-right")}>Order</th>{showCost && <th className={cn(th, "text-right")}>Cost</th>}<th className={th}>Last supplier</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.variantId}>
                  <td className="px-3 py-2"><span className="font-medium">{r.name}</span> · {r.color} {r.size}<span className="block font-mono text-[11.5px] text-muted">{r.sku}</span></td>
                  <td className={num}>{r.stock}</td>
                  <td className={num}>{r.incoming || "—"}</td>
                  <td className={num}>{r.perWeek}</td>
                  <td className={num}><Pill tone={r.urgency === "now" ? "danger" : "warn"}>{r.daysLeft} days</Pill></td>
                  <td className={cn(num, "font-semibold")}>{r.suggested}</td>
                  {showCost && <td className={num}>{r.cost != null ? formatPrice(r.cost * r.suggested) : "—"}</td>}
                  <td className="px-3 text-muted">{r.supplierName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

async function Dead({ showCost }: { showCost: boolean }) {
  const d = await deadStock();
  return (
    <Card title={`${d.rows.length} sizes · ${d.units.toLocaleString("en-IN")} units not sold in ${store.insights.deadStockDays}+ days${showCost && d.value ? ` · ${formatPrice(d.value)} at cost` : ""}`}>
      <p className="border-b border-line px-5 py-3 text-[13px] text-muted">Cash sitting on shelves. Options: move it to the shop that sells that style (Transfers), mark it down, bundle it, or stop reordering it. Sorted by money tied up.</p>
      {!d.rows.length ? <p className="p-10 text-center text-muted">Everything in stock has sold recently. 🎉</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Item</th><th className={cn(th, "text-right")}>Units</th>{showCost && <th className={cn(th, "text-right")}>At cost</th>}<th className={th}>Last sold</th><th className={th}>Where</th></tr></thead>
            <tbody className="divide-y divide-line">
              {d.rows.slice(0, 200).map((r) => (
                <tr key={r.variantId}>
                  <td className="px-3 py-2"><Link href={`/admin/products/${r.productId}`} className="font-medium hover:underline">{r.name}</Link> · {r.color} {r.size}<span className="block font-mono text-[11.5px] text-muted">{r.sku}</span></td>
                  <td className={num}>{r.stock}</td>
                  {showCost && <td className={num}>{r.value != null ? formatPrice(r.value) : "—"}</td>}
                  <td className="px-3 text-muted">{r.lastSold ? `${formatDate(r.lastSold)} (${r.days} days)` : `never (${r.days} days in range)`}</td>
                  <td className="px-3 text-[12.5px] text-muted">{r.where.map((w) => `${w.code} ${w.quantity}`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

async function Mix({ showCost, days, category, href }: { showCost: boolean; days: number; category?: string; href: (q: Record<string, string | undefined>) => string }) {
  const [tree, mix] = await Promise.all([getCategoryTree(), sizeColourMix({ days, categoryId: category })]);
  const cats = tree.flatMap((r) => [{ id: r.id, name: r.name }, ...r.children.map((c) => ({ id: c.id, name: `${r.name} / ${c.name}` }))]);
  const chip = (active: boolean) => cn("rounded-md px-3 py-1.5 text-[13px]", active ? "bg-ink text-white" : "border border-line bg-white hover:border-ink");
  const table = (title: string, rows: MixRow[]) => {
    const best = Math.max(...rows.map((r) => r.sellThrough));
    // flag outliers against this list's own average, not a fixed number (stock levels differ by business)
    const live = rows.filter((r) => r.units + r.stock > 10);
    const avg = live.reduce((s, r) => s + r.sellThrough, 0) / (live.length || 1);
    return (
      <Card title={title}>
        {!rows.length ? <p className="p-8 text-center text-muted">No sales in this period.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>{title === "By size" ? "Size" : "Colour"}</th><th className={cn(th, "text-right")}>Sold</th><th className={cn(th, "text-right")}>Share</th><th className={cn(th, "text-right")}>In stock</th><th className={cn(th, "text-right")}>Sell-through</th><th className={cn(th, "text-right")}>Revenue</th>{showCost && <th className={cn(th, "text-right")}>Margin</th>}</tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const m = marginPct(r);
                  return (
                    <tr key={r.key}>
                      <td className="px-3 py-2 font-medium">{r.key}</td>
                      <td className={num}>{r.units}</td>
                      <td className={num}><span className="mr-2 inline-block h-1.5 rounded bg-ink/70 align-middle" style={{ width: `${Math.max(2, r.share)}px` }} aria-hidden />{r.share}%</td>
                      <td className={num}>{r.stock}</td>
                      <td className={cn(num, r.sellThrough === best && r.units > 0 && "font-semibold text-success", r.units + r.stock > 10 && r.sellThrough < avg / 2 && "text-danger")}>{r.sellThrough}%</td>
                      <td className={num}>{formatPrice(r.revenue)}</td>
                      {showCost && <td className={num}>{m == null ? "—" : `${m}%`}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[30, 90, 365].map((d) => <Link key={d} href={href({ days: String(d), category })} className={chip(days === d)}>{d === 365 ? "1 year" : `${d} days`}</Link>)}
        <form className="ml-auto flex gap-2" action="/admin/insights">
          <input type="hidden" name="tab" value="mix" /><input type="hidden" name="days" value={days} />
          <select name="category" defaultValue={category ?? ""} aria-label="Category" className="h-9 rounded-md border border-line bg-white px-2 text-[13.5px]">
            <option value="">All categories</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="h-9 rounded-md bg-ink px-3 text-[13.5px] text-white">Show</button>
        </form>
      </div>
      <p className="text-[13px] text-muted">{mix.units.toLocaleString("en-IN")} units sold. <b>Sell-through</b> = sold ÷ (sold + still in stock): green is the best seller for its stock; red is under half the average, so you over-bought it.{showCost ? " Margin is after discounts, on items whose cost is known." : ""}</p>
      <div className="grid gap-4 xl:grid-cols-2">
        {table("By size", mix.sizes)}
        {table("By colour", mix.colours)}
      </div>
    </div>
  );
}

async function Searches() {
  const s = await searchInsights(30);
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">Last 30 days: {s.searches.toLocaleString("en-IN")} searches, {s.zeroResults.toLocaleString("en-IN")} found nothing{s.searches ? ` (${Math.round((s.zeroResults / s.searches) * 100)}%)` : ""}. Searches that find nothing are lost sales: add the product, or add the shopper&apos;s word to a product&apos;s tags.</p>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Found nothing">
          {!s.zero.length ? <p className="p-8 text-center text-muted">Every search found something.</p> : (
            <table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Search</th><th className={cn(th, "text-right")}>Times</th><th className={th}>Now</th></tr></thead>
              <tbody className="divide-y divide-line">
                {s.zero.map((z) => (
                  <tr key={z.term}><td className="px-3 py-2 font-medium">{z.term}</td><td className={num}>{z.zero}</td><td className="px-3">{z.stillZero ? <Pill tone="danger">still nothing</Pill> : <Pill tone="success">finds results</Pill>}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Top searches">
          {!s.top.length ? <p className="p-8 text-center text-muted">No searches yet.</p> : (
            <table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Search</th><th className={cn(th, "text-right")}>Times</th><th className={cn(th, "text-right")}>Found nothing</th></tr></thead>
              <tbody className="divide-y divide-line">
                {s.top.map((t) => (
                  <tr key={t.term}><td className="px-3 py-2"><Link href={`/shop?q=${encodeURIComponent(t.term)}`} className="font-medium hover:underline" target="_blank">{t.term}</Link></td><td className={num}>{t.searches}</td><td className={num}>{t.zero || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

async function Customers() {
  const c = await customerInsights();
  const tile = (l: string, v: string, sub: string) => <div className="rounded-lg border border-line bg-white p-4"><p className="text-[12px] uppercase tracking-wider text-muted">{l}</p><p className="mt-1 text-[22px] font-semibold">{v}</p><p className="text-[12.5px] text-muted">{sub}</p></div>;
  const heat = (v: number | null) => (v == null ? "" : v >= 30 ? "bg-ink text-white" : v >= 15 ? "bg-ink/60 text-white" : v >= 5 ? "bg-ink/25" : v > 0 ? "bg-ink/10" : "");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tile("Repeat customers", `${c.repeatRate}%`, `of ${c.customers.toLocaleString("en-IN")} customers bought 2+ times`)}
        {tile("Revenue from repeaters", `${c.repeatRevenueShare}%`, "of goods revenue")}
        {tile("Lifetime value", formatPrice(c.lifetimeValue), `${c.ordersPerCustomer} orders per customer`)}
        {tile("Comes back after", c.daysBetweenOrders == null ? "—" : `${c.daysBetweenOrders} days`, `on average · ${c.omnichannel} buy both online and in store`)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Segments">
          <table className="w-full text-[13.5px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Segment</th><th className={cn(th, "text-right")}>Customers</th><th className={cn(th, "text-right")}>Revenue</th></tr></thead>
            <tbody className="divide-y divide-line">
              {c.segments.map((x) => <tr key={x.key}><td className="px-3 py-2"><span className="font-medium">{x.label}</span><span className="block text-[12px] text-muted">{x.hint}</span></td><td className={num}>{x.customers}</td><td className={num}>{formatPrice(x.revenue)}</td></tr>)}
            </tbody>
          </table>
        </Card>
        <Card title="Top customers">
          <table className="w-full text-[13.5px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Customer</th><th className={cn(th, "text-right")}>Orders</th><th className={cn(th, "text-right")}>Spent</th><th className={th}>Last order</th></tr></thead>
            <tbody className="divide-y divide-line">
              {c.top.map((t, i) => <tr key={i}><td className="px-3 py-2"><span className="font-medium">{t.name}</span> <span className="text-[12px] text-muted">{t.phone}</span></td><td className={num}>{t.orders}</td><td className={num}>{formatPrice(t.revenue)}</td><td className="px-3 text-muted">{formatDate(t.last)}</td></tr>)}
            </tbody>
          </table>
        </Card>
      </div>
      <Card title="Do new customers come back? (share of each month's new customers who bought again N months later)">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>First order</th><th className={cn(th, "text-right")}>New customers</th>{[1, 2, 3, 4, 5, 6].map((k) => <th key={k} className={cn(th, "text-center")}>+{k} mo</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {c.cohorts.map((r) => (
                <tr key={r.month}><td className="px-3 py-1.5 font-medium">{r.month}</td><td className={num}>{r.size}</td>{r.retention.map((v, i) => <td key={i} className={cn("px-1 py-1.5 text-center tabular-nums", heat(v))}>{v == null ? "" : `${v}%`}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

async function Funnel() {
  const f = await funnelInsights(30);
  const step = (l: string, v: number, rate: number | null, sub: string) => (
    <div className="rounded-lg border border-line bg-white p-4"><p className="text-[12px] uppercase tracking-wider text-muted">{l}</p><p className="mt-1 text-[22px] font-semibold">{v.toLocaleString("en-IN")}</p><p className="text-[12.5px] text-muted">{rate == null ? "—" : `${rate}% ${sub}`}</p></div>
  );
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">Online only, from {formatDate(`${f.since}T12:00:00+05:45`)} (last 30 days{f.countingStarted && f.countingStarted === f.since ? ", or since views were first counted" : ""}). Counted per page view, not per person; bots excluded.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-line bg-white p-4"><p className="text-[12px] uppercase tracking-wider text-muted">Product views</p><p className="mt-1 text-[22px] font-semibold">{f.views.toLocaleString("en-IN")}</p><p className="text-[12.5px] text-muted">product pages opened</p></div>
        {step("Added to bag", f.adds, f.rates.viewToAdd, "of views")}
        {step("Checkout visits", f.checkouts, f.rates.addToCheckout, "of adds")}
        {step("Orders", f.orders, f.rates.checkoutToOrder, "of checkout visits")}
      </div>
      <Card title="By product">
        {!f.products.length ? <p className="p-8 text-center text-muted">No product views counted yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Product</th><th className={cn(th, "text-right")}>Views</th><th className={cn(th, "text-right")}>To bag</th><th className={cn(th, "text-right")}>Bag rate</th><th className={cn(th, "text-right")}>Units sold</th><th className={cn(th, "text-right")}>Sold per 100 views</th></tr></thead>
              <tbody className="divide-y divide-line">
                {f.products.map((p) => (
                  <tr key={p.productId}>
                    <td className="px-3 py-2"><Link href={`/admin/products/${p.productId}`} className="font-medium hover:underline">{p.name}</Link>{p.weak && <span className="ml-2"><Pill tone="warn">few add it to bag</Pill></span>}</td>
                    <td className={num}>{p.views}</td><td className={num}>{p.adds}</td><td className={num}>{p.addRate == null ? "—" : `${p.addRate}%`}</td><td className={num}>{p.sold}</td><td className={num}>{p.orderRate == null ? "—" : p.orderRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">“Few add it to bag” = 50+ views but under half the shop&apos;s average bag rate: check the photos, price, size availability and description.</p>
      </Card>
    </div>
  );
}
