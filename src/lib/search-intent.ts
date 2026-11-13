// Query understanding for shop search, pure so every rule is unit-tested (tests/unit/search-intent.test.ts).
// Reads a search the way a shop assistant would:
//   "blu shrt under 2000"  → colour Blue, word "shirt", price ≤ Rs 2,000
//   "mens jeans 32"        → men, word "jeans", size 32
//   "hodie size xl"        → word "hoodie", size XL
// Words are corrected only against the shop's own vocabulary (product names, brands, tags, categories), so a
// correction always points at something we sell. What was understood is shown back to the shopper.

import type { Gender } from "@prisma/client";

export type Vocab = { words: Set<string>; colors: string[]; sizes: string[] };
export type Understood = {
  words: string[]; // text words to match, after synonyms, plurals and spelling
  colors: string[];
  sizes: string[];
  gender: Gender | null;
  minPrice: number | null; // paisa
  maxPrice: number | null;
  /** the query as understood, in words, when it differs from what was typed ("blue shirt under Rs 2,000") */
  display: string | null;
  corrected: boolean; // a word's spelling was changed
};

const GENDER_WORDS: Record<string, Gender> = {
  men: "MEN", mens: "MEN", man: "MEN", male: "MEN", gents: "MEN", boys: "KIDS", boy: "KIDS",
  women: "WOMEN", womens: "WOMEN", woman: "WOMEN", ladies: "WOMEN", female: "WOMEN",
  kids: "KIDS", kid: "KIDS", girls: "KIDS", girl: "KIDS", children: "KIDS", child: "KIDS",
};
export const SYNONYMS: Record<string, string> = {
  tee: "tshirt", tees: "tshirt", tshirts: "tshirt", "t-shirt": "tshirt", pant: "trousers", pants: "trousers", trouser: "trousers",
  jumper: "sweater", pullover: "sweater", denim: "jeans", hoody: "hoodie", hoodies: "hoodie", sari: "saree", kurti: "kurta",
  jacket: "jacket", coat: "coat", sneaker: "sneakers", shoe: "shoes", chino: "chinos", short: "shorts",
};
// little words that carry no meaning in a product search
const STOP = new Set(["a", "an", "the", "for", "and", "with", "in", "of", "to", "rs", "npr", "price", "size", "colour", "color", "cheap", "best", "new"]);
const LETTER_SIZES = ["xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl", "2xl", "3xl", "free"];

