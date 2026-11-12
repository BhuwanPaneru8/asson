"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getBagSuggestions } from "@/actions/recommend";
import { addToCart } from "@/actions/cart";
import type { ProductCardData } from "@/lib/catalog";
import { formatPrice } from "@/lib/utils";
import { pick } from "@/lib/i18n";
import { useShop } from "@/components/site/shop-provider";
import { useT } from "@/components/site/i18n-provider";

type Data = { gap: number; closesGap: ProductCardData[]; others: ProductCardData[] };

/**
 * "Complete your order" in the bag: what goes with what's in it. Short of free delivery, it says how much is left
 * and leads with items that close the gap. One tap adds the size when there's only one in stock; otherwise it
 * opens the product to choose.
 */
export function BagSuggestions({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const { cart } = useShop();
  const { t, locale } = useT();
  const [data, setData] = useState<Data | null>(null);
  const [pending, start] = useTransition();
  const key = `${cart.count}:${cart.subtotal}`;
  useEffect(() => {
    if (!cart.count) return;
    let live = true;
    getBagSuggestions().then((d) => { if (live) setData(d); }).catch(() => {});
    return () => { live = false; };
  }, [key, cart.count]);

  const items = data ? [...data.closesGap, ...data.others].slice(0, compact ? 3 : 4) : [];
  if (!cart.count || !items.length) return null;

  const quickAdd = (p: ProductCardData) => {
    const sizes = p.variants.filter((v) => v.stock > 0);
    if (sizes.length !== 1) return false;
    start(async () => {
      const r = await addToCart({ variantId: sizes[0].id });
      if (r.ok) toast.success(t("pc.added", { name: pick(locale, p.name, p.nameNe), size: sizes[0].size }));
      else toast.error(r.error);
    });
    return true;
  };

  return (
    <section className={compact ? "border-t border-line px-5 py-4" : "mt-10"} aria-label={t("reco.complete")}>
      <p className={compact ? "text-[13px] font-semibold" : "text-[16px] font-semibold"}>
        {data!.gap > 0 ? t("reco.gap", { amount: formatPrice(data!.gap) }) : t("reco.complete")}
      </p>
      {data!.gap > 0 && <p className="mt-0.5 text-[12.5px] text-muted">{t("reco.gapBody")}</p>}
      <ul className={compact ? "mt-3 space-y-2.5" : "mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"}>
        {items.map((p) => {
          const closes = data!.closesGap.some((c) => c.id === p.id);
          return (
            <li key={p.id} className={compact ? "flex items-center gap-3" : "flex flex-col"}>
              <Link href={`/p/${p.slug}`} onClick={onNavigate} className={compact ? "relative h-16 w-12 shrink-0 overflow-hidden bg-cloud" : "relative aspect-[3/4] overflow-hidden bg-cloud"}>
                {p.images[0] && <Image src={p.images[0].url} alt="" fill sizes={compact ? "48px" : "(min-width:640px) 20vw, 45vw"} className="object-cover" />}
              </Link>
              <div className={compact ? "min-w-0 flex-1" : "mt-2"}>
                <Link href={`/p/${p.slug}`} onClick={onNavigate} className="line-clamp-1 text-[13.5px] font-medium hover:text-accent">{pick(locale, p.name, p.nameNe)}</Link>
                <p className="text-[13px] tabular-nums">{formatPrice(p.price)}{closes && <span className="ml-1.5 text-[11.5px] font-medium text-success">{t("reco.freeDelivery")}</span>}</p>
              </div>
              <Link
                href={`/p/${p.slug}`}
                onClick={(e) => { if (quickAdd(p)) e.preventDefault(); else onNavigate?.(); }}
                aria-disabled={pending}
                className={compact ? "shrink-0 border border-line px-2.5 py-1.5 text-[12.5px] font-medium hover:border-ink" : "mt-2 border border-line py-2 text-center text-[13px] font-medium hover:border-ink"}
              >
                {p.variants.filter((v) => v.stock > 0).length === 1 ? t("reco.add") : t("reco.choose")}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
