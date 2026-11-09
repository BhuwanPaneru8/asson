import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { TENDER_LABEL } from "@/lib/pos";
import { formatDateTime, formatOrderNumber, formatPrice } from "@/lib/utils";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Receipt" };

// 80 mm thermal-printer layout
export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("pos.sell");
  const order = await db.order.findUnique({ where: { id: (await params).id }, include: { items: true, tenders: true } });
  if (!order || order.channel !== "STORE") notFound();
  const cashier = order.cashierId ? await db.user.findUnique({ where: { id: order.cashierId }, select: { name: true } }) : null;
  const change = order.tenders.reduce((s, t) => s + (t.method === "CASH" && t.tendered ? t.tendered - t.amount : 0), 0);
  const addr = order.shippingAddress as { fullName?: string };
  return (
    <div className="mx-auto w-[302px] bg-white p-3 font-mono text-[12px] leading-snug text-black print:p-0">
      <div className="text-center">
        <p className="font-display text-[22px]">{store.name.toLowerCase()}.</p>
        <p>{store.storeAddress}</p>
        <p>{store.supportPhone}</p>
        {store.vatNumber && <p>VAT/PAN: {store.vatNumber}</p>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <p>Receipt: {formatOrderNumber(order.number)}</p>
      <p>Date: {formatDateTime(order.createdAt)}</p>
      <p>Cashier: {cashier?.name ?? "—"}</p>
      {addr?.fullName && addr.fullName !== "Walk-in customer" && <p>Customer: {addr.fullName}</p>}
      <div className="my-2 border-t border-dashed border-black" />
      {order.items.map((i) => (
        <div key={i.id} className="mb-1">
          <p>{i.name}</p>
          <p className="flex justify-between"><span>{i.color}/{i.size} {i.quantity} × {formatPrice(i.unitPrice)}</span><span>{formatPrice(i.unitPrice * i.quantity)}</span></p>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black" />
      <p className="flex justify-between"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></p>
      {order.discount > 0 && <p className="flex justify-between"><span>Discount</span><span>-{formatPrice(order.discount)}</span></p>}
      <p className="flex justify-between text-[14px] font-bold"><span>TOTAL</span><span>{formatPrice(order.total)}</span></p>
      <p className="text-[11px]">{store.vatLabel}</p>
      <div className="my-2 border-t border-dashed border-black" />
      {order.tenders.map((t) => (
        <p key={t.id} className="flex justify-between"><span>{TENDER_LABEL[t.method]}{t.reference ? ` (${t.reference})` : ""}</span><span>{formatPrice(t.method === "CASH" && t.tendered ? t.tendered : t.amount)}</span></p>
      ))}
      {change > 0 && <p className="flex justify-between font-bold"><span>Change</span><span>{formatPrice(change)}</span></p>}
      <div className="my-2 border-t border-dashed border-black" />
      <p className="text-center">Thank you for shopping with {store.name}!</p>
      <p className="text-center text-[11px]">Exchanges within {store.returnWindowDays} days with this receipt and tags attached.</p>
      <div className="text-center"><PrintButton /></div>
    </div>
  );
}
