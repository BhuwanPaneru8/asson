"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { store } from "@/lib/config";
import { formatPrice } from "@/lib/utils";

type Row = { id: string; sku: string; name: string; color: string; size: string; price: number; qty: number; svg: string };

/** 50 × 30 mm price labels with a Code 128 barcode of the SKU — works with label rolls or A4 sticker sheets. */
export function LabelSheet({ title, rows }: { title: string; rows: Row[] }) {
  const [qty, setQty] = useState<Record<string, number>>(Object.fromEntries(rows.map((r) => [r.id, r.qty])));
  const labels = rows.flatMap((r) => Array.from({ length: Math.max(0, qty[r.id] ?? 0) }, (_, i) => ({ ...r, key: `${r.id}-${i}` })));
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div><h1 className="text-[24px] font-semibold">{title}</h1><p className="text-[14px] text-muted">{labels.length} labels · 50 × 30 mm. Quantities default to units in stock (or received).</p></div>
        <button onClick={() => window.print()} disabled={!labels.length} className="flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-[14px] text-white disabled:opacity-40"><Printer className="h-4 w-4" /> Print {labels.length} labels</button>
      </div>
      {rows.length === 0 ? <p className="text-muted print:hidden">Open this page from a product or purchase order.</p> : (
        <table className="mb-8 w-full max-w-2xl rounded-lg border border-line bg-white text-[13.5px] print:hidden">
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}><td className="px-4 py-2">{r.color} · {r.size} <span className="font-mono text-[12px] text-muted">{r.sku}</span></td>
                <td className="px-4 py-2 text-right"><input value={qty[r.id] ?? 0} onChange={(e) => setQty((q) => ({ ...q, [r.id]: Math.min(500, Number(e.target.value.replace(/\D/g, "")) || 0) }))} inputMode="numeric" aria-label={`Labels for ${r.sku}`} className="h-8 w-20 rounded border border-line px-2 text-right tabular-nums" /></td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex flex-wrap gap-2 print:gap-0">
        {labels.map((l) => (
          <div key={l.key} className="flex h-[30mm] w-[50mm] flex-col justify-between overflow-hidden border border-dashed border-line bg-white px-[2mm] py-[1.5mm] text-black print:break-inside-avoid print:border-0">
            <div className="flex items-baseline justify-between gap-1 text-[7pt] leading-tight">
              <span className="truncate font-semibold">{store.name.toUpperCase()} · {l.name}</span>
            </div>
            <div className="flex items-baseline justify-between text-[7pt] leading-tight"><span>{l.color} / {l.size}</span><b className="text-[9pt]">{formatPrice(l.price)}</b></div>
            <div className="h-[11mm] w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: l.svg }} />
            <p className="text-center font-mono text-[6.5pt] leading-none">{l.sku}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
