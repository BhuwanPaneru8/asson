"use client";

import { useState, useTransition } from "react";
import { createPurchaseOrder, type ReorderSuggestion } from "@/actions/admin/purchasing";
import { formatPrice } from "@/lib/utils";
import { Card } from "./ui";

export function NewPurchaseOrder({ suppliers, suggestions }: { suppliers: { id: string; name: string }[]; suggestions: ReorderSuggestion[] }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [pending, start] = useTransition();
  const create = () => start(async () => {
    await createPurchaseOrder(supplierId, Object.entries(picked).filter(([, q]) => q > 0).map(([variantId, quantity]) => ({ variantId, quantity })));
  });
  const n = Object.values(picked).filter((q) => q > 0).length;
  return (
    <Card title="New purchase order">
      <div className="space-y-3 p-4">
        {suppliers.length === 0 ? <p className="text-[13.5px] text-muted">Add a supplier first.</p> : (
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} aria-label="Supplier" className="h-10 w-full rounded-md border border-line bg-white px-2 text-[14px]">{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        )}
        <div>
          <p className="mb-1.5 text-[13px] font-medium">Reorder suggestions <span className="font-normal text-muted">— running out within your lead time by sales speed, sized for lead time + 45 days</span></p>
          <div className="max-h-[420px] divide-y divide-line overflow-y-auto rounded-md border border-line">
            {suggestions.length === 0 && <p className="p-4 text-[13px] text-muted">Nothing needs reordering right now.</p>}
            {suggestions.map((s) => (
              <label key={s.variantId} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                <input type="checkbox" className="accent-ink" checked={(picked[s.variantId] ?? 0) > 0} onChange={(e) => setPicked((p) => ({ ...p, [s.variantId]: e.target.checked ? s.suggested : 0 }))} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{s.name}</span><span className="text-muted">{s.color} · {s.size} · {s.stock} left · {s.sold30} sold/30d{s.supplierName ? ` · last from ${s.supplierName}` : ""}{s.cost != null ? ` · ${formatPrice(s.cost)}` : ""}</span></span>
                <input value={picked[s.variantId] || s.suggested} onChange={(e) => setPicked((p) => ({ ...p, [s.variantId]: Number(e.target.value.replace(/\D/g, "")) || 0 }))} inputMode="numeric" aria-label={`Quantity for ${s.sku}`} className="h-8 w-14 rounded border border-line px-1.5 text-right tabular-nums" />
              </label>
            ))}
          </div>
        </div>
        <button onClick={create} disabled={!supplierId || pending} className="h-10 w-full rounded-md bg-ink text-[14px] font-medium text-white disabled:opacity-40">{pending ? "Creating…" : n ? `Create draft with ${n} item${n > 1 ? "s" : ""}` : "Create empty draft"}</button>
      </div>
    </Card>
  );
}
