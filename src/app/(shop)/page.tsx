import Image from "next/image";
import Link from "next/link";
import { Truck, RotateCcw, ShieldCheck, Banknote, ArrowRight } from "lucide-react";
import { getCategoryCovers, getCategoryTree, getCollections, getProductRail } from "@/lib/catalog";
import { ProductRail } from "@/components/product/product-rail";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { ForYou } from "@/components/product/for-you";
import { LookCard } from "@/components/lookbook/look-card";
import { getLookbook } from "@/lib/looks";
import { buttonClass } from "@/components/ui/button";
import { store } from "@/lib/config";
import { formatPrice } from "@/lib/utils";
import { db } from "@/lib/db";
import { evaluateCoupon } from "@/lib/pricing";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";
import { pick } from "@/lib/i18n";

const U = (id: string) => `https://images.unsplash.com/photo-${id}`;
/** the hero's call to action: a solid white button on the photo, so it reads as tappable */
/** desktop columns for the category tiles, so the last row is never left half empty (10 tiles: 5 + 5, not 6 + 4) */
const catCols = (n: number) => (n % 6 === 0 ? "md:grid-cols-6" : n % 5 === 0 ? "md:grid-cols-5" : n % 4 === 0 ? "md:grid-cols-4" : "md:grid-cols-6");
const heroCta = "mt-6 inline-flex h-11 items-center gap-2 bg-white px-6 text-[14px] font-medium text-ink transition-colors group-hover:bg-paper";

