"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adjustStock } from "@/actions/admin/catalog";
import { cn } from "@/lib/utils";

type V = { id: string; sku: string; stock: number; color: string; colorHex: string; size: string; productId: string; productName: string };
type Loc = { id: string; code: string; name: string };
type Col = { id: string; quantity: number; highlight: boolean };

const tone = (n: number) => (n === 0 ? "text-danger" : n <= 5 ? "text-warn" : "");

export function StockRow({ v, canAdjust, locations, adjustAt, columns }: { v: V; canAdjust: boolean; locations: Loc[]; adjustAt: string; columns: Col[] }) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("RECEIVED");
  const [at, setAt] = useState(adjustAt);
  const [pending, start] = useTransition();
  const apply = (sign: 1 | -1) => {
    const n = Number(qty);
    if (!Number.isInteger(n) || n <= 0) return toast.error("Enter a quantity");
    start(async () => {
      const r = await adjustStock(v.id, sign * n, sign > 0 ? reason : reason === "RECEIVED" ? "MANUAL_ADJUST" : reason, undefined, at);
      const where = locations.find((l) => l.id === at)?.name;
      if (r.ok) { toast.success(`${v.sku}: ${r.here} at ${where}, ${r.stock} in total`); setQty(""); } else toast.error(r.error);
    });
  };
  return (
    <tr className={pending ? "opacity-50" : "hover:bg-cloud/40"}>
      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12.5px]">{v.sku}</td>
      <td className="px-4"><Link href={`/admin/products/${v.productId}`} className="hover:underline">{v.productName}</Link></td>
      <td className="whitespace-nowrap px-4"><span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-black/10 align-middle" style={{ background: v.colorHex }} />{v.color} · {v.size}</td>
      {columns.map((c) => <td key={c.id} className={cn("px-3 text-right tabular-nums", c.highlight ? `font-semibold ${tone(c.quantity)}` : "text-muted")}>{c.quantity}</td>)}
      <td className={cn("px-4 text-right font-semibold tabular-nums", tone(v.stock))}>{v.stock}</td>
      <td className="px-4 py-2">
        {!canAdjust ? <span className="text-[12.5px] text-muted">Manager approval needed</span> : (
        <div className="flex items-center gap-1.5">
          {locations.length > 1 && (
            <select value={at} onChange={(e) => setAt(e.target.value)} aria-label={`Location for ${v.sku}`} className="h-8 rounded border border-line px-1 text-[12.5px]">
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
            </select>
          )}
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
