import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/admin/ui";
import { NepaliNameRow } from "@/components/admin/nepali-names";

export const metadata = { title: "Nepali names" };

const th = "px-4 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";

export default async function NepaliNamesPage() {
  await requirePermission("catalog.edit");
  const [categories, collections, live, missing] = await Promise.all([
    db.category.findMany({ orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }], include: { parent: { select: { name: true } } } }),
    db.collection.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count({ where: { status: "ACTIVE", OR: [{ nameNe: null }, { nameNe: "" }] } }),
  ]);
  const table = (title: string, rows: React.ReactNode) => (
    <Card title={title} className="mb-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>English</th><th className={th}>Nepali name</th><th className={th}>Nepali description</th><th className={th} /></tr></thead>
          <tbody className="divide-y divide-line">{rows}</tbody>
        </table>
      </div>
    </Card>
  );
  return (
    <>
      <PageHeader title="Nepali names" description="What shoppers reading नेपाली see for menus, category pages and collections. Leave a box blank to show the English. Product names are in each product's editor." />
      <p className="mb-4 text-[13.5px] text-ink-soft">{live - missing} of {live} products on sale have a Nepali name.</p>
      {table("Categories", categories.map((c) => <NepaliNameRow key={c.id} row={{ kind: "category", id: c.id, name: c.name, parent: c.parent?.name, description: c.description, nameNe: c.nameNe, descriptionNe: c.descriptionNe }} />))}
      {table("Collections", collections.map((c) => <NepaliNameRow key={c.id} row={{ kind: "collection", id: c.id, name: c.name, description: c.description, nameNe: c.nameNe, descriptionNe: c.descriptionNe }} />))}
    </>
  );
}
