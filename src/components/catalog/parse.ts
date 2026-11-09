import type { Gender } from "@prisma/client";
import type { ProductFilters, SortId } from "@/lib/catalog";
import { sp, spList } from "@/lib/utils";

export type SearchParams = Record<string, string | string[] | undefined>;

const SORT_IDS = ["featured", "new", "best", "price-asc", "price-desc", "rating", "relevance"];
const GENDERS = ["MEN", "WOMEN", "KIDS", "UNISEX"];

export function parseFilters(params: SearchParams, base: Partial<ProductFilters> = {}): ProductFilters {
  const num = (v?: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined; };
  const sort = sp(params.sort);
  const gender = sp(params.gender)?.toUpperCase();
  const page = Number.parseInt(sp(params.page) ?? "1", 10);
  const q = sp(params.q)?.trim().slice(0, 80) || undefined;
  return {
    ...base,
    q,
    gender: base.gender ?? (gender && GENDERS.includes(gender) ? (gender as Gender) : undefined),
    sizes: spList(params.size).slice(0, 20),
    colors: spList(params.color).slice(0, 20),
    brands: spList(params.brand).slice(0, 20),
    minPrice: num(sp(params.min)),
    maxPrice: num(sp(params.max)),
    sale: sp(params.sale) === "1" || undefined,
    inStock: sp(params.stock) === "1" || undefined,
    sort: sort && SORT_IDS.includes(sort) ? (sort as SortId) : q ? "relevance" : "featured",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}
