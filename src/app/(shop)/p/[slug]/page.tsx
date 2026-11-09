import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { isBot, recordFunnel } from "@/lib/funnel";
import { getLookbookForProduct } from "@/lib/looks";
import { ChevronRight } from "lucide-react";
import { getLiveStock, getLook, getProduct, getRelated, getReviews } from "@/lib/catalog";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { getCurrentUser } from "@/lib/auth";
import { ProductExperience } from "@/components/product/purchase-panel";
import { Reviews } from "@/components/product/reviews";
import { ProductRail } from "@/components/product/product-rail";
import { store } from "@/lib/config";
import { getDeliveryRates } from "@/lib/delivery";
import { absoluteImageUrl } from "@/lib/media-url";

const siteBase = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return { title: "Product not found" };
  return {
    title: p.name,
    description: p.description.slice(0, 155),
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: { title: p.name, description: p.description.slice(0, 155), images: p.images.slice(0, 1).map((i) => ({ url: absoluteImageUrl(i.url, siteBase) })) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  // funnel: a real product view (bots and link previews aren't counted)
  if (!isBot((await headers()).get("user-agent"))) after(() => recordFunnel("view", product.id));
  const inLooks = await getLookbookForProduct(product.id);

  const [stock, related, reviews, user, rates, look] = await Promise.all([
    getLiveStock(product.id),
    getRelated(product.id, product.categoryId, product.gender),
    getReviews(product.id),
    getCurrentUser(),
    getDeliveryRates(),
    getLook(product.id),
  ]);
  const lookIds = new Set(look.map((l) => l.id));
  const variants = product.variants.map((v) => ({ id: v.id, color: v.color, colorHex: v.colorHex, size: v.size, stock: stock[v.id] ?? v.stock }));
  const topFit = reviews.fits.sort((a, b) => b.count - a.count)[0]?.fit;
  const cat = product.category;
  const inStock = variants.some((v) => v.stock > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: { "@type": "Brand", name: product.brand },
    image: product.images.map((i) => absoluteImageUrl(i.url, siteBase)),
    sku: product.variants[0]?.sku,
    ...(product.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAvg, reviewCount: product.ratingCount } } : {}),
    offers: { "@type": "Offer", priceCurrency: store.currency, price: (product.price / 100).toFixed(2), availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `/p/${product.slug}` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container-page pt-4 md:pt-6">
        <nav aria-label="Breadcrumb" className="mb-4 hidden flex-wrap items-center gap-1 text-[13px] text-muted md:flex">
          <Link href="/" className="hover:text-ink">Home</Link>
          {cat.parent && <><ChevronRight className="h-3.5 w-3.5" /><Link href={`/c/${cat.parent.slug}`} className="hover:text-ink">{cat.parent.name}</Link></>}
          <ChevronRight className="h-3.5 w-3.5" /><Link href={`/c/${cat.slug}`} className="hover:text-ink">{cat.name}</Link>
          <ChevronRight className="h-3.5 w-3.5" /><span className="text-ink">{product.name}</span>
        </nav>
        <ProductExperience
          rates={rates}
          fitSummary={topFit}
          product={{
            id: product.id, name: product.name, brand: product.brand, price: product.price, compareAtPrice: product.compareAtPrice,
            ratingAvg: product.ratingAvg, ratingCount: product.ratingCount, description: product.description, details: product.details,
            material: product.material, care: product.care, fit: product.fit, categoryName: cat.name,
            images: product.images.map((i) => ({ url: i.url, alt: i.alt, color: i.color })), variants,
          }}
        />
      </div>
      {look.length > 0 && <div className="mt-16"><ProductRail eyebrow="Styled by Asson" title="Complete the look" products={look} /></div>}
      {inLooks.length > 0 && (
        <p className="mt-6 text-[14px] text-ink-soft">
          Seen in the Lookbook: {inLooks.map((l, i) => <span key={l.slug}>{i > 0 && " · "}<Link href={`/lookbook/${l.slug}`} className="font-medium underline underline-offset-4">{l.title}</Link></span>)}
        </p>
      )}
      <div className={look.length ? "" : "mt-16"}><ProductRail title="You may also like" products={related.filter((r) => !lookIds.has(r.id))} /></div>
      <RecentlyViewed currentId={product.id} />
      <Reviews productId={product.id} avg={product.ratingAvg} count={product.ratingCount} data={reviews} canReview={!!user} />
    </>
  );
}
