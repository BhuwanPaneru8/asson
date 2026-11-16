"use client";

import { useState } from "react";
import Link from "next/link";
import { Ruler } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { useT } from "@/components/site/i18n-provider";
import { rich } from "@/lib/i18n/rich";
import { SIZE_CHARTS, chartFor, suggestSize, type ChartKind } from "@/lib/size-charts";
import { cn } from "@/lib/utils";

/**
 * "Size guide" on a product page: the chart for this kind of product in a side panel (the shopper stays on the
 * product), with "What's my size?": type a measurement and the matching size lights up and can be picked.
 */
export function SizePanel({ sizes, onPick }: { sizes: string[]; onPick?: (size: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [measure, setMeasure] = useState("");
  const kind: ChartKind = chartFor(sizes);
  const head = kind === "tops" ? [t("f.size"), t("size.chestIn"), t("size.waistIn")] : kind === "bottoms" ? [t("f.size"), t("size.waistIn"), t("size.hipIn")] : [t("size.age"), t("size.heightCm"), t("size.chestCm")];
  const ask = kind === "tops" ? t("size.askChest") : kind === "bottoms" ? t("size.askWaist") : t("size.askHeight");
  const suggestion = measure ? suggestSize(kind, Number(measure.replace(",", "."))) : null;
  const sold = suggestion && sizes.includes(suggestion);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[13px] underline underline-offset-4">
        <Ruler className="h-3.5 w-3.5" aria-hidden /> {t("nav.sizeGuide")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("nav.sizeGuide")}>
        <div className="space-y-6 p-5">
          <div className="bg-cloud/70 p-4">
            <label htmlFor="size-measure" className="block text-[14px] font-semibold">{t("size.whatsMine")}</label>
            <p className="mt-1 text-[13px] text-muted">{ask}</p>
            <input id="size-measure" value={measure} onChange={(e) => setMeasure(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))} inputMode="decimal" placeholder={kind === "kids" ? "110" : "38"} className="mt-2.5 h-11 w-32 border border-line bg-white px-3 text-[15px] outline-none focus:border-ink" />
            <p className="mt-2.5 min-h-[1.25rem] text-[14px]" aria-live="polite">
              {measure && (suggestion
                ? <>{rich(t("size.yours"), { size: <b>{suggestion}</b> })}{sold && onPick && <> · <button type="button" className="font-medium underline underline-offset-4" onClick={() => { onPick(suggestion); setOpen(false); }}>{t("size.pick", { size: suggestion })}</button></>}</>
                : <span className="text-muted">{t("size.offChart")}</span>)}
            </p>
          </div>

          <div>
            <p className="mb-2 text-[14px] font-semibold">{kind === "tops" ? t("size.tops") : kind === "bottoms" ? t("size.bottoms") : t("g.kids")}</p>
            <table className="w-full border border-line bg-white text-left text-[14px]">
              <thead className="bg-cloud"><tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {SIZE_CHARTS[kind].rows.map((r) => (
                  <tr key={r[0]} className={cn(r[0] === suggestion && "bg-accent-soft")} aria-current={r[0] === suggestion ? "true" : undefined}>
                    {r.map((c, i) => <td key={i} className={i === 0 ? "px-3 py-2.5 font-medium" : "px-3 py-2.5 text-ink-soft"}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12.5px] text-muted">{t("size.intro")}</p>
          </div>

          <div className="text-[13.5px] text-ink-soft">
            <p className="font-semibold text-ink">{t("size.how")}</p>
            <p className="mt-1">{rich(t("size.howBody"), { chest: <b>{t("size.chest")}</b>, waist: <b>{t("size.waist")}</b>, hip: <b>{t("size.hip")}</b> })}</p>
          </div>
          <Link href="/size-guide" className="inline-block text-[13.5px] underline underline-offset-4" target="_blank">{t("size.allCharts")}</Link>
        </div>
      </Sheet>
    </>
  );
}
