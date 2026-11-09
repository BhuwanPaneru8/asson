import Link from "next/link";
import { after } from "next/server";
import { isPlainSearch, recordSearch } from "@/lib/search-stats";
import { ChevronRight, SearchX } from "lucide-react";
import { getFacets, listProducts, SORTS, type ProductFilters, type CategoryNode } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { FilterPanel, ActiveFilters, SortSelect, MobileFilterButton, ResultsShell, FilterProvider } from "./filters";
import { Pagination } from "./pagination";

export async function CatalogView({
  title,
  description,
  filters,
  crumbs = [],
  subcategories = [],
  basePath,
}: {
  title: string;
  description?: string | null;
  filters: ProductFilters;
  crumbs?: { label: string; href: string }[];
  subcategories?: Pick<CategoryNode, "name" | "slug">[];
  basePath: string;
}) {
  const [result, facets] = await Promise.all([listProducts(filters), getFacets(filters)]);
  // what shoppers look for (and don't find) — written after the response, never slows the page
  if (isPlainSearch(filters)) after(() => recordSearch(filters.q!, result.total));
  const sorts = filters.q ? [{ id: "relevance", label: "Most relevant" }, ...SORTS] : [...SORTS];

  return (
    <FilterProvider>
    <div className="container-page pb-8 pt-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-[13px] text-muted">
        <Link href="/" className="hover:text-ink">Home</Link>
        {crumbs.map((c) => (
          <span key={c.href} className="flex items-center gap-1"><ChevronRight className="h-3.5 w-3.5" /><Link href={c.href} className="hover:text-ink">{c.label}</Link></span>
        ))}
        <span className="flex items-center gap-1"><ChevronRight className="h-3.5 w-3.5" /><span className="text-ink">{title}</span></span>
      </nav>

      <header className="mb-6 flex flex-col gap-2">
        <h1 className="font-display text-4xl md:text-5xl">{title}</h1>
        {description && <p className="max-w-2xl text-[15px] text-muted">{description}</p>}
      </header>

      {subcategories.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {subcategories.map((s) => (
            <Link key={s.slug} href={`/c/${s.slug}`} className="shrink-0 border border-line bg-white px-4 py-2 text-[14px] hover:border-ink">{s.name}</Link>
          ))}
        </div>
      )}

      <div className="sticky top-16 z-20 -mx-4 mb-6 flex items-center justify-between gap-3 border-y border-line bg-paper/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0 lg:static lg:border-x-0 lg:bg-transparent">
        <p className="text-[14px] text-muted"><span className="font-medium text-ink">{result.total.toLocaleString("en-IN" /* lakh grouping, as used in Nepal */)}</span> {result.total === 1 ? "product" : "products"}{filters.q && <> for “<span className="text-ink">{filters.q}</span>”</>}</p>
        <div className="flex items-center gap-2">
          <MobileFilterButton facets={facets} filters={filters} total={result.total} />
          <SortSelect sorts={sorts} value={filters.sort ?? "featured"} />
        </div>
      </div>

      <div className="flex gap-10">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8 pr-2">
            <FilterPanel facets={facets} filters={filters} />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <ActiveFilters filters={filters} />
          <ResultsShell>
            {result.products.length === 0 ? (
              <EmptyState
                icon={<SearchX className="h-10 w-10" strokeWidth={1.2} />}
                title={filters.q ? `No results for “${filters.q}”` : "Nothing matches those filters"}
                body={filters.q ? "Check the spelling, try a more general word, or browse our categories." : "Try removing a filter or two to see more styles."}
                action={<Link href={basePath} className={buttonClass("secondary")}>Clear all filters</Link>}
              />
            ) : (
              <>
                <ProductGrid products={result.products} />
                <Pagination page={result.page} pages={result.pages} />
              </>
            )}
          </ResultsShell>
        </div>
      </div>
    </div>
    </FilterProvider>
  );
}
