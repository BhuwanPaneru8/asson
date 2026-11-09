import Link from "next/link";
import type { PurchaseOrderStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getReorderSuggestions } from "@/actions/admin/purchasing";
import { formatDate, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { NewPurchaseOrder } from "@/components/admin/new-purchase-order";

export const metadata = { title: "Purchasing" };

const TONE: Record<PurchaseOrderStatus, "neutral" | "warn" | "success" | "danger"> = { DRAFT: "neutral", ORDERED: "warn", PARTIALLY_RECEIVED: "warn", RECEIVED: "success", CANCELLED: "danger" };

export default async function PurchasingPage() {
  const me = await requirePermission("purchasing");
  const [orders, suppliers, suggestions, waiting] = await Promise.all([
    db.purchaseOrder.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { supplier: { select: { name: true } }, items: true } }),
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getReorderSuggestions(),
    db.stockAlert.groupBy({ by: ["variantId"], where: { notifiedAt: null }, _count: { _all: true }, orderBy: { _count: { variantId: "desc" } }, take: 12 }),
  ]);
  const waitingVariants = await db.variant.findMany({ where: { id: { in: waiting.map((w) => w.variantId) } }, select: { id: true, sku: true, color: true, size: true, stock: true, product: { select: { name: true } } } });
  const demand = waiting.map((w) => ({ count: w._count._all, v: waitingVariants.find((v) => v.id === w.variantId)! })).filter((d) => d.v);
  const showCost = can(me.role, "finance");
  return (
    <>
      <PageHeader title="Purchasing" description="Order from suppliers, count what arrives, and keep costs accurate." actions={<Link href="/admin/suppliers" className="flex h-10 items-center rounded-md border border-line bg-white px-4 text-[14px] hover:border-ink">Suppliers</Link>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card title="Purchase orders">
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[11.5px] uppercase tracking-wider text-muted"><th className="px-4 py-2.5">PO</th><th className="px-3">Supplier</th><th className="px-3">Status</th><th className="px-3 text-right">Units (recv / ordered)</th>{showCost && <th className="px-3 text-right">Value</th>}<th className="px-4 text-right">Created</th></tr></thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => {
                  const ordered = o.items.reduce((s, i) => s + i.quantityOrdered, 0);
                  const recv = o.items.reduce((s, i) => s + i.quantityReceived, 0);
                  return (
                    <tr key={o.id} className="hover:bg-cloud/40">
                      <td className="px-4 py-2.5"><Link href={`/admin/purchasing/${o.id}`} className="font-semibold hover:underline">PO-{String(o.number).padStart(5, "0")}</Link></td>
                      <td className="px-3">{o.supplier.name}</td>
                      <td className="px-3"><Pill tone={TONE[o.status]}>{o.status.replace("_", " ").toLowerCase()}</Pill></td>
                      <td className="px-3 text-right tabular-nums">{recv} / {ordered}</td>
                      {showCost && <td className="px-3 text-right tabular-nums">{formatPrice(o.items.reduce((s, i) => s + i.unitCost * i.quantityOrdered, 0) + o.landedCost)}</td>}
                      <td className="px-4 text-right text-muted">{formatDate(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!orders.length && <p className="p-8 text-center text-muted">No purchase orders yet.</p>}
          </div>
        </Card>
        <div className="space-y-4">
        {demand.length > 0 && (
          <Card title="Customers waiting for stock">
            <p className="px-4 pt-3 text-[12.5px] text-muted">Sold-out sizes shoppers asked to be texted about. They get an SMS automatically when you receive stock.</p>
            <ul className="divide-y divide-line text-[13.5px]">
              {demand.map((d) => (
                <li key={d.v.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="min-w-0"><span className="block truncate font-medium">{d.v.product.name}</span><span className="text-muted">{d.v.color} · {d.v.size} · {d.v.sku}</span></span>
                  <span className="shrink-0 text-right tabular-nums"><b>{d.count}</b> waiting{d.v.stock > 0 && <span className="block text-[12px] text-muted">{d.v.stock} in stock</span>}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <NewPurchaseOrder suppliers={suppliers} suggestions={suggestions.map((s) => ({ ...s, cost: showCost ? s.cost : null }))} />
        </div>
      </div>
    </>
  );
}
