import { Sparkles } from "lucide-react";
import { store } from "@/lib/config";
import { nextTier, tierFor } from "@/lib/loyalty-shared";
import { formatPrice } from "@/lib/utils";
import { makeT, type MessageKey, type T } from "@/lib/i18n";

const REASONS = ["EARN", "REDEEM", "REDEEM_REFUND", "RETURN_REVERSE", "ADJUST", "WELCOME", "REFERRAL", "REFERRAL_REVERSE", "BIRTHDAY"];

type Entry = { id: string; delta: number; reason: string; note: string | null; createdAt: Date; orderNumber?: string };

export function PointsCard({ balance, spend12m, entries, t = makeT("en") }: { balance: number; spend12m: number; entries: Entry[]; t?: T }) {
  const tier = tierFor(spend12m);
  const next = nextTier(spend12m);
  const L = store.loyalty;
  const pct = next ? Math.min(100, Math.round(((spend12m - tier.minSpend) / (next.tier.minSpend - tier.minSpend)) * 100)) : 100;
  return (
    <section className="border border-line bg-white p-5" aria-labelledby="points-h">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="points-h" className="flex items-center gap-2 text-[13px] text-muted"><Sparkles className="h-4 w-4" /> {t("pts.title", { tier: tier.name })}</h2>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{balance.toLocaleString("en-IN")} <span className="text-[15px] font-normal text-muted">{t("pts.balance", { amount: formatPrice(Math.max(0, balance) * L.pointValue) })}</span></p>
        </div>
        <p className="max-w-xs text-[13px] text-muted">
          {t("pts.earn", { mult: tier.multiplier > 1 ? `${tier.multiplier}× ` : "", per: formatPrice(L.earnPer), min: L.minRedeem, pct: L.maxRedeemPercent })}
        </p>
      </div>
      {next && (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-cloud" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("pts.progress", { tier: next.tier.name })}>
            <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">{t("pts.next", { amount: formatPrice(next.remaining), tier: next.tier.name, mult: next.tier.multiplier })}</p>
        </div>
      )}
      {entries.length > 0 && (
        <details className="mt-4 text-[13.5px]">
          <summary className="cursor-pointer font-medium">{t("pts.history")}</summary>
          <ul className="mt-2 divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-2">
                <span>{REASONS.includes(e.reason) ? t(`pts.${e.reason}` as MessageKey) : e.reason}{e.orderNumber ? ` ${e.orderNumber}` : ""}<span className="block text-[12px] text-muted">{e.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kathmandu" })}</span></span>
                <span className={e.delta > 0 ? "font-medium text-success tabular-nums" : "tabular-nums text-ink-soft"}>{e.delta > 0 ? "+" : ""}{e.delta}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
