import { EntityHistory } from "@/components/admin/entity-history";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProductEditor } from "@/components/admin/product-editor";
import { LookPicker } from "@/components/admin/look-picker";

export const metadata = { title: "Edit product" };

const lookSel = { id: true, name: true, status: true, images: { take: 1, orderBy: { position: "asc" as const }, select: { url: true } } };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("catalog.view");
  const { id } = await params;
  const [p, categories, collections] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { images: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" } }, collections: { select: { id: true } }, pairsWith: { select: lookSel }, pairedBy: { select: lookSel } } }),
    db.category.findMany({ where: { parentId: { not: null } }, include: { parent: true }, orderBy: [{ parent: { sortOrder: "asc" } }, { sortOrder: "asc" }] }),
    db.collection.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!p) notFound();
  const look = [...new Map([...p.pairsWith, ...p.pairedBy].map((x) => [x.id, { id: x.id, name: x.name, status: x.status, image: x.images[0]?.url ?? "" }])).values()];
  return (
    <>
    <ProductEditor
      readOnly={!can(user, "catalog.edit")}
      showCost={can(user, "finance")}
      categories={categories.map((c) => ({ id: c.id, label: `${c.parent?.name} / ${c.name}` }))}
      collections={collections.map((c) => ({ id: c.id, name: c.name }))}
      initial={{
        id: p.id, name: p.name, nameNe: p.nameNe ?? "", slug: p.slug, brand: p.brand, description: p.description, descriptionNe: p.descriptionNe ?? "", details: p.details, gender: p.gender, status: p.status,
        categoryId: p.categoryId, price: String(p.price / 100), compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice / 100) : "",
        material: p.material ?? "", fit: p.fit ?? "", care: p.care ?? "", tags: p.tags, featured: p.featured,
        collectionIds: p.collections.map((c) => c.id),
        images: p.images.map((i) => ({ url: i.url, alt: i.alt, color: i.color })),
        variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, color: v.color, colorHex: v.colorHex, size: v.size, stock: v.stock, ...(can(user, "finance") ? { costPrice: v.costPrice } : {}) })),
      }}
    />
    <div className="mt-4"><LookPicker productId={p.id} initial={look} readOnly={!can(user, "catalog.edit")} /></div>
    <div className="mt-4 pb-24"><EntityHistory type="Product" id={p.id} /></div>
    </>
  );
}
