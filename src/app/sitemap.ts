import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

// Rendered on request (cached for an hour) so builds never need a database connection.
export const dynamic = "force-dynamic";

const entries = unstable_cache(
  async () => {
    const [products, cats, cols, looks] = await Promise.all([
      db.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
      db.category.findMany({ select: { slug: true } }),
      db.collection.findMany({ select: { slug: true } }),
      db.look.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    ]);
    return { products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() })), cats, cols, looks: looks.map((l) => ({ slug: l.slug, updatedAt: l.updatedAt.toISOString() })) };
  },
  ["sitemap"],
  { tags: ["products", "catalog", "looks"], revalidate: 3600 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { products, cats, cols, looks } = await entries();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily" },
    ...cats.map((c) => ({ url: `${base}/c/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...cols.map((c) => ({ url: `${base}/collections/${c.slug}`, changeFrequency: "weekly" as const })),
    ...products.map((p) => ({ url: `${base}/p/${p.slug}`, lastModified: p.updatedAt, priority: 0.7 })),
    ...(looks.length ? [{ url: `${base}/lookbook`, changeFrequency: "weekly" as const, priority: 0.7 }] : []),
    ...looks.map((l) => ({ url: `${base}/lookbook/${l.slug}`, lastModified: l.updatedAt, priority: 0.6 })),
  ];
}
