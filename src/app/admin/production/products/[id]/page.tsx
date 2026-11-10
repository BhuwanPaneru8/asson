import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { costOf } from "@/lib/production";
import { formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { BomEditor } from "@/components/admin/production-forms";

export const metadata = { title: "Bill of materials" };

export default async function BomPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("production");
  const showCost = can(me.role, "finance");
  const [p, materials] = await Promise.all([
    db.product.findUnique({ where: { id: (await params).id }, select: { id: true, name: true, price: true, labourCost: true, bomLines: { include: { material: { select: { name: true, unit: true, costPerUnit: true } } } } } }),
    db.material.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, code: true, name: true, unit: true, supplierId: true } }),
  ]);
  if (!p) notFound();
  const allowance = 1 + store.production.wastagePercent / 100;
  const materialCost = p.bomLines.reduce((s, l) => s + costOf(Math.ceil(l.quantity * allowance), l.material.costPerUnit), 0);
  const cost = materialCost + (p.labourCost ?? 0);
  return (
    <>
      <PageHeader title={p.name} description="Bill of materials: what one piece uses, and what the workshop charges to make it."
        actions={<Link href={`/admin/production/new?product=${p.id}`} className="rounded-md bg-ink px-4 py-2 text-[14px] font-medium text-white">Make this</Link>} />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">{!materials.length ? <p className="text-[14px]">Add fabric and trims first (<Link href="/admin/production/materials" className="underline">Fabric &amp; trims</Link>).</p> : <BomEditor productId={p.id} materials={materials} initial={p.bomLines.map((l) => ({ materialId: l.materialId, quantity: l.quantity, note: l.note }))} labourCost={p.labourCost} />}</div>
        {showCost && (
          <Card title="Cost to make one" className="lg:col-span-2">
            <dl className="space-y-1.5 p-5 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">Materials (+{store.production.wastagePercent}% cutting allowance)</dt><dd className="tabular-nums">{formatPrice(materialCost)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Stitching</dt><dd className="tabular-nums">{formatPrice(p.labourCost ?? 0)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Per piece</dt><dd className="tabular-nums">{formatPrice(cost)}</dd></div>
              <div className="flex justify-between text-muted"><dt>Selling price</dt><dd className="tabular-nums">{formatPrice(p.price)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Margin before VAT and overheads</dt><dd className="tabular-nums">{p.price ? `${Math.round(((p.price / 1.13 - cost) / (p.price / 1.13)) * 100)}%` : "—"}</dd></div>
            </dl>
            <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">At today&apos;s material costs. Each production order uses the costs at the moment it&apos;s issued.</p>
          </Card>
        )}
      </div>
    </>
  );
}
