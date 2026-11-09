import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog/catalog-view";
import { parseFilters, type SearchParams } from "@/components/catalog/parse";
import { getCollections } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const col = (await getCollections()).find((x) => x.slug === slug);
  return col ? { title: col.name, description: col.description ?? undefined } : {};
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const col = (await getCollections()).find((x) => x.slug === slug);
  if (!col) notFound();
  const filters = parseFilters(await searchParams, { collection: slug });
  return (
    <>
      {col.image && (
        <div className="relative h-56 overflow-hidden md:h-80">
          <Image src={col.image} alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="container-page relative flex h-full flex-col justify-end pb-8 text-white">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/80">Collection</p>
            <h2 className="font-display text-4xl md:text-6xl">{col.name}</h2>
          </div>
        </div>
      )}
      <CatalogView title={col.name} description={col.description} filters={filters} crumbs={[{ label: "Collections", href: "/shop" }]} basePath={`/collections/${slug}`} />
    </>
  );
}
