import { Sparkles } from "lucide-react";
import { store } from "@/lib/config";
import { nextTier, tierFor } from "@/lib/loyalty-shared";
import { formatPrice } from "@/lib/utils";

const REASON: Record<string, string> = {
  EARN: "Earned on order", REDEEM: "Used at checkout", REDEEM_REFUND: "Returned — order cancelled",
  RETURN_REVERSE: "Taken back — items returned", ADJUST: "Adjustment", WELCOME: "Welcome bonus",
  REFERRAL: "A friend's first order", REFERRAL_REVERSE: "Taken back — friend's order returned", BIRTHDAY: "Happy birthday",
};

type Entry = { id: string; delta: number; reason: string; note: string | null; createdAt: Date; orderNumber?: string };

export function PointsCard({ balance, spend12m, entries }: { balance: number; spend12m: number; entries: Entry[] }) {
  const tier = tierFor(spend12m);
  const next = nextTier(spend12m);
  const L = store.loyalty;
  const pct = next ? Math.min(100, Math.round(((spend12m - tier.minSpend) / (next.tier.minSpend - tier.minSpend)) * 100)) : 100;
  return (
    <section className="border border-line bg-white p-5" aria-labelledby="points-h">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="points-h" className="flex items-center gap-2 text-[13px] text-muted"><Sparkles className="h-4 w-4" /> Asson points · {tier.name} member</h2>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{balance.toLocaleString("en-IN")} <span className="text-[15px] font-normal text-muted">points = {formatPrice(Math.max(0, balance) * L.pointValue)}</span></p>
        </div>
        <p className="max-w-xs text-[13px] text-muted">
          Earn {tier.multiplier > 1 ? `${tier.multiplier}× ` : ""}1 point per {formatPrice(L.earnPer)} when your order is delivered. Use {L.minRedeem}+ points at checkout for up to {L.maxRedeemPercent}% off your bag.
        </p>
      </div>
      {next && (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-cloud" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress to ${next.tier.name}`}>
            <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">Spend {formatPrice(next.remaining)} more in 12 months to reach {next.tier.name} ({next.tier.multiplier}× points).</p>
        </div>
      )}
      {entries.length > 0 && (
        <details className="mt-4 text-[13.5px]">
          <summary className="cursor-pointer font-medium">Points history</summary>
          <ul className="mt-2 divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-2">
                <span>{REASON[e.reason] ?? e.reason}{e.orderNumber ? ` ${e.orderNumber}` : ""}<span className="block text-[12px] text-muted">{e.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kathmandu" })}</span></span>
                <span className={e.delta > 0 ? "font-medium text-success tabular-nums" : "tabular-nums text-ink-soft"}>{e.delta > 0 ? "+" : ""}{e.delta}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
