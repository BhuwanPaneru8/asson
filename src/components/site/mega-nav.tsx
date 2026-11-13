"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "./i18n-provider";

export type NavItem = { name: string; slug: string; image: string | null; children: { name: string; slug: string }[] };
export type NavCollection = { name: string; slug: string; image: string | null };

export function MegaNav({ nav, collections, hasSale = true, hasLooks = false }: { nav: NavItem[]; collections: NavCollection[]; hasSale?: boolean; hasLooks?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pathname = usePathname();
  const { t } = useT();
  // close the menu when the route changes (state-from-props pattern, no effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setOpen(null); }

  const enter = (slug: string) => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(slug), 80); };
  const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(null), 120); };

  const active = nav.find((n) => n.slug === open);
  // the section you're in: its own page or any of its subcategories
  const here = (n: NavItem) => pathname === `/c/${n.slug}` || n.children.some((c) => pathname === `/c/${c.slug}`);

  return (
    <nav className="ml-6 hidden h-full items-stretch lg:flex" onMouseLeave={leave} aria-label="Main">
      {nav.map((n) => (
        <div key={n.slug} className="flex items-stretch" onMouseEnter={() => enter(n.slug)}>
          <Link href={`/c/${n.slug}`} className={cn("flex items-center border-b-2 px-3.5 text-[14px] font-medium transition-colors", open === n.slug || here(n) ? "border-ink" : "border-transparent hover:text-accent")} aria-expanded={open === n.slug} aria-current={here(n) ? "page" : undefined} onFocus={() => setOpen(n.slug)}>
            {n.name}
          </Link>
        </div>
      ))}
      <Link href="/shop?sort=new" className="flex items-center px-3.5 text-[14px] font-medium hover:text-accent" onMouseEnter={leave}>{t("nav.newIn")}</Link>
      {hasLooks && <Link href="/lookbook" className="flex items-center px-3.5 text-[14px] font-medium hover:text-accent" onMouseEnter={leave}>{t("nav.lookbook")}</Link>}
      {hasSale && <Link href="/shop?sale=1" className="flex items-center px-3.5 text-[14px] font-medium text-accent hover:opacity-80" onMouseEnter={leave}>{t("nav.sale")}</Link>}

      {active && (
        <div className="absolute inset-x-0 top-full border-b border-line bg-paper shadow-[0_20px_40px_-20px_rgba(0,0,0,0.15)] animate-fade-in" onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={leave}>
          <div className="container-page grid grid-cols-12 gap-8 py-8">
            <div className="col-span-3">
              <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{t("nav.shopOf", { name: active.name })}</p>
              <ul className="space-y-2.5">
                <li><Link href={`/c/${active.slug}`} className="text-[15px] font-semibold hover:text-accent">{t("nav.allOf", { name: active.name })}</Link></li>
                {active.children.map((c) => (
                  <li key={c.slug}><Link href={`/c/${c.slug}`} className="text-[15px] text-ink-soft hover:text-accent">{c.name}</Link></li>
                ))}
              </ul>
            </div>
            <div className="col-span-3">
              <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{t("nav.highlights")}</p>
              <ul className="space-y-2.5 text-[15px] text-ink-soft">
                <li><Link href={`/c/${active.slug}?sort=new`} className="hover:text-accent">{t("nav.newArrivals")}</Link></li>
                <li><Link href={`/c/${active.slug}?sort=best`} className="hover:text-accent">{t("nav.bestSellers")}</Link></li>
                <li><Link href={`/c/${active.slug}?sale=1`} className="hover:text-accent">{t("nav.onSale")}</Link></li>
                <li><Link href="/size-guide" className="hover:text-accent">{t("nav.sizeGuide")}</Link></li>
              </ul>
            </div>
            <div className="col-span-6 grid grid-cols-3 gap-4">
              {collections.slice(0, 3).map((c) => (
                <Link key={c.slug} href={`/collections/${c.slug}`} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-cloud">
                    {c.image && <Image src={c.image} alt="" fill sizes="240px" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
                  </div>
                  <p className="mt-2 text-[14px] font-medium group-hover:text-accent">{c.name}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
