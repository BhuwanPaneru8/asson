import Link from "next/link";
import { after } from "next/server";
import { isPlainSearch, recordSearch, trendingSearches } from "@/lib/search-stats";
import { ChevronRight, SearchX } from "lucide-react";
import { getFacets, getProductRail, listProducts, searchProducts, SORTS, type ProductFilters, type CategoryNode } from "@/lib/catalog";
import { ProductRail } from "@/components/product/product-rail";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { FilterPanel, ActiveFilters, SortSelect, MobileFilterButton, ResultsShell, FilterProvider } from "./filters";
import { Pagination } from "./pagination";
import { getT } from "@/lib/i18n/server";

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
  const [result, facets, { t }, search] = await Promise.all([listProducts(filters), getFacets(filters), getT(), filters.q ? searchProducts(filters.q) : null]);
  // nothing found: never a dead end, offer what others search for and what sells
  const [trending, popular] = result.products.length === 0 && filters.q ? await Promise.all([trendingSearches(6), getProductRail("best", 8)]) : [[], []];
  // what shoppers look for (and don't find) — written after the response, never slows the page
  if (isPlainSearch(filters)) after(() => recordSearch(filters.q!, result.total));
  const sorts = [...(filters.q ? [{ id: "relevance" as const }] : []), ...SORTS].map((s) => ({ id: s.id, label: t(`sort.${s.id}`) }));

  return (
    <FilterProvider>
    <div className="container-page pb-8 pt-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-[13px] text-muted">
        <Link href="/" className="hover:text-ink">{t("cat.home")}</Link>
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

      <div className="sticky top-[var(--header-offset)] motion-safe:transition-[top] motion-safe:duration-300 z-20 -mx-4 mb-6 flex items-center justify-between gap-3 border-y border-line bg-paper/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0 lg:static lg:border-x-0 lg:bg-transparent">
        <p className="text-[14px] text-muted">{t(result.total === 1 ? "cat.count1" : "cat.countN", { n: result.total.toLocaleString("en-IN" /* lakh grouping, as used in Nepal */) })}{filters.q && <> {t("cat.for", { q: filters.q })}</>}</p>
        <div className="flex items-center gap-2">
          <MobileFilterButton facets={facets} filters={filters} total={result.total} />
          <SortSelect sorts={sorts} value={filters.sort ?? "featured"} />
        </div>
      </div>

      <div className="flex gap-10">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-[calc(var(--header-offset)+2rem)] motion-safe:transition-[top] motion-safe:duration-300 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8 pr-2">
            <FilterPanel facets={facets} filters={filters} />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          {search && search.ids.length > 0 && (search.relaxed || search.understood.display) && (
            <p className="mb-4 border-l-2 border-accent bg-accent-soft/60 px-4 py-2.5 text-[14px] text-ink-soft">
              {search.relaxed ? t("search.relaxed", { q: filters.q! }) : <>{t("search.showingFor")} <span className="font-semibold text-ink">{search.understood.display}</span></>}
            </p>
          )}
          <ActiveFilters filters={filters} />
          <ResultsShell>
            {result.products.length === 0 ? (
              <EmptyState
                icon={<SearchX className="h-10 w-10" strokeWidth={1.2} />}
                title={filters.q ? t("cat.noResultsFor", { q: filters.q }) : t("cat.noMatch")}
                body={filters.q ? `${search?.understood.display ? `${t("search.understood", { q: search.understood.display })}. ` : ""}${t("cat.noResultsBody")}` : t("cat.noMatchBody")}
                action={filters.q && basePath === `/shop?q=${encodeURIComponent(filters.q)}` && isPlainSearch(filters)
                  ? <Link href="/shop" className={buttonClass("secondary")}>{t("shop.all")}</Link>
                  : <Link href={basePath} className={buttonClass("secondary")}>{t("cat.clearFilters")}</Link>}
              />
            ) : (
              <>
                <ProductGrid products={result.products} />
                <Pagination page={result.page} pages={result.pages} />
              </>
            )}
          </ResultsShell>
          {trending.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 pb-4">
              <span className="mr-1 text-[13px] text-muted">{t("search.tryThese")}</span>
              {trending.map((term) => <Link key={term} href={`/shop?q=${encodeURIComponent(term)}`} className="border border-line bg-white px-3 py-1.5 text-[14px] hover:border-ink">{term}</Link>)}
            </div>
          )}
        </div>
      </div>
    </div>
    {popular.length > 0 && <div className="-mt-4"><ProductRail title={t("cat.popularNow")} products={popular} /></div>}
    </FilterProvider>
  );
}
