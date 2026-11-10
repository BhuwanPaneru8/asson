"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addToCart } from "@/actions/cart";
import { useShop } from "@/components/site/shop-provider";
import { Button } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";
import { useT } from "@/components/site/i18n-provider";

type Piece = {
  id: string; name: string; slug: string; price: number; compareAtPrice: number | null; note: string | null;
  images: { url: string; alt: string; color: string | null }[];
  colors: { name: string; hex: string }[];
  variants: { id: string; color: string; size: string; stock: number }[];
};
type Pick = { on: boolean; color: string; size: string | null };

/** Choose a colour and size for each piece, then put the whole outfit in the bag in one go. */
export function ShopTheLook({ pieces }: { pieces: Piece[] }) {
  const { openCart } = useShop();
  const { t } = useT();
  const [pending, start] = useTransition();
  const [picks, setPicks] = useState<Record<string, Pick>>(() =>
    Object.fromEntries(pieces.map((p) => [p.id, { on: p.variants.some((v) => v.stock > 0), color: p.variants.find((v) => v.stock > 0)?.color ?? p.colors[0]?.name ?? "", size: null }])),
  );
  const set = (id: string, patch: Partial<Pick>) => setPicks((x) => ({ ...x, [id]: { ...x[id], ...patch } }));
  const chosen = pieces.filter((p) => picks[p.id].on);
  const missing = chosen.filter((p) => !picks[p.id].size);
  const total = useMemo(() => chosen.reduce((s, p) => s + p.price, 0), [chosen]);

  const add = () => {
    if (!chosen.length) return void toast(t("look.tick"));
    if (missing.length) return void toast.error(t("look.chooseFor", { names: missing.map((p) => p.name).join(t("look.and")) }));
    start(async () => {
      let added = 0;
      for (const p of chosen) {
        const pick = picks[p.id];
        const v = p.variants.find((x) => x.color === pick.color && x.size === pick.size);
        if (!v) continue;
        const r = await addToCart({ variantId: v.id });
        if (r.ok) added++; else toast.error(`${p.name}: ${r.error}`);
      }
      if (added) { toast.success(added > 1 ? t("look.addedN", { n: added }) : t("look.added1")); openCart(); }
    });
  };

  return (
    <div>
      <ul className="divide-y divide-line border-y border-line">
        {pieces.map((p) => {
          const pick = picks[p.id];
          const sizes = p.variants.filter((v) => v.color === pick.color);
          const soldOut = !p.variants.some((v) => v.stock > 0);
          const img = p.images.find((i) => i.color === pick.color) ?? p.images[0];
          return (
            <li key={p.id} className={cn("flex gap-4 py-5", !pick.on && "opacity-55")}>
              <Link href={`/p/${p.slug}`} className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden bg-cloud sm:w-28">
                {img && <Image src={img.url} alt={img.alt || p.name} fill sizes="112px" className="object-cover" />}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/p/${p.slug}`} className="text-[15px] font-medium hover:text-accent">{p.name}</Link>
                  <p className="shrink-0 text-[15px] tabular-nums">{p.compareAtPrice && <span className="mr-1.5 text-[13px] text-muted line-through">{formatPrice(p.compareAtPrice)}</span>}{formatPrice(p.price)}</p>
                </div>
                {p.note && <p className="mt-0.5 text-[13px] italic text-muted">{p.note}</p>}
                {soldOut ? <p className="mt-2 text-[13px] text-danger">{t("pc.soldOut")}</p> : (
                  <>
                    {p.colors.length > 1 && (
                      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("look.colourFor", { name: p.name })}>
                        {p.colors.map((c) => (
                          <button key={c.name} type="button" role="radio" aria-checked={pick.color === c.name} aria-label={c.name} title={c.name} onClick={() => set(p.id, { color: c.name, size: null })}
                            className={cn("h-6 w-6 rounded-full border", pick.color === c.name ? "ring-1 ring-ink ring-offset-2" : "border-black/10")} style={{ background: c.hex }} />
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("look.sizeFor", { name: p.name })}>
                      {sizes.map((v) => (
                        <button key={v.id} type="button" role="radio" aria-checked={pick.size === v.size} disabled={v.stock <= 0} onClick={() => set(p.id, { size: v.size, on: true })}
                          className={cn("h-9 min-w-10 border px-2.5 text-[13px] tabular-nums", pick.size === v.size ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink", v.stock <= 0 && "cursor-not-allowed text-muted line-through hover:border-line")}>
                          {v.size}
                        </button>
                      ))}
                    </div>
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-[13px] text-muted">
                      <input type="checkbox" checked={pick.on} onChange={(e) => set(p.id, { on: e.target.checked })} aria-label={t("look.includeAria", { name: p.name })} className="h-4 w-4 accent-ink" /> {t("look.include")}
                    </label>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex items-center justify-between gap-4">
        <div><p className="text-[13px] text-muted">{t("look.count", { n: chosen.length, total: pieces.length })}</p><p className="font-display text-2xl tabular-nums">{formatPrice(total)}</p></div>
        <Button size="lg" onClick={add} loading={pending} disabled={!chosen.length}>{missing.length ? t("look.chooseSizes") : chosen.length > 1 ? t("look.addAll", { n: chosen.length }) : t("look.addIt")}</Button>
      </div>
    </div>
  );
}
