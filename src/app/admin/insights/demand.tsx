import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Search, Bell, Eye, Tag } from "lucide-react";
import { demandPicture, demandRadar, type DemandRow } from "@/lib/demand";
import { store } from "@/lib/config";
import { ktmDate } from "@/lib/pos";
import { cn, formatDate } from "@/lib/utils";
import { Card, Pill } from "@/components/admin/ui";

const th = "px-3 py-2.5 text-left text-[12px] font-medium uppercase tracking-wider text-muted";
const num = "px-3 py-2 text-right tabular-nums";
const pct = (x: number | null) => (x == null ? "" : `${x > 0 ? "+" : ""}${Math.round(x * 100)}%`);

/** A year of weekly sales as tiny bars, the last 8 weeks darker. */
function Spark({ h }: { h: number[] }) {
  const max = Math.max(1, ...h);
  return (
    <svg viewBox={`0 0 ${h.length * 3} 24`} className="h-6 w-[120px]" aria-hidden preserveAspectRatio="none">
      {h.map((v, i) => <rect key={i} x={i * 3} y={24 - (v / max) * 24} width={2} height={(v / max) * 24} className={i >= h.length - 8 ? "fill-ink" : "fill-line"} />)}
    </svg>
  );
}

const TREND = { rising: ["Rising", "success"], falling: ["Falling", "danger"], steady: ["Steady", "neutral"], new: ["New", "neutral"] } as const;

function Radar({ title, icon, empty, children }: { title: string; icon: React.ReactNode; empty: boolean; children: React.ReactNode }) {
  return (
    <Card title={title} action={icon}>
      {empty ? <p className="p-5 text-[13.5px] text-muted">Nothing to flag.</p> : <ul className="divide-y divide-line text-[13.5px]">{children}</ul>}
    </Card>
  );
}
const row = "flex items-center justify-between gap-3 px-5 py-2";
const pname = (r: { slug: string; product?: string; name?: string }) => <Link href={`/p/${r.slug}`} className="truncate font-medium hover:underline" target="_blank">{r.product ?? r.name}</Link>;

