import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { ktmDate } from "./pos";
import { understandSearch, type ProductFilters } from "./catalog";

/** "  Linen   SHIRT! " → "linen shirt". Terms longer than 60 characters are cut. */
export function normaliseTerm(q: string) {
  return q.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/** Only a plain search counts (first page, no extra filters, default relevance order), so refining results doesn't double count. */
export function isPlainSearch(f: ProductFilters) {
  return !!f.q && (f.page ?? 1) === 1 && !f.category && !f.collection && !f.gender && !f.sizes?.length && !f.colors?.length && !f.brands?.length && f.minPrice == null && f.maxPrice == null && !f.sale && !f.inStock && (!f.sort || f.sort === "relevance");
}

/** One row per Nepal day and term; numbers only, nothing about who searched. Never throws. */
export async function recordSearch(q: string, results: number) {
  const term = normaliseTerm(q);
  if (term.length < 2 || /^\d{7,}$/.test(term.replace(/\s/g, ""))) return; // skip noise and phone/order-number-like input
  const zero = results === 0 ? 1 : 0;
  try {
    await db.$executeRaw`
      INSERT INTO "SearchStat" ("day", "term", "searches", "zeroResults", "lastResults")
      VALUES (${ktmDate()}, ${term}, 1, ${zero}, ${results})
      ON CONFLICT ("day", "term") DO UPDATE SET
        "searches" = "SearchStat"."searches" + 1,
        "zeroResults" = "SearchStat"."zeroResults" + ${zero},
        "lastResults" = ${results}`;
  } catch (e) {
    console.error("recordSearch", e);
  }
}

/** Shown when nothing has been searched enough yet (a new shop), so the box is never empty. */
export const STARTER_SEARCHES = ["Linen shirt", "Jeans", "Kurta", "Hoodie", "Oversized tee", "Jacket"];

/** What shoppers search most in the last 30 days and find something for. Refreshed hourly; a term needs 3+
 * searches so one person's typing never shows up for everyone. Topped up with starter terms. */
export const trendingSearches = unstable_cache(
  async (limit = 6) => {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const rows = await db.searchStat.groupBy({ by: ["term"], where: { day: { gte: since }, lastResults: { gt: 0 } }, _sum: { searches: true }, having: { searches: { _sum: { gte: 3 } } }, orderBy: { _sum: { searches: "desc" } }, take: limit * 2 });
    // shown as understood ("blu shrt" → "blue shirt"): never put a misspelling in front of everyone
    const terms: string[] = [];
    for (const r of rows) {
      const u = await understandSearch(r.term);
      const shown = u.corrected && u.display ? u.display : r.term;
      const nice = shown.charAt(0).toUpperCase() + shown.slice(1);
      if (!terms.some((t) => t.toLowerCase() === nice.toLowerCase())) terms.push(nice);
    }
    terms.splice(limit);
    for (const s of STARTER_SEARCHES) if (terms.length < limit && !terms.some((t) => t.toLowerCase() === s.toLowerCase())) terms.push(s);
    return terms;
  },
  ["trending-searches"],
  { revalidate: 3600 },
);
