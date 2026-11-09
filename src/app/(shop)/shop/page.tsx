import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/catalog-view";
import { parseFilters, type SearchParams } from "@/components/catalog/parse";
import { getCategoryTree } from "@/lib/catalog";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  if (f.q) return { title: `Search: ${f.q}`, robots: { index: false } };
  return { title: f.sale ? "Sale" : f.sort === "new" ? "New arrivals" : "Shop all" };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);
  const tree = await getCategoryTree();
  const title = filters.q ? "Search results" : filters.sale ? "Sale" : filters.sort === "new" ? "New arrivals" : filters.sort === "best" ? "Best sellers" : "Shop all";
  return (
    <CatalogView
      title={title}
      description={filters.sale ? "Limited-time prices on wardrobe favourites." : undefined}
      filters={filters}
      subcategories={filters.q ? [] : tree.map((c) => ({ name: c.name, slug: c.slug }))}
      basePath={filters.q ? `/shop?q=${encodeURIComponent(filters.q)}` : "/shop"}
    />
  );
}
