import Link from "next/link";
import { getCategoryTree, getCollections, getProductRail } from "@/lib/catalog";
import { Logo } from "./logo";
import { HeaderActions, MobileNavButton } from "./header-client";
import { Suspense } from "react";
import { SearchBar, SearchBarWithQuery } from "./search-bar";
import { MegaNav } from "./mega-nav";
import { getLookbook } from "@/lib/looks";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n";
import { HeaderShell } from "./header-shell";

export async function Header() {
  const [tree, collections, onSale, { locale }] = await Promise.all([getCategoryTree(), getCollections(), getProductRail("sale", 1), getT()]);
  const hasSale = onSale.length > 0; // no "Sale" link to an empty page
  const hasLooks = (await getLookbook(1)).length > 0; // same for the Lookbook
  const nav = tree.map((c) => ({ name: pick(locale, c.name, c.nameNe), slug: c.slug, image: c.image, children: c.children.map((x) => ({ name: pick(locale, x.name, x.nameNe), slug: x.slug })) }));
  const featured = collections.filter((c) => c.featured).map((c) => ({ name: pick(locale, c.name, c.nameNe), slug: c.slug, image: c.image }));

  return (
    <>
      <HeaderShell>
        <div className="container-page flex h-16 items-center gap-4">
          <MobileNavButton nav={nav} collections={featured} hasSale={hasSale} hasLooks={hasLooks} />
          <Logo className="shrink-0" />
          <MegaNav nav={nav} collections={featured} hasSale={hasSale} hasLooks={hasLooks} />
          <div className="ml-auto flex flex-1 items-center justify-end gap-1 lg:flex-none">
            {/* reads the results page's ?q= so the box shows (and reopens with) what was searched */}
            <Suspense fallback={<SearchBar />}><SearchBarWithQuery /></Suspense>
            <HeaderActions />
          </div>
        </div>
      </HeaderShell>
    </>
  );
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-[14px] font-medium hover:text-accent">{children}</Link>;
}
