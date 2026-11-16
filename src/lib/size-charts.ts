// Asson's size charts, shared by /size-guide and the size panel on product pages.
// Rows: size, then two measurements (inches for adults, cm for kids).

export type ChartKind = "tops" | "bottoms" | "kids";

export const SIZE_CHARTS: Record<ChartKind, { rows: [string, string, string][] }> = {
  tops: { rows: [["XS", "34–36", "28–30"], ["S", "36–38", "30–32"], ["M", "38–40", "32–34"], ["L", "40–42", "34–36"], ["XL", "42–44", "36–38"], ["XXL", "44–46", "38–40"]] },
  bottoms: { rows: [["26", "26", "35"], ["28", "28", "37"], ["30", "30", "39"], ["32", "32", "41"], ["34", "34", "43"], ["36", "36", "45"], ["38", "38", "47"]] },
  kids: { rows: [["2-3Y", "92–98", "53"], ["4-5Y", "104–110", "56"], ["6-7Y", "116–122", "60"], ["8-9Y", "128–134", "64"], ["10-11Y", "140–146", "68"]] },
};

/** Which chart fits a product, from its sizes: ages are kids', numbers are waist sizes, letters are tops. */
export function chartFor(sizes: string[]): ChartKind {
  if (sizes.some((s) => /\dY$/i.test(s))) return "kids";
  if (sizes.length && sizes.every((s) => /^\d{2}$/.test(s))) return "bottoms";
  return "tops";
}

/**
 * The size for a body measurement (chest for tops, waist for bottoms, height in cm for kids), or null when it's
 * off the chart. Between two sizes, the larger one: easier to take in than let out.
 */
export function suggestSize(kind: ChartKind, measure: number): string | null {
  if (!Number.isFinite(measure) || measure <= 0) return null;
  const rows = SIZE_CHARTS[kind].rows;
  const ranges = rows.map(([size, m]) => {
    const [lo, hi] = m.split("–").map(Number);
    return { size, lo, hi: hi ?? lo };
  });
  if (kind === "bottoms") {
    // waist sizes are the waist in inches: the smallest size that's at least the measurement
    return ranges.find((r) => r.lo >= Math.round(measure))?.size ?? null;
  }
  const inRange = ranges.filter((r) => measure >= r.lo && measure <= r.hi);
  if (inRange.length) return inRange[inRange.length - 1].size;
  // in a gap between two sizes: the next one up; below the smallest or above the largest: off the chart
  if (measure < ranges[0].lo) return null;
  return ranges.find((r) => r.lo > measure)?.size ?? null;
}
