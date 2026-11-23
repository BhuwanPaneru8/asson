"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Heart, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ProductCardData } from "@/lib/catalog";
import { sortSizes } from "@/lib/config";
import { addToCart } from "@/actions/cart";
import { toggleWishlist } from "@/actions/wishlist";
import { Price, Stars, Badge } from "@/components/ui/misc";
import { useShop } from "@/components/site/shop-provider";
import { cn, discountPercent } from "@/lib/utils";
import { useT } from "@/components/site/i18n-provider";
import { pick } from "@/lib/i18n";

export function ProductCard({ p, priority }: { p: ProductCardData; priority?: boolean }) {
  const [color, setColor] = useState(p.colors[0]?.name);
  const [pending, start] = useTransition();
  const [sizesOpen, setSizesOpen] = useState(false); // phones: the + button opens the sizes (desktop shows them on hover)
  const { wishlist, openCart } = useShop();
  const router = useRouter();
  const { t, locale } = useT();
  const name = pick(locale, p.name, p.nameNe);
  const saved = wishlist.has(p.id);

  const colorImgs = p.images.filter((i) => i.color === color);
  const imgs = colorImgs.length ? colorImgs : p.images;
  const primary = imgs[0];
  const secondary = imgs[1];
  const off = discountPercent(p.price, p.compareAtPrice);
  const sizes = sortSizes([...new Set(p.variants.filter((v) => v.color === color).map((v) => v.size))]);
  const href = `/p/${p.slug}${color && p.colors.length > 1 ? `?color=${encodeURIComponent(color)}` : ""}`;

  const quickAdd = (size: string) =>
    start(async () => {
      const v = p.variants.find((x) => x.color === color && x.size === size);
      if (!v) return;
      const r = await addToCart({ variantId: v.id });
      if (r.ok) { setSizesOpen(false); toast.success(t("pc.added", { name, size }), { action: { label: t("pc.viewBag"), onClick: openCart } }); if (r.message) toast(r.message); }
      else toast.error(r.error);
    });

  const heart = () =>
    start(async () => {
      const r = await toggleWishlist(p.id);
      if (r.needsLogin) { toast(t("pc.signInToSave"), { action: { label: t("nav.signIn"), onClick: () => router.push("/login") } }); return; }
      if (r.ok) toast.success(r.saved ? t("pc.saved") : t("pc.removed"));
    });

  return (
    <div className="group relative flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden bg-cloud">
        <Link href={href} className="absolute inset-0" aria-label={name}>
          {primary && <Image src={primary.url} alt={primary.alt || name} fill loading={priority ? "eager" : undefined} fetchPriority={priority ? "high" : undefined} sizes="(min-width:1280px) 22vw, (min-width:768px) 30vw, 48vw" className={cn("object-cover transition-all duration-700", secondary && "group-hover:opacity-0", !p.inStock && "opacity-60")} />}
          {secondary && <Image src={secondary.url} alt="" fill sizes="(min-width:1280px) 22vw, (min-width:768px) 30vw, 48vw" className="object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100" />}
        </Link>
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
          {!p.inStock ? <Badge tone="dark">{t("pc.soldOut")}</Badge> : off >= 10 ? <Badge tone="accent">-{off}%</Badge> : p.isNew ? <Badge>{t("pc.new")}</Badge> : null}
          {p.inStock && p.lowStock && <Badge tone="warn">{t("pc.fewLeft")}</Badge>}
        </div>
        <button onClick={heart} disabled={pending} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:scale-105" aria-label={saved ? t("pc.unsave") : t("pc.save")} aria-pressed={saved}>
          <Heart className={cn("h-[18px] w-[18px]", saved ? "fill-accent text-accent" : "text-ink")} strokeWidth={1.8} />
        </button>
        {p.inStock && sizes.length > 0 && !sizesOpen && (
          <button
            type="button"
            onClick={() => setSizesOpen(true)}
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition active:scale-95 md:hidden"
            aria-label={t("pc.chooseSize", { name })}
            aria-expanded={false}
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        )}
        {p.inStock && sizes.length > 0 && (
          <div
            className={cn(
              "absolute inset-x-2 bottom-2 bg-white/95 p-2 shadow-sm backdrop-blur transition-all duration-300",
              sizesOpen ? "block animate-slide-up" : "hidden translate-y-2 opacity-0 md:block md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100",
            )}
          >
            <div className="relative mb-1.5 flex items-center justify-center">
              <p className="text-center text-[11.5px] font-semibold uppercase tracking-wider text-muted">{t("pc.quickAdd")}</p>
              {sizesOpen && (
                <button type="button" onClick={() => setSizesOpen(false)} className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center" aria-label={t("pc.closeSizes")}>
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-1">
              {sizes.map((s) => {
                const v = p.variants.find((x) => x.color === color && x.size === s);
                const oos = !v || v.stock <= 0;
                return (
                  <button key={s} onClick={() => quickAdd(s)} disabled={oos || pending} className={cn("h-9 min-w-9 border px-2 text-[12.5px] font-medium transition-colors md:h-8", oos ? "border-line text-muted/50 line-through" : "border-line hover:border-ink hover:bg-ink hover:text-white")}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {p.colors.length > 1 && (
          <div className="-ml-1 mb-0.5 flex items-center">
            {p.colors.slice(0, 5).map((c) => (
              <button key={c.name} onMouseEnter={() => setColor(c.name)} onFocus={() => setColor(c.name)} onClick={() => setColor(c.name)} className="flex h-6 w-6 items-center justify-center rounded-full" aria-label={c.name} aria-pressed={color === c.name} title={c.name}>
                <span className={cn("h-4 w-4 rounded-full border ring-offset-2 transition", color === c.name ? "ring-1 ring-ink" : "border-black/10")} style={{ background: c.hex }} />
              </button>
            ))}
            {p.colors.length > 5 && <span className="text-[12px] text-muted">+{p.colors.length - 5}</span>}
          </div>
        )}
        <p className="text-[11.5px] uppercase tracking-[0.12em] text-muted">{p.brand}</p>
        <Link href={href} className="line-clamp-1 text-[14.5px] font-medium decoration-1 underline-offset-4 hover:underline">{name}</Link>
        <Price price={p.price} compareAt={p.compareAtPrice} size="sm" offWord={t("price.off")} />
        {p.ratingCount > 0 && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted"><Stars value={p.ratingAvg} size={12} /> ({p.ratingCount})</div>
        )}
      </div>
    </div>
  );
}

export function ProductGrid({ products, className }: { products: ProductCardData[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4", className)}>
      {products.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}
    </div>
  );
}
