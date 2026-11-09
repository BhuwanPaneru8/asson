"use client";

import { useState } from "react";
import { Check, Copy, Gift } from "lucide-react";

/** The shopper's own code and link, with WhatsApp sharing (how people in Nepal pass things on). */
export function ReferralCard({ code, link, friendOff, minSpend, reward, friends, earned }: { code: string; link: string; friendOff: string; minSpend: string; reward: string; friends: number; earned: number }) {
  const [copied, setCopied] = useState(false);
  const text = `I shop at Asson for classic clothes. Use my code ${code} for ${friendOff} off your first order (${minSpend}+): ${link}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the link is shown to copy by hand */ }
  };
  return (
    <section className="border border-line bg-white p-5 md:p-6">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold">Give {friendOff}, get {reward}</h2>
          <p className="mt-1 text-[14px] text-muted">Friends get {friendOff} off their first order of {minSpend} or more. You get {reward} in points when it arrives.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="border border-dashed border-ink px-3 py-2 font-mono text-[16px] tracking-widest">{code}</span>
            <button type="button" onClick={copy} className="flex h-10 items-center gap-1.5 border border-line px-3 text-[14px] hover:border-ink">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Link copied" : "Copy link"}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center bg-ink px-4 text-[14px] font-medium text-white">Share on WhatsApp</a>
          </div>
          <p className="mt-2 break-all text-[12.5px] text-muted">{link}</p>
          {(friends > 0 || earned > 0) && <p className="mt-3 text-[13.5px]"><b>{friends}</b> friend{friends === 1 ? "" : "s"} have shopped with your code · <b>{earned}</b> points earned</p>}
        </div>
      </div>
    </section>
  );
}
