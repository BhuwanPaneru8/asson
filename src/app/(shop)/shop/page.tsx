import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/catalog-view";
import { parseFilters, type SearchParams } from "@/components/catalog/parse";
import { getCategoryTree } from "@/lib/catalog";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  if (f.q) return { title: `Search: ${f.q}`, robots: { index: false } };
  return { title: f.sale ? "Sale" : f.sort === "new" ? "New arrivals" : "Shop all" };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);
  const [tree, { t, locale }] = await Promise.all([getCategoryTree(), getT()]);
  const title = t(filters.q ? "shop.search" : filters.sale ? "nav.sale" : filters.sort === "new" ? "nav.newArrivals" : filters.sort === "best" ? "nav.bestSellers" : "shop.all");
  return (
    <CatalogView
      title={title}
      description={filters.sale ? t("shop.saleBody") : undefined}
      filters={filters}
      subcategories={filters.q ? [] : tree.map((c) => ({ name: pick(locale, c.name, c.nameNe), slug: c.slug }))}
      basePath={filters.q ? `/shop?q=${encodeURIComponent(filters.q)}` : "/shop"}
    />
  );
}
