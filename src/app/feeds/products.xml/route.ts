import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { renderFeed } from "@/lib/feed";

// Built on request and cached for an hour (and dropped whenever products/stock change).
export const dynamic = "force-dynamic";

const build = unstable_cache(
  async () => {
    const rows = await db.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, slug: true, name: true, brand: true, description: true, gender: true, price: true, compareAtPrice: true, material: true,
        category: { select: { name: true, parent: { select: { name: true } } } },
        images: { orderBy: { position: "asc" }, select: { url: true, color: true } },
        variants: { orderBy: { position: "asc" }, select: { sku: true, color: true, size: true, stock: true } },
      },
    });
    return renderFeed(
      rows.map((r) => ({ ...r, category: [r.category.parent?.name, r.category.name].filter(Boolean).join(" > ") })),
      { siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000", storeName: store.name },
    );
  },
  ["product-feed"],
  { tags: ["products"], revalidate: 3600 },
);

export async function GET() {
  return new Response(await build(), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900, s-maxage=3600" },
  });
}
