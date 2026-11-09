"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adjustStock } from "@/actions/admin/catalog";

type V = { id: string; sku: string; stock: number; color: string; colorHex: string; size: string; productId: string; productName: string };

export function StockRow({ v, canAdjust }: { v: V; canAdjust: boolean }) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("RECEIVED");
  const [pending, start] = useTransition();
  const apply = (sign: 1 | -1) => {
    const n = Number(qty);
    if (!Number.isInteger(n) || n <= 0) return toast.error("Enter a quantity");
    start(async () => {
      const r = await adjustStock(v.id, sign * n, sign > 0 ? reason : reason === "RECEIVED" ? "MANUAL_ADJUST" : reason);
      if (r.ok) { toast.success(`${v.sku}: stock now ${r.stock}`); setQty(""); } else toast.error(r.error);
    });
  };
  return (
    <tr className={pending ? "opacity-50" : "hover:bg-cloud/40"}>
      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12.5px]">{v.sku}</td>
      <td className="px-4"><Link href={`/admin/products/${v.productId}`} className="hover:underline">{v.productName}</Link></td>
      <td className="whitespace-nowrap px-4"><span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-black/10 align-middle" style={{ background: v.colorHex }} />{v.color} · {v.size}</td>
      <td className={`px-4 text-right font-semibold tabular-nums ${v.stock === 0 ? "text-danger" : v.stock <= 5 ? "text-warn" : ""}`}>{v.stock}</td>
      <td className="px-4 py-2">
        {!canAdjust ? <span className="text-[12.5px] text-muted">Manager approval needed</span> : (
        <div className="flex items-center gap-1.5">
          <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Qty" aria-label={`Quantity for ${v.sku}`} className="h-8 w-16 rounded border border-line px-2 text-[13px]" />
          <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" className="h-8 rounded border border-line px-1 text-[12.5px]">
            <option value="RECEIVED">Received</option><option value="MANUAL_ADJUST">Count correction</option><option value="DAMAGED">Damaged</option><option value="RETURN_RESTOCK">Return restock</option>
          </select>
          <button disabled={pending} onClick={() => apply(1)} className="h-8 rounded border border-line px-2.5 text-[13px] hover:border-ink" aria-label="Add stock">+ Add</button>
          <button disabled={pending} onClick={() => apply(-1)} className="h-8 rounded border border-line px-2.5 text-[13px] hover:border-ink" aria-label="Remove stock">− Remove</button>
        </div>
        )}
      </td>
    </tr>
  );
}
