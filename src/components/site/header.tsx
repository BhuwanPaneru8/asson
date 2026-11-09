import Link from "next/link";
import { getCategoryTree, getCollections, getProductRail } from "@/lib/catalog";
import { store } from "@/lib/config";
import { formatPrice } from "@/lib/utils";
import { Logo } from "./logo";
import { HeaderActions, MobileNavButton } from "./header-client";
import { SearchBar } from "./search-bar";
import { MegaNav } from "./mega-nav";
import { getLookbook } from "@/lib/looks";

export async function Header() {
  const [tree, collections, onSale] = await Promise.all([getCategoryTree(), getCollections(), getProductRail("sale", 1)]);
  const hasSale = onSale.length > 0; // no "Sale" link to an empty page
  const hasLooks = (await getLookbook(1)).length > 0; // same for the Lookbook
  const nav = tree.map((c) => ({ name: c.name, slug: c.slug, image: c.image, children: c.children.map((x) => ({ name: x.name, slug: x.slug })) }));
  const featured = collections.filter((c) => c.featured).map((c) => ({ name: c.name, slug: c.slug, image: c.image }));

  return (
    <>
      <div className="bg-ink text-white">
        <div className="container-page flex h-9 items-center justify-center gap-6 text-[12.5px] tracking-wide">
          <span>Free delivery over {formatPrice(store.shipping.freeThreshold)}</span>
          <span className="hidden sm:inline text-white/40">·</span>
          <span className="hidden sm:inline">Easy {store.returnWindowDays}-day returns</span>
          <span className="hidden md:inline text-white/40">·</span>
          <span className="hidden md:inline">Cash on delivery all over Nepal</span>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <div className="container-page flex h-16 items-center gap-4">
          <MobileNavButton nav={nav} collections={featured} hasSale={hasSale} hasLooks={hasLooks} />
          <Logo className="shrink-0" />
          <MegaNav nav={nav} collections={featured} hasSale={hasSale} hasLooks={hasLooks} />
          <div className="ml-auto flex flex-1 items-center justify-end gap-1 lg:flex-none">
            <SearchBar />
            <HeaderActions />
          </div>
        </div>
      </header>
    </>
  );
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-[14px] font-medium hover:text-accent">{children}</Link>;
}
