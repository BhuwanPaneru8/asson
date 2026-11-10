/**
 * Shopper traffic against a running Asson server: N virtual shoppers browse home → category → search →
 * product for T seconds, then we report throughput, latency percentiles and errors per page.
 *   npx tsx scripts/load-test.ts http://localhost:3105 [shoppers=40] [seconds=30]
 * Point it at staging or a local production build, never production during trading hours.
 */
const [base = "http://localhost:3000", shoppersArg = "40", secondsArg = "30"] = process.argv.slice(2);
const shoppers = Number(shoppersArg), seconds = Number(secondsArg);
const PAGES: [string, () => string][] = [
  ["home", () => "/"],
  ["category", () => `/c/category-${1 + Math.floor(Math.random() * 12)}`],
  ["search", () => `/shop?q=${["linen shirt", "jeans", "kurta", "hoodie", "black dress"][Math.floor(Math.random() * 5)]}`],
  ["product", () => `/p/product-${1 + Math.floor(Math.random() * 3000)}`],
  ["suggest", () => `/api/search/suggest?q=${["lin", "jea", "kur", "hoo"][Math.floor(Math.random() * 4)]}`],
];
const lat = new Map<string, number[]>(), errors = new Map<string, number>();

async function shopper(until: number, i: number) {
  while (Date.now() < until) {
    const [name, path] = PAGES[(i++) % PAGES.length];
    const t = performance.now();
    try {
      const r = await fetch(base + path(), { headers: { "user-agent": "asson-load-test", "x-forwarded-for": `10.9.${i % 250}.${Math.floor(Math.random() * 250)}` } });
      await r.arrayBuffer();
      if (!r.ok) errors.set(`${name} ${r.status}`, (errors.get(`${name} ${r.status}`) ?? 0) + 1);
    } catch { errors.set(`${name} network`, (errors.get(`${name} network`) ?? 0) + 1); }
    (lat.get(name) ?? lat.set(name, []).get(name)!).push(performance.now() - t);
  }
}

const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0); };

(async () => {
  console.log(`${shoppers} shoppers for ${seconds}s against ${base}`);
  await fetch(base + "/").catch(() => { throw new Error(`${base} is not answering`); });
  const until = Date.now() + seconds * 1000;
  await Promise.all(Array.from({ length: shoppers }, (_, i) => shopper(until, i)));
  const all = [...lat.values()].flat();
  console.log(`\n${all.length} requests · ${(all.length / seconds).toFixed(1)} req/s · p50 ${pct(all, 50)} ms · p95 ${pct(all, 95)} ms · p99 ${pct(all, 99)} ms · errors ${[...errors.values()].reduce((a, b) => a + b, 0)}`);
  for (const [name, xs] of lat) console.log(`  ${name.padEnd(9)} ${String(xs.length).padStart(6)} req · p50 ${String(pct(xs, 50)).padStart(5)} ms · p95 ${String(pct(xs, 95)).padStart(5)} ms`);
  if (errors.size) console.log("errors:", Object.fromEntries(errors));
})();
