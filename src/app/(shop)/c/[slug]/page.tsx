import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog/catalog-view";
import { parseFilters, type SearchParams } from "@/components/catalog/parse";
import { getCategoryBySlug } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCategoryBySlug((await params).slug);
  if (!c) return {};
  const name = c.parent ? `${c.parent.name}'s ${c.node.name}` : `${c.node.name}'s clothing`;
  return { title: name, description: c.node.description ?? `Shop ${name.toLowerCase()} online in Nepal. Cash on delivery, delivery to all 77 districts and easy returns.`, alternates: { canonical: `/c/${c.node.slug}` } };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const c = await getCategoryBySlug(slug);
  if (!c) notFound();
  const filters = parseFilters(await searchParams, { category: slug });
  const crumbs = c.parent ? [{ label: c.parent.name, href: `/c/${c.parent.slug}` }] : [];
  const siblings = c.node.children.length ? c.node.children : [];
  return (
    <CatalogView
      title={c.node.name}
      description={c.node.description}
      filters={filters}
      crumbs={crumbs}
      subcategories={siblings}
      basePath={`/c/${slug}`}
    />
  );
}
