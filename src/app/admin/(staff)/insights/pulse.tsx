import { pulseToday, type Kpi } from "@/lib/pulse";
import { cn, formatPrice } from "@/lib/utils";
import { Card } from "@/components/admin/ui";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmt = (k: Pick<Kpi, "format">, v: number | null) => (v == null ? "—" : k.format === "money" ? formatPrice(Math.round(v)) : k.format === "pct" ? `${(v * 100).toFixed(1)}%` : Math.round(v).toLocaleString("en-IN"));
const pct = (x: number | null) => (x == null ? "—" : `${x > 0 ? "+" : ""}${Math.round(x * 100)}%`);

function Spark({ s, bad }: { s: number[]; bad: boolean }) {
  const max = Math.max(1e-9, ...s);
  const pts = s.map((v, i) => `${(i / Math.max(1, s.length - 1)) * 100},${28 - (v / max) * 26}`).join(" ");
  return <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none" aria-hidden><polyline points={pts} fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className={bad ? "stroke-danger" : "stroke-ink"} /></svg>;
}

export async function Pulse({ showCost }: { showCost: boolean }) {
  const { kpis, forecast, yesterday } = await pulseToday();
  const day = WEEKDAY[new Date(`${yesterday}T00:00:00Z`).getUTCDay()];
  const shown = kpis.filter((k) => showCost || !k.ownerOnly);
  const alerts = shown.filter((k) => k.verdict.strength && (k.verdict.level === "low") === (k.goodWhen === "high"));
  return (
    <>
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-5 lg:col-span-2">
          <p className="text-[12px] uppercase tracking-wider text-muted">This month, forecast</p>
          <p className="mt-1 text-[26px] font-semibold tabular-nums">{formatPrice(forecast.revenue.expected)} <span className="text-[14px] font-normal text-muted">likely {formatPrice(forecast.revenue.low)}–{formatPrice(forecast.revenue.high)}</span></p>
          <p className="mt-1 text-[13.5px] text-ink-soft">{formatPrice(forecast.revenue.soFar)} so far · about {forecast.orders.expected.toLocaleString("en-IN")} orders by month end · {forecast.daysLeft} days to go, each at its weekday&apos;s usual level</p>
        </div>
        <div className={cn("rounded-lg border p-5", alerts.length ? "border-danger/30 bg-danger/5" : "border-line bg-white")}>
          <p className="text-[12px] uppercase tracking-wider text-muted">Unusual yesterday ({day})</p>
          {alerts.length ? <ul className="mt-2 space-y-1 text-[13.5px]">{alerts.map((k) => <li key={k.key}><span className="font-medium">{k.label}</span> {k.verdict.level === "low" ? "low" : "high"}: {fmt(k, k.yesterday)} vs a usual {fmt(k, k.verdict.usual)}</li>)}</ul> : <p className="mt-2 text-[14px] text-ink-soft">Nothing out of the ordinary.</p>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((k) => {
          const bad = !!k.verdict.strength && (k.verdict.level === "low") === (k.goodWhen === "high");
          const good = !!k.verdict.strength && !bad;
          const trendBad = k.change != null && (k.goodWhen === "high" ? k.change < -0.1 : k.change > 0.1);
          return (
            <Card key={k.key} title={k.label} action={k.verdict.strength ? <span className={cn("rounded px-2 py-0.5 text-[11.5px] font-medium", bad ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>{k.verdict.strength === "unusual" ? "Unusual" : "Notable"}: {k.verdict.level}</span> : undefined}>
              <div className="px-5 pb-4 pt-1">
                <p className="text-[24px] font-semibold tabular-nums">{fmt(k, k.yesterday)}</p>
                <p className={cn("text-[12.5px]", bad ? "text-danger" : good ? "text-success" : "text-muted")}>yesterday · a usual {day}: {fmt(k, k.verdict.usual)}</p>
                <Spark s={k.spark} bad={bad} />
                <p className="mt-1 flex justify-between text-[12.5px] text-muted"><span>last 7 days {fmt(k, k.last7)}</span><span className={cn("tabular-nums", trendBad ? "text-danger" : k.change ? "text-success" : "")}>{pct(k.change)} vs the 7 before</span></p>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-[12.5px] text-muted">Each number is compared with the same weekday over the last 8 weeks (median and a robust spread, so one big sale day doesn&apos;t skew it): beyond 2 spreads is notable, 3 unusual. The month-end forecast adds each remaining day at its weekday&apos;s usual level. Refreshed every 15 minutes.</p>
    </>
  );
}