export default async function HomePage() {
  const [tree, covers, collections, best, fresh, sale, featuredCoupon, looks, { t, locale }] = await Promise.all([
    getCategoryTree(),
    getCategoryCovers(),
    getCollections(),
    getProductRail("best", 8),
    getProductRail("new", 8),
    getProductRail("sale", 8),
    db.coupon.findFirst({ where: { showOnHome: true, active: true, isCredit: false }, orderBy: { createdAt: "desc" } }),
    getLookbook(3),
    getT(),
  ]);
  // the coupon the owner featured (Admin → Coupons → Show on home), only while a shopper could use it
  const offer =
    featuredCoupon && evaluateCoupon(featuredCoupon, Math.max(featuredCoupon.minSubtotal, 1)).ok
      ? {
          code: featuredCoupon.code,
          headline:
            featuredCoupon.description ||
            (featuredCoupon.type === "PERCENT" ? t("home.offerPercent", { n: featuredCoupon.value }) : featuredCoupon.type === "FIXED" ? t("home.offerFixed", { amount: formatPrice(featuredCoupon.value) }) : t("home.offerFree")),
          eyebrow: featuredCoupon.endsAt
            ? t("home.offerEnds", { date: featuredCoupon.endsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kathmandu" }) })
            : t("home.limited"),
          terms:
            featuredCoupon.minSubtotal > 0
              ? t("home.useCodeMin", { amount: formatPrice(featuredCoupon.minSubtotal), days: store.returnWindowDays })
              : t("home.useCode", { days: store.returnWindowDays }),
        }
      : null;
  const shopCats = tree.flatMap((r) => r.children.slice(0, 4).map((c) => ({ ...c, name: pick(locale, c.name, c.nameNe), parent: pick(locale, r.name, r.nameNe) })));
  const featured = collections.filter((c) => c.featured).map((c) => ({ ...c, name: pick(locale, c.name, c.nameNe), description: pick(locale, c.description, c.descriptionNe) }));

  return (
    <>
      {/* the page's main heading, for screen readers and search (the hero's lines are pictures with words) */}
      <h1 className="sr-only">{store.name}: {store.tagline}</h1>
      {/* Hero */}
      <section className="relative">
        <div className="grid md:grid-cols-2">
          <Link href="/c/women" className="group relative block aspect-[4/5] overflow-hidden md:aspect-auto md:h-[min(82vh,820px)]">
            <Image src={U("1483985988355-763728e1935b")} alt={t("home.altWomen")} fill loading="eager" fetchPriority="high" sizes="(min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-[1.5s] group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-12">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em]">{t("g.women")}</p>
              <h2 className="mt-2 whitespace-pre-line font-display text-4xl leading-[1.05] md:text-6xl">{t("home.heroWomen")}</h2>
              <span className={heroCta}>{t("home.shopWomen")}<ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.8} aria-hidden /></span>
            </div>
          </Link>
          <Link href="/c/men" className="group relative hidden overflow-hidden md:block md:h-[min(82vh,820px)]">
            <Image src={U("1490114538077-0a7f8cb49891")} alt={t("home.altMen")} fill sizes="50vw" className="object-cover transition-transform duration-[1.5s] group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-12 text-white">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em]">{t("g.men")}</p>
              <h2 className="mt-2 whitespace-pre-line font-display text-6xl leading-[1.05]">{t("home.heroMen")}</h2>
              <span className={heroCta}>{t("home.shopMen")}<ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.8} aria-hidden /></span>
            </div>
          </Link>
        </div>
        <div className="flex gap-2 p-4 md:hidden">
          <Link href="/c/men" className={buttonClass("secondary", "md", "flex-1 whitespace-nowrap px-2")}>{t("g.men")}</Link>
          <Link href="/c/women" className={buttonClass("primary", "md", "flex-1 whitespace-nowrap px-2")}>{t("g.women")}</Link>
          <Link href="/c/kids" className={buttonClass("secondary", "md", "flex-1 whitespace-nowrap px-2")}>{t("g.kids")}</Link>
        </div>
      </section>

      {/* Service promises */}
      <section className="border-b border-line bg-white">
        <div className="container-page no-scrollbar flex snap-x scroll-px-4 gap-8 overflow-x-auto py-4 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:py-6">
          {[
            [Truck, t("home.freeDelivery"), t("home.freeDeliveryBody", { amount: formatPrice(store.shipping.freeThreshold) })],
            [RotateCcw, t("home.returns", { days: store.returnWindowDays }), t("home.returnsBody")],
            [Banknote, t("pay.cod"), t("home.codBody")],
            store.onlinePaymentsLive
              ? [ShieldCheck, t("home.payWay"), t("home.payWayBody")]
              : [ShieldCheck, t("home.secure"), t("home.secureBody")],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Truck;
            return (
              <div key={t as string} className="flex shrink-0 snap-start items-center gap-3 md:justify-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cloud"><I className="h-5 w-5" strokeWidth={1.5} /></span>
                <div className="whitespace-nowrap md:whitespace-normal"><p className="text-[14px] font-semibold">{t as string}</p><p className="text-[12.5px] text-muted">{d as string}</p></div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Category tiles */}
      <section className="container-page pt-12 md:pt-16">
        <h2 className="mb-6 font-display text-3xl md:mb-8 md:text-[34px]">{t("home.byCategory")}</h2>
        <div className={`no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:gap-4 md:px-0 ${catCols(Math.min(shopCats.length, 12))}`}>
          {shopCats.slice(0, 12).map((c) => (
            <Link key={c.slug} href={`/c/${c.slug}`} className="group w-32 shrink-0 md:w-auto">
              {covers[c.id] ? (
                <div className="relative aspect-[4/5] overflow-hidden bg-cloud">
                  <Image src={covers[c.id]} alt="" fill sizes="(min-width:768px) 20vw, 128px" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                </div>
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center bg-cloud px-3 text-center transition-colors group-hover:bg-accent-soft">
                  <span className="font-display text-[19px] leading-tight" aria-hidden>{c.name}</span>
                </div>
              )}
              <p className="mt-2.5 text-center text-[14px] font-medium leading-tight">{c.name}</p>
              <p className="mt-0.5 text-center text-[11.5px] uppercase tracking-wider text-muted">{c.parent}</p>
            </Link>
          ))}
        </div>
      </section>

      <ProductRail eyebrow={t("home.mostLoved")} title={t("nav.bestSellers")} href="/shop?sort=best" products={best} viewAll={t("rail.viewAll")} />

      {/* Lookbook: styled outfits from our own pieces (only once the owner has published some) */}
      {looks.length > 0 && (
        <section className="container-page py-12 md:py-16">
          <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">{t("home.styledBy")}</p>
              <h2 className="mt-2 font-display text-3xl md:text-4xl">{t("home.lookbook")}</h2>
            </div>
            <Link href="/lookbook" className="group/all inline-flex shrink-0 items-center gap-1.5 text-[14px] font-medium"><span className="underline-offset-4 group-hover/all:underline">{t("home.allLooks")}</span><ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/all:translate-x-0.5" strokeWidth={1.8} aria-hidden /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {looks.map((l) => <LookCard key={l.slug} look={l} t={t} />)}
          </div>
        </section>
      )}

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
                <span className="mt-4 inline-block border-b border-white pb-0.5 text-[14px] font-medium">{t("home.explore")}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ProductRail eyebrow={t("home.justLanded")} title={t("nav.newArrivals")} href="/shop?sort=new" products={fresh} viewAll={t("rail.viewAll")} />
      <RecentlyViewed title={t("home.pickUp")} />
      <ForYou eyebrow={t("reco.forYouEyebrow")} title={t("reco.forYou")} />

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
                <span className="mt-3 inline-block text-[14px] font-medium underline underline-offset-4">{t("home.shopNow")}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ProductRail eyebrow={t("home.limited")} title={t("home.onSaleNow")} href="/shop?sale=1" products={sale} viewAll={t("rail.viewAll")} />

      {offer && (
        <section className="container-page pt-6">
          <div className="bg-ink px-6 py-14 text-center text-white md:py-20">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/60">{offer.eyebrow}</p>
            <h2 className="mx-auto mt-3 max-w-2xl font-display text-4xl md:text-5xl">{offer.headline}</h2>
            <p className="mx-auto mt-3 max-w-md text-white/75">
              {rich(offer.terms, { code: <span className="font-semibold text-white">{offer.code}</span> })}
            </p>
            <Link href="/shop" className={buttonClass("secondary", "lg", "mt-8 border-white")}>{t("home.startShopping")}</Link>
          </div>
        </section>
      )}
    </>
  );
}
