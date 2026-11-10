"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveBudgetsAction, suggestBudgetsAction } from "@/actions/admin/budgets";
import { cn, formatPrice } from "@/lib/utils";

const input = "h-8 w-full rounded-md border border-line bg-white px-2 text-right text-[13px] tabular-nums outline-none focus:border-ink";
const num = (v: string) => v.replace(/[^\d.]/g, "");
type Row = { storeId: string; name: string; sales: string; margin: string; costs: string };

export function BudgetEditor({ month, initial }: { month: string; initial: { storeId: string; name: string; sales: number | null; marginPct: number | null; costs: number | null }[] }) {
  const [rows, setRows] = useState<Row[]>(initial.map((r) => ({ storeId: r.storeId, name: r.name, sales: r.sales === null ? "" : String(r.sales / 100), margin: r.marginPct === null ? "" : String(r.marginPct), costs: r.costs === null ? "" : String(r.costs / 100) })));
  const [from, setFrom] = useState<"lastYear" | "lastMonth">("lastYear");
  const [uplift, setUplift] = useState("10");
  const [pending, start] = useTransition();
  const set = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: num(v) } : r)));
  const total = rows.reduce((a, r) => a + (Number(r.sales) || 0), 0);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4 text-[13.5px]">
        <span>Fill from</span>
        <select className="h-8 rounded-md border border-line bg-white px-2" value={from} onChange={(e) => setFrom(e.target.value as "lastYear")} aria-label="Fill from"><option value="lastYear">same month last year</option><option value="lastMonth">last month</option></select>
        <span>plus</span><input className={cn(input, "w-16")} value={uplift} onChange={(e) => setUplift(e.target.value.replace(/[^\d.-]/g, ""))} aria-label="Uplift percent" /><span>%</span>
        <button className="h-8 rounded-md border border-line px-3 hover:border-ink disabled:opacity-40" disabled={pending} onClick={() => start(async () => {
          const r = await suggestBudgetsAction(month, from, Number(uplift) || 0);
          if (!r.ok) { toast.error(r.error); return; }
          const by = new Map(r.rows.map((x) => [x.storeId, x]));
          setRows(rows.map((row) => { const s = by.get(row.storeId); return s ? { ...row, sales: String(Math.round(s.sales)), margin: s.marginPct === null ? row.margin : String(s.marginPct), costs: String(Math.round(s.costs)) } : row; }));
          toast.success(`Filled from ${r.base}: check, then save`);
        })}>Fill</button>
        <span className="ml-auto text-muted">Sales target total: <b className="text-ink">{formatPrice(Math.round(total * 100))}</b></span>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
        <thead className="border-b border-line bg-cloud/40 text-[11.5px] uppercase tracking-wider text-muted"><tr><th className="px-3 py-2 text-left font-medium">Location</th><th className="px-2 py-2 text-right font-medium">Sales target (Rs)</th><th className="px-2 py-2 text-right font-medium">Gross margin %</th><th className="px-2 py-2 text-right font-medium">Cost budget (Rs)</th></tr></thead>
        <tbody className="divide-y divide-line">{rows.map((r, i) => (
          <tr key={r.storeId}><td className="px-3 py-1.5 font-medium">{r.name}</td>
            <td className="w-40 px-2 py-1.5"><input className={input} value={r.sales} onChange={(e) => set(i, "sales", e.target.value)} inputMode="decimal" aria-label={`${r.name} sales target`} /></td>
            <td className="w-28 px-2 py-1.5"><input className={input} value={r.margin} onChange={(e) => set(i, "margin", e.target.value)} inputMode="decimal" aria-label={`${r.name} margin target`} /></td>
            <td className="w-40 px-2 py-1.5"><input className={input} value={r.costs} onChange={(e) => set(i, "costs", e.target.value)} inputMode="decimal" aria-label={`${r.name} cost budget`} /></td></tr>
        ))}</tbody>
      </table></div>
      <div className="flex items-center justify-between gap-3 border-t border-line p-4">
        <p className="text-[12.5px] text-muted">Sales on the P&L basis (incl. VAT, after discounts and returns). Leave a row empty for no plan; costs = staff + rent + everything else.</p>
        <button className="h-10 shrink-0 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40" disabled={pending} onClick={() => start(async () => {
          const out = rows.filter((r) => r.sales !== "" || r.costs !== "").map((r) => ({ storeId: r.storeId, sales: Number(r.sales) || 0, marginPct: r.margin === "" ? null : Number(r.margin), costs: Number(r.costs) || 0 }));
          const res = await saveBudgetsAction(month, out);
          if (res.ok) toast.success(`Saved ${out.length} plan(s) for ${month}`); else toast.error(res.error);
        })}>{pending ? "Saving…" : "Save budgets"}</button>
      </div>
    </div>
  );
}
