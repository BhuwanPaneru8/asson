"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/utils";

type Point = { day: string; revenue: number; orders: number };

/** Daily revenue — one series, so no legend; the card title names it. */
export function RevenueChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const nice = Math.ceil(max / 100 / 5000) * 5000 * 100 || max; // round axis to Rs 5k steps
  const ticks = [0, 0.5, 1].map((t) => Math.round(nice * t));
  const label = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="relative px-5 pb-4 pt-5">
      <div className="relative ml-14 h-52">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-line/70" style={{ bottom: `${(t / nice) * 100}%` }}>
            <span className="absolute -left-14 -translate-y-1/2 text-[11px] tabular-nums text-muted">{formatPrice(t).replace(/,000$/, "k")}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => (
            <div key={d.day} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${label(d.day)}: ${formatPrice(d.revenue)}, ${d.orders} orders`}>
              <div className="w-full rounded-t-[4px] transition-colors" style={{ height: `${Math.max(d.revenue ? 1.5 : 0, (d.revenue / nice) * 100)}%`, background: hover === i ? "var(--color-accent)" : "var(--color-ink)" }} />
            </div>
          ))}
        </div>
        {hover !== null && data[hover] && (
          <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-white px-3 py-2 text-[12.5px] shadow-lg" style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}>
            <p className="font-semibold">{label(data[hover].day)}</p>
            <p className="tabular-nums">{formatPrice(data[hover].revenue)}</p>
            <p className="text-muted">{data[hover].orders} orders</p>
          </div>
        )}
      </div>
      <div className="ml-14 mt-2 flex justify-between text-[11px] text-muted">
        <span>{data[0] && label(data[0].day)}</span><span>{data[Math.floor(data.length / 2)] && label(data[Math.floor(data.length / 2)].day)}</span><span>{data.at(-1) && label(data.at(-1)!.day)}</span>
      </div>
    </div>
  );
}
