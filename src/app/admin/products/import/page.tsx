import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { ImportWizard } from "@/components/admin/import-wizard";

export const metadata = { title: "Import products" };

export default async function ImportPage() {
  await requirePermission("catalog.edit");
  const [cats, collections] = await Promise.all([
    db.category.findMany({ where: { parentId: { not: null } }, include: { parent: true }, orderBy: [{ parent: { sortOrder: "asc" } }, { sortOrder: "asc" }] }),
    db.collection.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
  ]);
  return (
    <div className="pb-24">
      <Link href="/admin/products" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Products</Link>
      <PageHeader title="Import products from a spreadsheet" description="Add or update many products at once. Nothing changes until you've checked the preview." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2"><ImportWizard /></div>
        <aside className="space-y-4 text-[13.5px] text-ink-soft">
          <section className="rounded-md border border-line bg-white p-5">
            <h2 className="mb-2 text-[14.5px] font-semibold text-ink">How to fill it in</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b>One row per colour and size.</b> Rows with the same <code>handle</code> are one product.</li>
              <li>Product details (name, price, description…) only need to be on the product&apos;s <b>first row</b>.</li>
              <li><code>price</code> and <code>mrp</code> in rupees. Leave <code>mrp</code> blank if there&apos;s no discount.</li>
              <li>Lists use <code>|</code>: <code>features</code>, <code>images</code>, <code>collections</code>.</li>
              <li>Leave <code>sku</code> blank to get the next AS-number automatically.</li>
              <li>New products are <b>Draft</b> unless <code>status</code> says active — check them, then publish.</li>
              <li><b>Updating:</b> export, edit, re-import. Blank cells change nothing; nothing is ever deleted. Stock of existing sizes is never changed here — use Inventory or Purchasing.</li>
              <li>Photos: upload them in the product editor after importing, or paste https links in <code>images</code>.</li>
            </ul>
          </section>
          <section className="rounded-md border border-line bg-white p-5">
            <h2 className="mb-2 text-[14.5px] font-semibold text-ink">Categories you can use</h2>
            <p className="leading-relaxed">{cats.map((c) => `${c.parent?.name} / ${c.name}`).join(" · ")}</p>
            {collections.length > 0 && <><h2 className="mb-2 mt-4 text-[14.5px] font-semibold text-ink">Collections</h2><p>{collections.map((c) => c.name).join(" · ")}</p></>}
          </section>
        </aside>
      </div>
    </div>
  );
}