/** Damerau–Levenshtein distance, giving up past `max` (fast enough for a few thousand words). */
export function editDistance(a: string, b: string, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** How many typos a word of this length may have: none under 4 letters, 1 up to 6, 2 beyond. */
const allowed = (w: string) => (w.length < 4 ? 0 : w.length <= 6 ? 1 : 2);

/** The closest word we sell, or null. Ties go to the shorter, then alphabetically first, word (stable). */
export function correct(word: string, vocab: Set<string>): string | null {
  if (vocab.has(word)) return word;
  const max = allowed(word);
  if (!max) return null;
  let best: string | null = null, bestD = max + 1;
  for (const v of vocab) {
    if (Math.abs(v.length - word.length) > max) continue;
    const d = editDistance(word, v, max);
    if (d < bestD || (d === bestD && best && (v.length < best.length || (v.length === best.length && v < best)))) { best = v; bestD = d; }
  }
  return bestD <= max ? best : null;
}

/** "shirts" → "shirt" when we sell shirts; "jeans", "trousers", "shorts" stay as they are. */
function singular(w: string, vocab: Set<string>) {
  if (vocab.has(w)) return w;
  for (const s of [w.replace(/ies$/, "y"), w.replace(/es$/, ""), w.replace(/s$/, "")]) if (s !== w && vocab.has(s)) return s;
  return w;
}

function matchColor(word: string, colors: string[]): string[] {
  const lower = colors.map((c) => [c, c.toLowerCase()] as const);
  const exact = lower.filter(([, l]) => l === word || l.split(" ").includes(word)).map(([c]) => c);
  if (exact.length) return exact;
  if (word.length >= 3) {
    // "blu" → Blue, "maroo" → Maroon: the start of a colour word, the closest completion only ("blu" is blue,
    // one letter short, not blush, two short)
    const extra = (l: string) => Math.min(...l.split(" ").filter((p) => p.startsWith(word)).map((p) => p.length - word.length));
    const prefix = lower.filter(([, l]) => l.split(" ").some((p) => p.startsWith(word)));
    if (prefix.length) { const best = Math.min(...prefix.map(([, l]) => extra(l))); return prefix.filter(([, l]) => extra(l) === best).map(([c]) => c); }
  }
  if (word.length >= 4) {
    const near = lower.filter(([, l]) => l.split(" ").some((p) => editDistance(word, p, 1) <= 1)).map(([c]) => c);
    if (near.length) return near;
  }
  return [];
}

/** "2000", "2,000", "2k", "1.5k" → paisa */
function money(s: string): number | null {
  const m = s.replace(/,/g, "").match(/^(\d+(?:\.\d+)?)(k)?$/);
  if (!m) return null;
  const v = Number(m[1]) * (m[2] ? 1000 : 1);
  return v > 0 && v < 10_000_000 ? Math.round(v * 100) : null;
}

/** The colour as a word for the hint: the part that matched ("blu" → "blue", from "Sky Blue"). */
function colorWord(t: string, col: string[]) {
  const parts = col.flatMap((c) => c.toLowerCase().split(" "));
  return parts.find((p) => p === t) ?? parts.filter((p) => p.startsWith(t)).sort((a, b) => a.length - b.length)[0] ?? [...col].sort((a, b) => a.length - b.length)[0].toLowerCase();
}

export function understand(q: string, vocab: Vocab): Understood {
  let text = q.toLowerCase().normalize("NFKC").replace(/rs\.?\s*/g, " ").replace(/[^\p{L}\p{M}\p{N}\s.,\-<>k]/gu, " ") /* \p{M}: Devanagari vowel signs */;
  let minPrice: number | null = null, maxPrice: number | null = null;

  // price phrases first, so their numbers aren't read as sizes
  const take = (re: RegExp, f: (m: RegExpMatchArray) => void) => { const m = text.match(re); if (m) { f(m); text = text.replace(m[0], " "); } };
  take(/\b(?:between\s+)?(\d[\d,.]*k?)\s*(?:-|to|and)\s*(\d[\d,.]*k?)\b/, (m) => { const a = money(m[1]), b = money(m[2]); if (a && b && b > a) { minPrice = a; maxPrice = b; } });
  take(/(?:\bunder|\bbelow|\bless than|\bupto|\bup to|\bwithin|\bmax|<)\s*(\d[\d,.]*k?)\b/, (m) => { maxPrice = money(m[1]); });
  take(/(?:\bover|\babove|\bmore than|\bfrom|\bmin|>)\s*(\d[\d,.]*k?)\b/, (m) => { minPrice = money(m[1]); });

  const tokens = text.split(/\s+/).map((t) => t.replace(/^[.,\-]+|[.,\-]+$/g, "")).filter(Boolean);
  const sizes = new Set<string>(), colors = new Set<string>(), words: string[] = [];
  let gender: Gender | null = null, corrected = false;
  const sizeSet = new Map(vocab.sizes.map((s) => [s.toLowerCase(), s]));
  const shown: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // "size m", "size 32"
    if (t === "size" && tokens[i + 1] && sizeSet.has(tokens[i + 1])) { sizes.add(sizeSet.get(tokens[++i])!); continue; }
    if (/[ऀ-ॿ]/.test(t)) { words.push(t); shown.push(t); continue; } // Nepali: matched as typed
    // two-word colours read together: "sky blu" is Sky Blue, not Sky Blue and Blue
    const next = tokens[i + 1];
    const pair = next && vocab.colors.find((c) => { const [p0, p1, ...rest] = c.toLowerCase().split(" "); return !rest.length && !!p1 && (p0 === t || (t.length >= 3 && p0.startsWith(t))) && (p1 === next || (next.length >= 3 && p1.startsWith(next))); });
    if (pair) { colors.add(pair); shown.push(pair.toLowerCase()); if (pair.toLowerCase() !== `${t} ${next}`) corrected = true; i++; continue; }
    if (STOP.has(t)) continue;
    if (GENDER_WORDS[t] && tokens.length > 1) { gender = GENDER_WORDS[t]; shown.push(t); continue; }
    // letter sizes on their own ("xl"), and waist sizes after trousers or jeans ("jeans 32")
    if (sizeSet.has(t) && (LETTER_SIZES.includes(t) && t.length > 1 || /^\d{2}$/.test(t))) { sizes.add(sizeSet.get(t)!); continue; }
    const col = matchColor(t, vocab.colors);
    if (col.length) { col.forEach((c) => colors.add(c)); if (!col.some((c) => c.toLowerCase().split(" ").includes(t))) corrected = true; shown.push(colorWord(t, col)); continue; }
    if (/^\d+$/.test(t)) continue; // a stray number we can't place
    let w = SYNONYMS[t] ?? singular(t, vocab.words);
    if (!vocab.words.has(w)) {
      const fix = correct(w, vocab.words);
      if (fix && fix !== w) { w = fix; corrected = true; }
    }
    words.push(w);
    shown.push(w === "tshirt" ? "t-shirt" : w);
  }

  const price = minPrice && maxPrice ? `Rs ${(minPrice / 100).toLocaleString("en-IN")}–${(maxPrice / 100).toLocaleString("en-IN")}` : maxPrice ? `under Rs ${(maxPrice / 100).toLocaleString("en-IN")}` : minPrice ? `over Rs ${(minPrice / 100).toLocaleString("en-IN")}` : "";
  const size = sizes.size ? `size ${[...sizes].join("/")}` : "";
  const display = [shown.join(" "), size, price].filter(Boolean).join(", ");
  const typed = q.trim().toLowerCase().replace(/\s+/g, " ");
  return {
    words: [...new Set(words)], colors: [...colors], sizes: [...sizes], gender, minPrice, maxPrice,
    display: display && display !== typed ? display : null,
    corrected,
  };
}

