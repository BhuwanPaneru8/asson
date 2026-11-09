"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveDeliveryRates } from "@/actions/admin/delivery";
import { PROVINCES } from "@/lib/config";
import type { DeliveryRate } from "@/lib/delivery-shared";
import { cn, formatPrice } from "@/lib/utils";
import { Card } from "./ui";

type Row = DeliveryRate;
const num = "h-8 w-20 rounded border border-line bg-white px-2 text-right text-[13px] tabular-nums outline-none focus:border-ink";

export function DeliveryRatesEditor({ initial, stats }: { initial: Row[]; stats: Record<string, { orders: number; revenue: number }> }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [province, setProvince] = useState<string>("All");
  const [q, setQ] = useState("");
  const [bulkFee, setBulkFee] = useState("");
  const [pending, start] = useTransition();

  const original = useMemo(() => Object.fromEntries(initial.map((r) => [r.district, JSON.stringify(r)])), [initial]);
  const dirty = rows.filter((r) => original[r.district] !== JSON.stringify(r));
  const visible = rows
    .filter((r) => (province === "All" || r.province === province) && r.district.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.province.localeCompare(b.province) || a.district.localeCompare(b.district));

  const upd = (district: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.district === district ? { ...r, ...patch } : r)));
  const applyFee = () => {
    const n = Math.round(Number(bulkFee) * 100);
    if (!Number.isFinite(n) || n < 0) return toast.error("Enter a fee in rupees");
    const names = new Set(visible.map((r) => r.district));
    setRows((rs) => rs.map((r) => (names.has(r.district) ? { ...r, fee: n } : r)));
    toast(`Fee set to ${formatPrice(n)} for ${names.size} districts — review and save.`);
  };
  const save = () => start(async () => {
    const res = await saveDeliveryRates(dirty.map(({ district, fee, etaMinDays, etaMaxDays, expressAvailable, codAvailable, serviceable }) => ({ district, fee, etaMinDays, etaMaxDays, expressAvailable, codAvailable, serviceable })));
    if (res.ok) toast.success(`Saved ${res.saved} district${res.saved === 1 ? "" : "s"}. Prices update for customers immediately.`);
    else toast.error(res.error);
  });

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <select value={province} onChange={(e) => setProvince(e.target.value)} aria-label="Province" className="h-9 rounded-md border border-line bg-white px-2 text-[13.5px]">
          <option>All</option>{PROVINCES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search district" aria-label="Search district" className="h-9 w-44 rounded-md border border-line bg-white px-3 text-[13.5px] outline-none focus:border-ink" />
        <div className="ml-auto flex items-center gap-2">
          <input value={bulkFee} onChange={(e) => setBulkFee(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Fee (Rs)" aria-label="Fee for all shown districts" className="h-9 w-24 rounded-md border border-line bg-white px-2 text-[13.5px]" />
          <button onClick={applyFee} className="h-9 rounded-md border border-line bg-white px-3 text-[13.5px] hover:border-ink">Apply to {visible.length} shown</button>
        </div>
      </div>
      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full text-[13.5px]">
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_var(--color-line)]">
            <tr className="text-left text-[11.5px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2.5">District</th><th className="px-2">Fee (Rs)</th><th className="px-2">Days (min–max)</th>
              <th className="px-2 text-center">Express</th><th className="px-2 text-center">COD</th><th className="px-2 text-center">Deliver</th>
              <th className="px-4 text-right">Orders · 90d</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => {
              const changed = original[r.district] !== JSON.stringify(r);
              const s = stats[r.district];
              return (
                <tr key={r.district} className={cn(changed && "bg-accent-soft/50", !r.serviceable && "text-muted")}>
                  <td className="px-4 py-1.5"><p className="font-medium text-ink">{r.district}</p><p className="text-[12px] text-muted">{r.province}</p></td>
                  <td className="px-2"><input className={num} inputMode="numeric" aria-label={`Fee for ${r.district}`} value={r.fee / 100} onChange={(e) => upd(r.district, { fee: Math.round((Number(e.target.value.replace(/[^\d.]/g, "")) || 0) * 100) })} /></td>
                  <td className="px-2 whitespace-nowrap">
                    <input className={cn(num, "w-12")} inputMode="numeric" aria-label={`Minimum days for ${r.district}`} value={r.etaMinDays} onChange={(e) => upd(r.district, { etaMinDays: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                    <span className="px-1 text-muted">–</span>
                    <input className={cn(num, "w-12", r.etaMaxDays < r.etaMinDays && "border-danger")} inputMode="numeric" aria-label={`Maximum days for ${r.district}`} value={r.etaMaxDays} onChange={(e) => upd(r.district, { etaMaxDays: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                  </td>
                  {(["expressAvailable", "codAvailable", "serviceable"] as const).map((k) => (
                    <td key={k} className="px-2 text-center"><input type="checkbox" className="h-4 w-4 accent-ink" aria-label={`${k} for ${r.district}`} checked={r[k]} onChange={(e) => upd(r.district, { [k]: e.target.checked })} /></td>
                  ))}
                  <td className="px-4 text-right tabular-nums">{s ? <>{s.orders}<p className="text-[12px] text-muted">{formatPrice(s.revenue)}</p></> : <span className="text-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-3">
        <p className="text-[13px] text-muted">{dirty.length ? `${dirty.length} unsaved change${dirty.length > 1 ? "s" : ""}` : "All changes saved"}</p>
        <div className="flex gap-2">
          {dirty.length > 0 && <button onClick={() => setRows(initial)} className="rounded-md px-3 py-2 text-[13.5px] hover:bg-cloud">Discard</button>}
          <button onClick={save} disabled={!dirty.length || pending} className="rounded-md bg-ink px-4 py-2 text-[13.5px] font-medium text-white disabled:opacity-40">{pending ? "Saving…" : "Save rates"}</button>
        </div>
      </div>
    </Card>
  );
}
