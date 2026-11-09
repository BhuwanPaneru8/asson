import "server-only";
import { db } from "./db";
import { ktmDate } from "./pos";
import type { ProductFilters } from "./catalog";

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