// ---------- type-ahead completions ----------

export type Candidate = { text: string; weight: number };
export type Completion = { text: string; /** where what was typed sits in `text`, so the rest can be shown in bold */ match: [number, number] | null };

const norm = (s: string) => s.toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();

/**
 * Completions for what's being typed, best first. How well it matches counts most:
 *   whole start  ("shi" → "shirt", "linen s" → "linen shirt")                          4
 *   a later word ("shi" → "linen shirt")                                                3
 *   every typed word starts one of its words, in order ("lin shi" → "linen shirt")     2
 * then how often people search and buy it (log, so one huge term can't drown the rest), then shorter first.
 * Never offers exactly what was typed.
 */
export function rankCompletions(typed: string, candidates: Candidate[], limit = 6): Completion[] {
  const q = norm(typed);
  if (!q) return [];
  const qWords = q.split(" ");
  const seen = new Set<string>();
  const scored: { text: string; score: number; match: [number, number] | null }[] = [];
  for (const c of candidates) {
    const text = norm(c.text);
    if (!text || text === q || seen.has(text)) continue;
    let tier = 0, match: [number, number] | null = null;
    if (text.startsWith(q)) { tier = 4; match = [0, q.length]; }
    else {
      const at = text.indexOf(` ${q}`);
      if (at >= 0) { tier = 3; match = [at + 1, at + 1 + q.length]; }
      else {
        const words = text.split(" ");
        let wi = 0;
        for (const w of qWords) { while (wi < words.length && !words[wi].startsWith(w)) wi++; if (wi++ >= words.length) { wi = -1; break; } }
        if (wi > 0) tier = 2;
      }
    }
    if (!tier) continue;
    seen.add(text);
    scored.push({ text, score: tier * 10 + Math.log1p(Math.max(0, c.weight)) - text.length / 200, match });
  }
  return scored.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text)).slice(0, limit).map(({ text, match }) => ({ text, match }));
}

/** Recent searches: newest first, no repeats (ignoring case and spacing), at most `max`. */
export function addRecent(list: string[], term: string, max = 8) {
  const t = term.trim().replace(/\s+/g, " ");
  if (!t) return list.slice(0, max);
  return [t, ...list.filter((x) => norm(x) !== norm(t))].slice(0, max);
}
