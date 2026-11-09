import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProductEditor } from "@/components/admin/product-editor";

export const metadata = { title: "New product" };

export default async function NewProduct() {
  await requireAdmin();
  const [categories, collections] = await Promise.all([
    db.category.findMany({ where: { parentId: { not: null } }, include: { parent: true }, orderBy: [{ parent: { sortOrder: "asc" } }, { sortOrder: "asc" }] }),
    db.collection.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return <ProductEditor showCost categories={categories.map((c) => ({ id: c.id, label: `${c.parent?.name} / ${c.name}` }))} collections={collections.map((c) => ({ id: c.id, name: c.name }))} />;
}
