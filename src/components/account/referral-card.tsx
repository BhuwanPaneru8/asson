"use client";

import { useState } from "react";
import { Check, Copy, Gift } from "lucide-react";
import { useT } from "@/components/site/i18n-provider";

/** The shopper's own code and link, with WhatsApp sharing (how people in Nepal pass things on). */
export function ReferralCard({ code, link, friendOff, minSpend, reward, friends, earned }: { code: string; link: string; friendOff: string; minSpend: string; reward: string; friends: number; earned: number }) {
  const [copied, setCopied] = useState(false);
  const { t } = useT();
  const text = t("ref.share", { code, off: friendOff, min: minSpend, link });
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the link is shown to copy by hand */ }
  };
  return (
    <section className="border border-line bg-white p-5 md:p-6">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold">{t("ref.title", { off: friendOff, reward })}</h2>
          <p className="mt-1 text-[14px] text-muted">{t("ref.body", { off: friendOff, min: minSpend, reward })}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="border border-dashed border-ink px-3 py-2 font-mono text-[16px] tracking-widest">{code}</span>
            <button type="button" onClick={copy} className="flex h-10 items-center gap-1.5 border border-line px-3 text-[14px] hover:border-ink">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? t("ref.copied") : t("ref.copy")}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center bg-ink px-4 text-[14px] font-medium text-white">{t("ref.whatsapp")}</a>
          </div>
          <p className="mt-2 break-all text-[12.5px] text-muted">{link}</p>
          {(friends > 0 || earned > 0) && <p className="mt-3 text-[13.5px]">{t(friends === 1 ? "ref.stats1" : "ref.statsN", { friends, points: earned })}</p>}
        </div>
      </div>
    </section>
  );
}
