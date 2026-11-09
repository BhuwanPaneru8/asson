import Image from "next/image";
import Link from "next/link";
import { Truck, RotateCcw, ShieldCheck, Banknote } from "lucide-react";
import { getCategoryTree, getCollections, getProductRail } from "@/lib/catalog";
import { ProductRail } from "@/components/product/product-rail";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { buttonClass } from "@/components/ui/button";
import { store } from "@/lib/config";
import { formatPrice } from "@/lib/utils";

const U = (id: string) => `https://images.unsplash.com/photo-${id}`;

export default async function HomePage() {
  const [tree, collections, best, fresh, sale] = await Promise.all([
    getCategoryTree(),
    getCollections(),
    getProductRail("best", 8),
    getProductRail("new", 8),
    getProductRail("sale", 8),
  ]);
  const shopCats = tree.flatMap((r) => r.children.slice(0, 4).map((c) => ({ ...c, parent: r.name })));
  const featured = collections.filter((c) => c.featured);

  return (
    <>
      {/* Hero */}
      <section className="relative">
        <div className="grid md:grid-cols-2">
          <Link href="/c/women" className="group relative block aspect-[4/5] overflow-hidden md:aspect-auto md:h-[min(82vh,820px)]">
            <Image src={U("1483985988355-763728e1935b")} alt="Women's collection" fill priority sizes="(min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-[1.5s] group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-12">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em]">Women</p>
              <h2 className="mt-2 font-display text-4xl leading-[1.05] md:text-6xl">The season&apos;s<br />easy layers</h2>
              <span className="mt-5 inline-block border-b border-white pb-0.5 text-[14px] font-medium">Shop women</span>
            </div>
          </Link>
          <Link href="/c/men" className="group relative hidden overflow-hidden md:block md:h-[min(82vh,820px)]">
            <Image src={U("1490114538077-0a7f8cb49891")} alt="Men's collection" fill priority sizes="50vw" className="object-cover transition-transform duration-[1.5s] group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-12 text-white">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em]">Men</p>
              <h2 className="mt-2 font-display text-6xl leading-[1.05]">Built for<br />every day</h2>
              <span className="mt-5 inline-block border-b border-white pb-0.5 text-[14px] font-medium">Shop men</span>
            </div>
          </Link>
        </div>
        <div className="flex gap-2 p-4 md:hidden">
          <Link href="/c/men" className={buttonClass("secondary", "md", "flex-1")}>Shop men</Link>
          <Link href="/c/women" className={buttonClass("primary", "md", "flex-1")}>Shop women</Link>
          <Link href="/c/kids" className={buttonClass("secondary", "md", "flex-1")}>Kids</Link>
        </div>
      </section>

      {/* Service promises */}
      <section className="border-b border-line">
        <div className="container-page grid grid-cols-2 gap-y-5 py-6 md:grid-cols-4">
          {[
            [Truck, "Free delivery", `All over Nepal above ${formatPrice(store.shipping.freeThreshold)}`],
            [RotateCcw, `${store.returnWindowDays}-day returns`, "Easy, no-fuss returns"],
            [Banknote, "Cash on delivery", "Pay when it arrives"],
            [ShieldCheck, "Pay your way", "eSewa, Khalti, Fonepay & cards"],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Truck;
            return (
              <div key={t as string} className="flex items-center gap-3">
                <I className="h-6 w-6 shrink-0" strokeWidth={1.4} />
                <div><p className="text-[14px] font-semibold">{t as string}</p><p className="text-[12.5px] text-muted">{d as string}</p></div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Category tiles */}
      <section className="container-page pt-14">
        <h2 className="mb-6 font-display text-3xl md:text-[34px]">Shop by category</h2>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-6 md:px-0">
          {shopCats.slice(0, 12).map((c) => (
            <Link key={c.slug} href={`/c/${c.slug}`} className="group w-32 shrink-0 md:w-auto">
              <div className="flex aspect-square items-center justify-center bg-cloud px-3 text-center transition-colors group-hover:bg-accent-soft">
                <span className="font-display text-[19px] leading-tight">{c.name}</span>
              </div>
              <p className="mt-2 text-center text-[12.5px] uppercase tracking-wider text-muted">{c.parent}</p>
            </Link>
          ))}
        </div>
      </section>

      <ProductRail eyebrow="Most loved" title="Best sellers" href="/shop?sort=best" products={best} />

      {/* Featured collections */}
      <section className="container-page py-8">
        <div className="grid gap-4 md:grid-cols-2">
          {featured.slice(0, 2).map((c) => (
            <Link key={c.slug} href={`/collections/${c.slug}`} className="group relative block aspect-[4/3] overflow-hidden bg-cloud">
              {c.image && <Image src={c.image} alt={c.name} fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-[1.2s] group-hover:scale-[1.04]" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 p-6 text-white md:p-10">
                <h3 className="font-display text-3xl md:text-4xl">{c.name}</h3>
                <p className="mt-1 max-w-sm text-[14.5px] text-white/85">{c.description}</p>
                <span className="mt-4 inline-block border-b border-white pb-0.5 text-[14px] font-medium">Explore</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ProductRail eyebrow="Just landed" title="New arrivals" href="/shop?sort=new" products={fresh} />
      <RecentlyViewed title="Pick up where you left off" />

      <section className="container-page py-8">
        <div className="grid gap-4 md:grid-cols-2">
          {featured.slice(2, 4).map((c) => (
            <Link key={c.slug} href={`/collections/${c.slug}`} className="group flex items-center gap-5 bg-cloud p-4 md:p-6">
              <div className="relative aspect-square w-28 shrink-0 overflow-hidden md:w-40">
                {c.image && <Image src={c.image} alt="" fill sizes="160px" className="object-cover transition-transform duration-700 group-hover:scale-105" />}
              </div>
              <div>
                <h3 className="font-display text-2xl md:text-3xl">{c.name}</h3>
                <p className="mt-1 text-[14px] text-muted">{c.description}</p>
                <span className="mt-3 inline-block text-[14px] font-medium underline underline-offset-4">Shop now</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ProductRail eyebrow="Limited time" title="On sale now" href="/shop?sale=1" products={sale} />

      <section className="container-page pt-6">
        <div className="bg-ink px-6 py-14 text-center text-white md:py-20">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/60">New here?</p>
          <h2 className="mx-auto mt-3 max-w-2xl font-display text-4xl md:text-5xl">10% off your first order</h2>
          <p className="mx-auto mt-3 max-w-md text-white/75">Use code <span className="font-semibold text-white">WELCOME10</span> at checkout. Free returns, always.</p>
          <Link href="/shop" className={buttonClass("secondary", "lg", "mt-8 border-white")}>Start shopping</Link>
        </div>
      </section>
    </>
  );
}
