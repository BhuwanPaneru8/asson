import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { scopeFor, storeFilter } from "@/lib/scope";
import { PageHeader } from "@/components/admin/ui";
import { NewProductionOrder } from "@/components/admin/production-forms";

export const metadata = { title: "New production order" };

export default async function NewProductionPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const me = await requirePermission("production");
  const scope = await scopeFor(me);
  const want = (await searchParams).product;
  const [products, workshops, locations] = await Promise.all([
    db.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, labourCost: true, _count: { select: { bomLines: true } }, variants: { orderBy: { position: "asc" }, select: { id: true, color: true, size: true } } } }),
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.store.findMany({ where: { active: true, ...storeFilter(scope) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const list = products.map((p) => ({ id: p.id, name: p.name, labourCost: p.labourCost, hasBom: p._count.bomLines > 0, variants: p.variants })).sort((a, b) => (a.id === want ? -1 : b.id === want ? 1 : Number(b.hasBom) - Number(a.hasBom)));
  return (
    <>
      <PageHeader title="New production order" description="Plan pieces per size for one workshop. It starts as a draft: nothing leaves the shelf until you issue the materials." />
      {!workshops.length ? <p className="text-[14px]">Add the workshop as a supplier first (<Link href="/admin/suppliers" className="underline">Suppliers</Link>).</p>
        : <NewProductionOrder products={list} workshops={workshops} locations={locations} showCost={can(me.role, "finance")} />}
    </>
  );
}
