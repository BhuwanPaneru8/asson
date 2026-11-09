import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { landedUnitCost } from "@/lib/costing";
import { defaultReceivingLocation, getLocations } from "@/lib/stock";
import { Card } from "@/components/admin/ui";
import { PurchaseOrderEditor } from "@/components/admin/purchase-order-editor";

export const metadata = { title: "Purchase order" };

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("purchasing");
  const po = await db.purchaseOrder.findUnique({
    where: { id: (await params).id },
    include: {
      supplier: true,
      items: { include: { variant: { include: { product: { select: { name: true } } } } }, orderBy: { variant: { sku: "asc" } } },
      receipts: { include: { items: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!po) notFound();
  const people = await db.user.findMany({ where: { id: { in: [po.createdById, ...po.receipts.map((r) => r.receivedById)] } }, select: { id: true, name: true } });
  const who = (id: string) => people.find((p) => p.id === id)?.name ?? "—";
  const [main, locations] = await Promise.all([defaultReceivingLocation(), getLocations()]);
  const receiving = [main, ...locations.filter((l) => l.id !== main.id)].map((l) => ({ id: l.id, name: l.name }));
  const goodsValue = po.items.reduce((s, i) => s + i.unitCost * i.quantityOrdered, 0);

  return (
    <>
      <Link href="/admin/purchasing" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Purchasing</Link>
      <PurchaseOrderEditor
        locations={receiving}
        po={{
          id: po.id, number: `PO-${String(po.number).padStart(5, "0")}`, status: po.status, supplier: po.supplier.name,
          notes: po.notes ?? "", landedCost: po.landedCost, expectedAt: po.expectedAt ? po.expectedAt.toISOString().slice(0, 10) : "",
          createdBy: who(po.createdById), createdAt: po.createdAt.toISOString(),
          items: po.items.map((i) => ({
            id: i.id, variantId: i.variantId, sku: i.variant.sku, name: i.variant.product.name, color: i.variant.color, size: i.variant.size,
            quantityOrdered: i.quantityOrdered, quantityReceived: i.quantityReceived, quantityDamaged: i.quantityDamaged, unitCost: i.unitCost,
            landedUnitCost: landedUnitCost(i.unitCost, po.landedCost, goodsValue),
          })),
        }}
      />
      {po.receipts.length > 0 && (
        <Card title="Goods received" className="mt-4">
          <ul className="divide-y divide-line text-[13.5px]">
            {po.receipts.map((r) => (
              <li key={r.id} className="flex justify-between px-5 py-2.5">
                <span>GRN-{r.number} · {who(r.receivedById)} · {formatDateTime(r.createdAt)}{r.note ? ` · “${r.note}”` : ""}</span>
                <span className="tabular-nums">{r.items.reduce((s, i) => s + i.quantity, 0)} good{r.items.some((i) => i.damaged) ? ` · ${r.items.reduce((s, i) => s + i.damaged, 0)} damaged` : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
