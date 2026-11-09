import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { REFUND_LABEL } from "@/lib/pos";
import { formatDateTime, formatOrderNumber, formatPrice } from "@/lib/utils";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Return slip" };

export default async function ReturnSlip({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("pos.sell");
  const ret = await db.return.findUnique({ where: { id: (await params).id }, include: { order: { select: { number: true } }, items: { include: { orderItem: true } } } });
  if (!ret) notFound();
  const people = await db.user.findMany({ where: { id: { in: [ret.processedById, ret.approvedById ?? ""] } }, select: { id: true, name: true } });
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.name ?? "—";
  return (
    <div className="mx-auto w-[302px] bg-white p-3 font-mono text-[12px] leading-snug text-black print:p-0">
      <div className="text-center"><p className="font-display text-[22px]">{store.name.toLowerCase()}.</p><p>{store.storeAddress}</p><p className="mt-1 font-bold">RETURN / CREDIT NOTE</p></div>
      <div className="my-2 border-t border-dashed border-black" />
      <p>Return: R{String(ret.number).padStart(5, "0")}</p>
      <p>Original: {formatOrderNumber(ret.order.number)}</p>
      <p>Date: {formatDateTime(ret.createdAt)}</p>
      <p>Processed: {nameOf(ret.processedById)}</p>
      <p>Approved: {nameOf(ret.approvedById)}</p>
      <p>Reason: {ret.reason}</p>
      <div className="my-2 border-t border-dashed border-black" />
      {ret.items.map((i) => (
        <div key={i.id} className="mb-1"><p>{i.orderItem.name}</p><p className="flex justify-between"><span>{i.orderItem.color}/{i.orderItem.size} ×{i.quantity} {i.condition === "DAMAGED" ? "(damaged)" : ""}</span><span>{formatPrice(i.amount)}</span></p></div>
      ))}
      <div className="my-2 border-t border-dashed border-black" />
      <p className="flex justify-between text-[14px] font-bold"><span>REFUND</span><span>{formatPrice(ret.refundAmount)}</span></p>
      <p>Via: {REFUND_LABEL[ret.refundMethod]}{ret.reference ? ` (${ret.reference})` : ""}</p>
      {ret.voucherCode && <p className="mt-2 border border-black p-2 text-center text-[14px] font-bold">CREDIT CODE<br />{ret.voucherCode}<br /><span className="text-[11px] font-normal">Valid 1 year · in store & online</span></p>}
      <div className="mt-3 text-center"><PrintButton /></div>
    </div>
  );
}
