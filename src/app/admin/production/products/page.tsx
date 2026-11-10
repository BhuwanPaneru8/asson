import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader, Pill } from "@/components/admin/ui";

export const metadata = { title: "Bills of materials" };

export default async function BomListPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("production");
  const q = (await searchParams).q?.trim().slice(0, 60) ?? "";
  const products = await db.product.findMany({
    where: { status: { not: "ARCHIVED" }, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: [{ name: "asc" }], take: 200,
    select: { id: true, name: true, labourCost: true, _count: { select: { bomLines: true, productionOrders: true } } },
  });
  return (
    <>
      <PageHeader title="Products & bills of materials" description="For each product we make: the fabric and trims one piece uses, and the workshop's stitching charge. Production orders use this to issue materials and cost each piece." />
      <form className="mb-4"><input name="q" defaultValue={q} placeholder="Find a product" className="h-10 w-full max-w-sm rounded-md border border-line bg-white px-3 text-[14px]" /></form>
      <Card>
        <ul className="divide-y divide-line text-[14px]">{products.map((p) => (
          <li key={p.id}><Link href={`/admin/production/products/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-cloud/40">
            <span className="font-medium">{p.name}</span>
            <span className="flex items-center gap-2 text-[12.5px] text-muted">{p._count.productionOrders ? `${p._count.productionOrders} order(s) · ` : ""}{p._count.bomLines ? <Pill tone="success">{p._count.bomLines} material(s)</Pill> : <Pill>not set up</Pill>}</span>
          </Link></li>
        ))}</ul>
      </Card>
    </>
  );
}
