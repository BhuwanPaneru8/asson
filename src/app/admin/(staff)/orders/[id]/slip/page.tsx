import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { addressLines, formatDate, formatOrderNumber, formatPrice } from "@/lib/utils";
import { PrintButton } from "@/components/admin/print-button";

type Addr = { fullName: string; phone: string; line1: string; line2?: string | null; city: string; district?: string; state: string; postalCode?: string | null; zone?: string };

export default async function Slip({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("orders");
  const order = await db.order.findUnique({ where: { id: (await params).id }, include: { items: true } });
  if (!order) notFound();
  const a = order.shippingAddress as Addr;
  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-[13px] text-black print:p-0">
      <div className="flex items-start justify-between border-b border-black pb-4">
        <div><p className="font-display text-2xl">{store.name}</p><p>Packing slip</p></div>
        <div className="text-right"><p className="text-lg font-bold">{formatOrderNumber(order.number)}</p><p>{formatDate(order.createdAt)}</p><p className="font-semibold">{order.paymentMethod === "COD" ? `COD — collect ${formatPrice(order.total)}` : "PREPAID"}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-6 py-4">
        <div><p className="font-semibold uppercase">Ship to</p><p>{a.fullName}<br />{addressLines(a).map((l) => <span key={l}>{l}<br /></span>)}Ph: {a.phone}</p></div>
        <div><p className="font-semibold uppercase">Shipping</p><p>{order.shippingMethod === "express" ? "EXPRESS" : "Standard"}<br />{order.carrier ?? ""} {order.trackingNumber ?? ""}</p></div>
      </div>
      <table className="w-full border-collapse">
        <thead><tr className="border-y border-black text-left"><th className="py-2">✓</th><th>SKU</th><th>Item</th><th>Colour / Size</th><th className="text-right">Qty</th></tr></thead>
        <tbody>{order.items.map((i) => <tr key={i.id} className="border-b border-gray-300"><td className="py-2">☐</td><td className="font-mono">{i.sku}</td><td>{i.name}</td><td>{i.color} / {i.size}</td><td className="text-right font-bold">{i.quantity}</td></tr>)}</tbody>
      </table>
      {order.customerNote && <p className="mt-4"><b>Customer note:</b> {order.customerNote}</p>}
      <p className="mt-6 text-center text-[11px]">Thank you for shopping with {store.name}! Returns within {store.returnWindowDays} days — start one at your account page.</p>
      <PrintButton />
    </div>
  );
}
