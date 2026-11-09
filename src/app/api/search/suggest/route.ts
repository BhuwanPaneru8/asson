import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getCategoryTree, searchProductIds } from "@/lib/catalog";
import { rateLimit } from "@/lib/rate-limit";

const suggest = unstable_cache(
  async (q: string) => {
    const ids = (await searchProductIds(q, 6));
    const [rows, tree] = await Promise.all([
      db.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true, price: true, compareAtPrice: true, brand: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } }),
      getCategoryTree(),
    ]);
    const order = new Map(ids.map((id, i) => [id, i]));
    const products = rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!).map((p) => ({ name: p.name, slug: p.slug, brand: p.brand, price: p.price, compareAtPrice: p.compareAtPrice, image: p.images[0]?.url ?? null }));
    // categories: every meaningful word must appear in "Parent Name" (e.g. "men jeans" -> Men / Jeans)
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2).map((w) => w.replace(/s$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const categories = tree
      .flatMap((r) => [{ name: r.name, slug: r.slug, parent: null as string | null }, ...r.children.map((c) => ({ name: c.name, slug: c.slug, parent: r.name }))])
      .filter((c) => {
        const hay = `${c.parent ?? ""} ${c.name}`.toLowerCase();
        const own = c.name.toLowerCase();
        return words.length > 0 && words.every((w) => new RegExp(`\\b${w}`).test(hay)) && words.some((w) => new RegExp(`\\b${w}`).test(own));
      })
      .slice(0, 4);
    return { products, categories };
  },
  ["suggest"],
  { tags: ["products"], revalidate: 300 },
);

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ products: [], categories: [] });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`suggest:${ip}`, 120, 60_000)) return NextResponse.json({ products: [], categories: [] }, { status: 429 });
  const data = await suggest(q.toLowerCase());
  return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
