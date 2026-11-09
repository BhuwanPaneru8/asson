import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // staging must never be indexed (it holds demo data and duplicates the shop)
  if (process.env.ASSON_ENV === "staging") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/checkout", "/cart", "/orders", "/api"] }], sitemap: `${base}/sitemap.xml` };
}
