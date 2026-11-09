import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { code128Svg } from "@/lib/barcode";
import { addressLines, formatOrderNumber, formatPrice } from "@/lib/utils";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Shipping label" };

type Addr = { fullName?: string; phone?: string; line1?: string; line2?: string | null; city?: string; district?: string; state?: string; postalCode?: string | null };

/** 100 × 150 mm (4×6") parcel label — fits standard thermal label printers. */
export default async function ShippingLabel({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("orders");
  const order = await db.order.findUnique({ where: { id: (await params).id }, include: { items: { select: { quantity: true } } } });
  if (!order || order.channel !== "ONLINE") notFound();
  const a = order.shippingAddress as Addr;
  const number = formatOrderNumber(order.number);
  const cod = order.paymentMethod === "COD" && order.paymentStatus !== "PAID";
  return (
    <div>
      <div className="mx-auto flex h-[150mm] w-[100mm] flex-col border-2 border-black bg-white p-[4mm] font-sans text-black print:border-0">
        <div className="flex items-start justify-between border-b-2 border-black pb-[2mm]">
          <div className="text-[9pt] leading-tight"><p className="font-display text-[16pt] leading-none">{store.name.toLowerCase()}.</p><p>{store.storeAddress}</p><p>{store.supportPhone}</p></div>
          <div className="text-right text-[9pt]"><p className="font-bold">{order.shippingMethod === "express" ? "EXPRESS" : "STANDARD"}</p>{order.carrier && <p>{order.carrier}</p>}</div>
        </div>
        <div className="flex-1 py-[3mm]">
          <p className="text-[8pt] font-bold uppercase">Deliver to</p>
          <p className="text-[14pt] font-bold leading-tight">{a.fullName}</p>
          <p className="text-[13pt] font-semibold">{a.phone ?? order.phone}</p>
          <div className="mt-[1mm] text-[11pt] leading-snug">{addressLines(a).map((l) => <p key={l}>{l}</p>)}</div>
          {a.district && <p className="mt-[2mm] inline-block bg-black px-[2mm] py-[0.5mm] text-[14pt] font-bold uppercase text-white">{a.district}</p>}
        </div>
        <div className={`mb-[3mm] border-2 border-black p-[2mm] text-center ${cod ? "" : "border-dashed"}`}>
          {cod ? <><p className="text-[9pt] font-bold uppercase">Cash on delivery — collect</p><p className="text-[22pt] font-bold leading-none">{formatPrice(order.total)}</p></> : <p className="text-[13pt] font-bold uppercase">Prepaid — do not collect</p>}
        </div>
        <div className="h-[16mm] [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: code128Svg(number) }} />
        <div className="mt-[1mm] flex justify-between text-[9pt]"><span className="font-mono font-bold">{number}</span><span>{order.items.reduce((s, i) => s + i.quantity, 0)} item(s){order.trackingNumber ? ` · AWB ${order.trackingNumber}` : ""}</span></div>
      </div>
      <div className="text-center"><PrintButton /></div>
    </div>
  );
}
