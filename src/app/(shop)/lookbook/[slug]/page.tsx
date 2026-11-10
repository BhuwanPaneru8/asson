import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getLookbookEntry } from "@/lib/looks";
import { absoluteImageUrl } from "@/lib/media-url";
import { ShopTheLook } from "@/components/lookbook/shop-the-look";
import { LookCard } from "@/components/lookbook/look-card";
import { getT } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n";

type Props = { params: Promise<{ slug: string }> };
const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await getLookbookEntry((await params).slug);
  if (!l) return { title: "Look not found" };
  const description = l.subtitle ?? `${l.pieces.length} pieces styled by Asson.`;
  return {
    title: `${l.title} · Lookbook`,
    description,
    alternates: { canonical: `/lookbook/${l.slug}` },
    openGraph: { title: l.title, description, images: l.hero ? [{ url: absoluteImageUrl(l.hero, site()) }] : [] },
  };
}

export default async function LookPage({ params }: Props) {
  const l = await getLookbookEntry((await params).slug);
  if (!l) notFound();
  const { t, locale } = await getT();
  return (
    <div className="container-page pb-16 pt-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1 text-[13px] text-muted">
        <Link href="/" className="hover:text-ink">{t("cat.home")}</Link><ChevronRight className="h-3.5 w-3.5" />
        <Link href="/lookbook" className="hover:text-ink">{t("nav.lookbook")}</Link><ChevronRight className="h-3.5 w-3.5" />
        <span className="text-ink">{l.title}</span>
      </nav>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <div className="relative aspect-[4/5] overflow-hidden bg-cloud lg:sticky lg:top-24">
            {l.hero && <Image src={l.hero} alt={t("look.alt", { title: l.title })} fill priority sizes="(min-width:1024px) 58vw, 100vw" className="object-cover" />}
          </div>
        </div>
        <div className="lg:col-span-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">{t("look.the")}</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">{l.title}</h1>
          {l.subtitle && <p className="mt-3 text-[16px] text-ink-soft">{l.subtitle}</p>}
          {l.story && <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-ink-soft">{l.story.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>}
          <h2 className="mb-1 mt-8 text-[12px] font-semibold uppercase tracking-[0.2em]">{t("look.shop")}</h2>
          <ShopTheLook pieces={l.pieces.map((p) => ({ id: p.id, name: pick(locale, p.name, p.nameNe), slug: p.slug, price: p.price, compareAtPrice: p.compareAtPrice, note: p.note, images: p.images, colors: p.colors, variants: p.variants }))} />
        </div>
      </div>
      {l.more.length > 0 && (
        <section className="mt-20">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-display text-3xl">{t("look.more")}</h2>
            <Link href="/lookbook" className="text-[14px] font-medium underline underline-offset-4">{t("look.seeAll")}</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">{l.more.map((m) => <LookCard key={m.slug} look={m} t={t} />)}</div>
        </section>
      )}
    </div>
  );
}