export async function Demand() {
  const today = ktmDate();
  const [{ rows, horizon, weeks }, radar] = await Promise.all([demandPicture(today), demandRadar(today)]);
  const selling = rows.filter((r) => r.sold52 > 0).sort((a, b) => b.f.total - a.f.total);
  const totalNext = selling.reduce((s, r) => s + r.f.total, 0);
  const reorders = selling.filter((r) => r.plan.reorder > 0);
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [`Units, next ${horizon} weeks`, Math.round(totalNext).toLocaleString("en-IN")],
          ["Rising products", radar.rising.length],
          ["Run out within lead time", selling.filter((r) => r.plan.urgent).length],
          ["Products to reorder", reorders.length],
        ].map(([k, v]) => <div key={k as string} className="rounded-lg border border-line bg-white p-4"><p className="text-[12px] uppercase tracking-wider text-muted">{k}</p><p className="mt-1 text-[22px] font-semibold tabular-nums">{v}</p></div>)}
      </div>
      {radar.festivalAhead && <p className="mb-4 rounded-lg border border-accent/30 bg-accent-soft/50 px-5 py-3 text-[13.5px]"><span className="font-medium">A festival is coming up.</span> The forecast includes the festival lift ({store.insights.festivalUplift}× until a year of your own history replaces it), from the public holidays on the Rosters page.</p>}

      <div className="grid gap-4 xl:grid-cols-3">
        <Radar title="Rising" icon={<ArrowUpRight className="h-4 w-4 text-success" />} empty={!radar.rising.length}>
          {radar.rising.map((r) => <li key={r.productId} className={row}>{pname(r)}<span className="shrink-0 tabular-nums text-success">{pct(r.f.change)} · {r.sold4} in 4 wks</span></li>)}
        </Radar>
        <Radar title="Falling" icon={<ArrowDownRight className="h-4 w-4 text-danger" />} empty={!radar.falling.length}>
          {radar.falling.map((r) => <li key={r.productId} className={row}>{pname(r)}<span className="shrink-0 tabular-nums text-danger">{pct(r.f.change)} · {r.stock} in stock</span></li>)}
        </Radar>
        <Radar title="Running out" icon={<Tag className="h-4 w-4 text-warn" />} empty={!radar.runningOut.length}>
          {radar.runningOut.map((r) => <li key={r.productId} className={row}>{pname(r)}<span className={cn("shrink-0 tabular-nums", r.plan.urgent ? "font-medium text-danger" : "text-warn")}>{r.plan.daysLeft} days · reorder {r.plan.reorder}</span></li>)}
        </Radar>
        <Radar title="Searched, found nothing" icon={<Search className="h-4 w-4 text-muted" />} empty={!radar.searches.length}>
          {radar.searches.map((s) => <li key={s.term} className={row}><span className="truncate">“{s.term}”</span><span className="shrink-0 tabular-nums text-muted">{s.times}× in 30 days</span></li>)}
        </Radar>
        <Radar title="Waiting for a size" icon={<Bell className="h-4 w-4 text-muted" />} empty={!radar.waiting.length && !radar.watching.length}>
          {radar.waiting.map((w) => <li key={`${w.slug}${w.size}${w.color}`} className={row}><span className="min-w-0 truncate">{pname(w)} <span className="text-muted">· {w.color} {w.size}</span></span><span className="shrink-0 tabular-nums">{w.people} waiting</span></li>)}
          {radar.watching.map((w) => <li key={`p${w.slug}`} className={row}>{pname(w)}<span className="shrink-0 tabular-nums text-muted">{w.people} want a lower price</span></li>)}
        </Radar>
        <Radar title="Looked at, rarely bought" icon={<Eye className="h-4 w-4 text-muted" />} empty={!radar.browsedNotBought.length}>
          {radar.browsedNotBought.map((b) => <li key={b.slug} className={row}>{pname(b)}<span className="shrink-0 tabular-nums text-muted">{b.views} views · {b.adds} adds · {b.sold} sold</span></li>)}
        </Radar>
      </div>

      <Card title={`Forecast by product · next ${horizon} weeks`} className="mt-4">
        {!selling.length ? <p className="p-8 text-center text-[14px] text-muted">No sales yet in the last {weeks} weeks: the forecast starts with the first orders.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr>
                <th className={th}>Product</th><th className={th}>{weeks} weeks</th><th className={cn(th, "text-right")}>Last 4 wks</th><th className={cn(th, "text-right")}>Forecast (80% range)</th><th className={th}>Trend</th>
                <th className={cn(th, "text-right")}>Stock</th><th className={cn(th, "text-right")}>Lasts</th><th className={cn(th, "text-right")}>Reorder</th>
              </tr></thead>
              <tbody className="divide-y divide-line">{selling.slice(0, 100).map((r) => <ForecastRow key={r.productId} r={r} />)}</tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">
          Weekly sales, online and at the till, not cancelled or returned. Regular sellers use a damped-trend model (a hot month doesn&apos;t grow forever); slow, lumpy sellers use the average rate (Croston). Reorder = enough to last {store.insights.leadTimeDays} days of lead time plus {store.insights.coverDays} days of cover, less stock and units already on purchase orders, split across sizes by how they sold in the last quarter. Updated hourly.
        </p>
      </Card>
    </>
  );
}

function ForecastRow({ r }: { r: DemandRow }) {
  const [label, tone] = TREND[r.f.trend];
  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <details>
          <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">{r.name} <span className="text-[12px] font-normal text-muted">· {r.category} · sizes ▾</span></summary>
          <table className="mt-2 text-[12.5px]"><tbody>{r.sizes.map((s) => (
            <tr key={s.size}><td className="pr-4 font-medium">{s.size}</td><td className="pr-4 text-muted">{Math.round(s.share * 100)}%</td><td className="pr-4 tabular-nums">{s.forecast} forecast</td><td className="pr-4 tabular-nums">{s.stock} in stock</td><td className={cn("tabular-nums", s.reorder > 0 && "font-medium text-warn")}>{s.reorder ? `order ${s.reorder}` : "—"}</td></tr>
          ))}</tbody></table>
        </details>
      </td>
      <td className="px-3 py-2"><Spark h={r.history} /></td>
      <td className={num}>{r.sold4}</td>
      <td className={num}><span className="font-medium">{Math.round(r.f.total)}</span> <span className="text-[12px] text-muted">({Math.round(r.f.low)}–{Math.round(r.f.high)})</span></td>
      <td className="px-3 py-2"><Pill tone={tone}>{label}{r.f.change != null && r.f.trend !== "steady" ? ` ${pct(r.f.change)}` : ""}</Pill></td>
      <td className={num}>{r.stock}{r.onOrder ? <span className="block text-[12px] text-muted">+{r.onOrder} coming</span> : null}</td>
      <td className={cn(num, r.plan.urgent && "font-medium text-danger")}>{r.plan.daysLeft == null ? "—" : `${r.plan.daysLeft} days`}{r.plan.runsOut && <span className="block text-[12px] font-normal text-muted">{formatDate(new Date(`${r.plan.runsOut}T00:00:00Z`))}</span>}</td>
      <td className={cn(num, r.plan.reorder > 0 && "font-semibold")}>{r.plan.reorder || "—"}</td>
    </tr>
  );
}
