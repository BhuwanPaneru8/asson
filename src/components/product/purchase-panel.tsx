"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Heart, Ruler, Truck, RotateCcw, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { addToCart } from "@/actions/cart";
import { toggleWishlist } from "@/actions/wishlist";
import { Button } from "@/components/ui/button";
import { Price, Stars } from "@/components/ui/misc";
import { useShop } from "@/components/site/shop-provider";
import { sortSizes, store } from "@/lib/config";
import { DeliveryEstimator } from "@/components/cart/delivery-estimator";
import type { RateMap } from "@/lib/delivery-shared";
import { cn, formatPrice } from "@/lib/utils";
import { Gallery } from "./gallery";
import { NotifyMe } from "./notify-me";
import { useT } from "@/components/site/i18n-provider";

type Variant = { id: string; color: string; colorHex: string; size: string; stock: number };
type Img = { url: string; alt: string; color: string | null };

export type PurchaseProduct = {
  id: string;
  name: string;
  brand: string;
  price: number;
  compareAtPrice: number | null;
  ratingAvg: number;
  ratingCount: number;
  description: string;
  details: string[];
  material: string | null;
  care: string | null;
  fit: string | null;
  images: Img[];
  variants: Variant[];
  categoryName: string;
};

export function ProductExperience({ product, fitSummary, rates }: { product: PurchaseProduct; fitSummary?: string; rates: RateMap }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t, l, locale } = useT();
  const colors = useMemo(() => {
    const m = new Map<string, string>();
    product.variants.forEach((v) => !m.has(v.color) && m.set(v.color, v.colorHex));
    return [...m].map(([name, hex]) => ({ name, hex, inStock: product.variants.some((v) => v.color === name && v.stock > 0) }));
  }, [product.variants]);

  const initialColor = colors.find((c) => c.name === params.get("color"))?.name ?? colors.find((c) => c.inStock)?.name ?? colors[0]?.name;
  const [color, setColor] = useState(initialColor);
  const [size, setSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [pending, start] = useTransition();
  const { openCart, wishlist } = useShop();
  const saved = wishlist.has(product.id);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const sizes = sortSizes([...new Set(product.variants.filter((v) => v.color === color).map((v) => v.size))]);
  const variant = product.variants.find((v) => v.color === color && v.size === size);
  const colorImages = product.images.filter((i) => i.color === color);
  const images = colorImages.length ? colorImages : product.images;
  const oneSize = sizes.length === 1;
  const effectiveVariant = variant ?? (oneSize ? product.variants.find((v) => v.color === color) : undefined);

  const pickColor = (c: string) => {
    setColor(c);
    const v = product.variants.find((x) => x.color === c && x.size === size);
    if (!v) setSize(null);
    const next = new URLSearchParams(params.toString());
    next.set("color", c);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const selectedOos = !!effectiveVariant && effectiveVariant.stock <= 0;

  const add = () => {
    if (selectedOos) return;
    if (!effectiveVariant) { setSizeError(true); document.getElementById("size-picker")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    start(async () => {
      const r = await addToCart({ variantId: effectiveVariant.id });
      if (r.ok) { openCart(); if (r.message) toast(r.message); }
      else toast.error(r.error);
    });
  };

  const heart = () => start(async () => {
    const r = await toggleWishlist(product.id);
    if (r.needsLogin) { router.push(`/login?next=${encodeURIComponent(pathname)}`); return; }
    if (r.ok) toast.success(r.saved ? t("pc.saved") : t("pc.removed"));
  });

  const soldOut = !product.variants.some((v) => v.color === color && v.stock > 0);

  return (
    <div className="grid gap-8 md:grid-cols-12 lg:gap-12">
      <div className="-mx-4 md:col-span-7 md:mx-0">
        <Gallery key={color} images={images} name={product.name} />
      </div>
      <div className="md:col-span-5">
        <div className="md:sticky md:top-24">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">{product.brand}</p>
          <h1 className="mt-1.5 font-display text-3xl leading-tight md:text-[38px]">{product.name}</h1>
          {product.ratingCount > 0 && (
            <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-[13.5px] text-muted hover:text-ink">
              <Stars value={product.ratingAvg} /> {product.ratingAvg.toFixed(1)} · {t(product.ratingCount > 1 ? "pp.reviewN" : "pp.review1", { n: product.ratingCount })}
            </a>
          )}
          <Price price={product.price} compareAt={product.compareAtPrice} size="lg" className="mt-4" offWord={t("price.off")} />
          <p className="mt-1 text-[12.5px] text-muted">{l(store.vatLabel)}</p>

          {/* Colour */}
          <div className="mt-7">
            <p className="text-[14px]"><span className="font-semibold">{t("pp.colour")}</span> {color}</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {colors.map((c) => (
                <button key={c.name} onClick={() => pickColor(c.name)} title={c.name} aria-label={`${c.name}${c.inStock ? "" : t("pp.soldOutSuffix")}`} aria-pressed={color === c.name}
                  className={cn("relative h-9 w-9 rounded-full border transition", color === c.name ? "ring-[1.5px] ring-ink ring-offset-2" : "border-black/10 hover:ring-1 hover:ring-line hover:ring-offset-2")} style={{ background: c.hex }}>
                  {!c.inStock && <span className="absolute inset-0 flex items-center justify-center"><span className="h-px w-full rotate-45 bg-ink/60" /></span>}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          {!oneSize && (
            <div id="size-picker" className="mt-7">
              <div className="flex items-center justify-between">
                <p className={cn("text-[14px]", sizeError && "text-danger")}><span className="font-semibold">{t("pp.size")}</span> {size ?? (sizeError ? t("pp.pickSize") : t("pp.select"))}</p>
                <Link href="/size-guide" className="flex items-center gap-1.5 text-[13px] underline underline-offset-4"><Ruler className="h-3.5 w-3.5" /> {t("nav.sizeGuide")}</Link>
              </div>
              <div className={cn("mt-3 grid grid-cols-5 gap-x-2 gap-y-3", sizeError && "animate-[pulse_0.4s_ease-in-out_1]")}>
                {sizes.map((s) => {
                  const v = product.variants.find((x) => x.color === color && x.size === s)!;
                  const oos = v.stock <= 0;
                  return (
                    <button key={s} onClick={() => { setSize(s); setSizeError(false); }} aria-pressed={size === s} aria-label={`${t("f.sizeChip", { s })}${oos ? t("pp.ariaSoldOut") : v.stock <= 3 ? t("pp.ariaLeft", { n: v.stock }) : ""}`}
                      className={cn("relative h-12 border text-[14px] font-medium transition-colors", size === s ? (oos ? "border-ink bg-cloud text-ink" : "border-ink bg-ink text-white") : oos ? "border-line bg-cloud/50 text-muted/70 hover:border-ink-soft" : "border-line bg-white hover:border-ink", sizeError && !oos && size !== s && "border-danger/50")}>
                      <span className={cn(oos && "line-through")}>{s}</span>
                      {!oos && v.stock <= 3 && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-warn px-1 text-[9.5px] font-semibold uppercase leading-4 text-white">{t("pp.left", { n: v.stock })}</span>}
                    </button>
                  );
                })}
              </div>
              {fitSummary && <p className="mt-3 text-[13px] text-muted">{t("pp.fit", { fit: locale === "en" ? fitSummary.toLowerCase() : l(fitSummary) })}</p>}
            </div>
          )}

          {selectedOos && <div className="mt-7"><NotifyMe variantId={effectiveVariant!.id} label={oneSize ? color! : t("pp.notifyLabel", { color: color!, size: effectiveVariant!.size })} /></div>}
          {soldOut && !selectedOos && <p className="mt-5 text-[13.5px] text-muted">{t("pp.soldOutIn", { color: color! })}</p>}

          <div ref={ctaRef} className={cn("flex gap-2", selectedOos ? "mt-3" : "mt-7")}>
            <Button size="lg" className="flex-1" onClick={add} loading={pending} disabled={soldOut || selectedOos}>
              {selectedOos ? t("pc.soldOut") : soldOut ? t("pp.soldOutColour") : t("pp.add")}
            </Button>
            <Button size="lg" variant="secondary" className="w-14 px-0" onClick={heart} aria-label={saved ? t("pc.unsave") : t("pc.save")} aria-pressed={saved}>
              <Heart className={cn("h-5 w-5", saved && "fill-accent text-accent")} strokeWidth={1.7} />
            </Button>
          </div>

          <DeliveryEstimator rates={rates} className="mt-5" />

          <div className="mt-8 border-t border-line">
            <Accordion title={t("pp.description")} defaultOpen>
              <p className="text-[14.5px] leading-relaxed text-ink-soft">{product.description}</p>
              {product.details.length > 0 && <ul className="mt-3 space-y-1.5 text-[14.5px] text-ink-soft">{product.details.map((d) => <li key={d} className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-success" />{d}</li>)}</ul>}
            </Accordion>
            <Accordion title={t("pp.fabricCare")}>
              <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-[14.5px]">
                {product.material && <><dt className="text-muted">{t("pp.fabric")}</dt><dd>{product.material}</dd></>}
                {product.fit && <><dt className="text-muted">{t("pp.fitLabel")}</dt><dd>{product.fit}</dd></>}
                {product.care && <><dt className="text-muted">{t("pp.care")}</dt><dd>{product.care}</dd></>}
              </dl>
            </Accordion>
            <Accordion title={t("pp.deliveryReturns")}>
              <ul className="space-y-2 text-[14.5px] text-ink-soft">
                <li className="flex gap-2.5"><Truck className="mt-0.5 h-4 w-4 shrink-0" />{t("pp.deliveryNote", { amount: formatPrice(store.shipping.freeThreshold) })}</li>
                <li className="flex gap-2.5"><RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />{t("pp.returnsNote", { days: store.returnWindowDays })}</li>
              </ul>
            </Accordion>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className={cn("fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper p-3 transition-transform md:hidden", showSticky ? "translate-y-0" : "translate-y-full")}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium">{product.name}</p>
            <p className="text-[13px] text-muted">{formatPrice(product.price)} · {color}{size ? ` · ${size}` : ""}</p>
          </div>
          <Button onClick={add} loading={pending} disabled={soldOut || selectedOos} className="shrink-0">{selectedOos ? t("pc.soldOut") : effectiveVariant ? t("pp.add") : t("pp.selectSize")}</Button>
        </div>
      </div>
    </div>
  );
}

function Accordion({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-line">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between py-4 text-left text-[14.5px] font-semibold" aria-expanded={open}>
        {title}<ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="pb-5">{children}</div>}
    </div>
  );
}
