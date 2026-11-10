import { BadgeCheck } from "lucide-react";
import { Stars } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";
import { ReviewForm } from "./review-form";
import { localise, makeT, type T } from "@/lib/i18n";

type Data = {
  reviews: { id: string; rating: number; title: string; body: string; fit: string | null; verified: boolean; createdAt: Date; user: { name: string } }[];
  distribution: { rating: number; count: number }[];
  fits: { fit: string; count: number }[];
};

export function Reviews({ productId, avg, count, data, canReview, t = makeT("en"), locale = "en" }: { productId: string; avg: number; count: number; data: Data; canReview: boolean; t?: T; locale?: "en" | "ne" }) {
  const fit = (f: string) => localise(locale, f);
  const max = Math.max(1, ...data.distribution.map((d) => d.count));
  return (
    <section id="reviews" className="container-page scroll-mt-24 border-t border-line py-14">
      <div className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-4">
          <h2 className="font-display text-3xl">{t("rev.title")}</h2>
          {count > 0 ? (
            <>
              <div className="mt-4 flex items-end gap-3">
                <span className="font-display text-5xl leading-none">{avg.toFixed(1)}</span>
                <div className="pb-1"><Stars value={avg} size={16} /><p className="mt-1 text-[13px] text-muted">{t(count > 1 ? "pp.reviewN" : "pp.review1", { n: count })}</p></div>
              </div>
              <div className="mt-6 space-y-1.5">
                {data.distribution.map((d) => (
                  <div key={d.rating} className="flex items-center gap-3 text-[13px]">
                    <span className="w-3">{d.rating}</span>
                    <div className="h-1.5 flex-1 bg-line"><div className="h-full bg-ink" style={{ width: `${(d.count / max) * 100}%` }} /></div>
                    <span className="w-6 text-right text-muted">{d.count}</span>
                  </div>
                ))}
              </div>
              {data.fits.length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-[13px] font-semibold">{t("rev.how")}</p>
                  {data.fits.sort((a, b) => b.count - a.count).map((f) => <p key={f.fit} className="text-[13px] text-muted">{fit(f.fit)}: {Math.round((f.count / data.fits.reduce((s, x) => s + x.count, 0)) * 100)}%</p>)}
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-muted">{t("rev.none")}</p>
          )}
          <div className="mt-6"><ReviewForm productId={productId} canReview={canReview} /></div>
        </div>
        <div className="md:col-span-8">
          <ul className="divide-y divide-line">
            {data.reviews.map((r) => (
              <li key={r.id} className="py-6 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <Stars value={r.rating} />
                  <span className="text-[12.5px] text-muted">{formatDate(r.createdAt)}</span>
                </div>
                <p className="mt-2 font-semibold">{r.title}</p>
                <p className="mt-1 text-[14.5px] leading-relaxed text-ink-soft">{r.body}</p>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                  <span>{r.user.name.split(" ")[0]} {r.user.name.split(" ")[1]?.[0] ? `${r.user.name.split(" ")[1][0]}.` : ""}</span>
                  {r.verified && <span className="flex items-center gap-1 text-success"><BadgeCheck className="h-3.5 w-3.5" /> {t("rev.verified")}</span>}
                  {r.fit && <span>{t("rev.fit", { fit: fit(r.fit) })}</span>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
