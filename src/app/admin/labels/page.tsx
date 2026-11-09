import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { code128Svg } from "@/lib/barcode";
import { LabelSheet } from "@/components/admin/label-sheet";

export const metadata = { title: "Print labels" };

/** Barcode price labels. Open with ?product=<id> or ?po=<purchaseOrderId> (quantities = received units). */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ product?: string; po?: string }> }) {
  await requirePermission("catalog.view");
  const sp = await searchParams;
  let rows: { id: string; sku: string; name: string; color: string; size: string; price: number; qty: number }[] = [];
  let title = "Print labels";
  if (sp.po) {
    const po = await db.purchaseOrder.findUnique({ where: { id: sp.po }, include: { items: { include: { variant: { include: { product: { select: { name: true, price: true } } } } } } } });
    if (po) {
      title = `Labels for PO-${String(po.number).padStart(5, "0")}`;
      rows = po.items.map((i) => ({ id: i.variantId, sku: i.variant.sku, name: i.variant.product.name, color: i.variant.color, size: i.variant.size, price: i.variant.product.price, qty: i.quantityReceived }));
    }
  } else if (sp.product) {
    const p = await db.product.findUnique({ where: { id: sp.product }, include: { variants: { orderBy: { position: "asc" } } } });
    if (p) {
      title = `Labels for ${p.name}`;
      rows = p.variants.map((v) => ({ id: v.id, sku: v.sku, name: p.name, color: v.color, size: v.size, price: p.price, qty: v.stock }));
    }
  }
  return <LabelSheet title={title} rows={rows.map((r) => ({ ...r, svg: code128Svg(r.sku) }))} />;
}
