"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordCreditAction, takeOutAction } from "@/actions/admin/damage";
import { cn } from "@/lib/utils";

const input = "h-9 rounded-md border border-line bg-white px-2 text-[13.5px] outline-none focus:border-ink";
const btn = "h-9 rounded-md bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-40";

/** For one damaged size at a location: repaired, written off, or back to the supplier. */
export function TakeOut({ storeId, variantId, units, unitCost, suppliers }: { storeId: string; variantId: string; units: number; unitCost: number | null; suppliers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "REPAIRED" as "REPAIRED" | "WRITTEN_OFF" | "TO_SUPPLIER", qty: String(units), note: "", supplierId: "", credit: "" });
  const [pending, start] = useTransition();
  if (!open) return <button className="text-[12.5px] text-muted underline underline-offset-4 hover:text-ink" onClick={() => setOpen(true)}>Deal with it</button>;
  const qty = Number(f.qty) || 0;
  return (
    <div className="mt-2 grid gap-2 text-left sm:grid-cols-2">
      <select className={input} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })} aria-label="What happened">
        <option value="REPAIRED">Repaired: back on sale</option><option value="TO_SUPPLIER">Back to the supplier</option><option value="WRITTEN_OFF">Write off</option>
      </select>
      <input className={input} inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value.replace(/\D/g, "") })} aria-label="How many" />
      {f.kind === "TO_SUPPLIER" && <>
        <select className={input} value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })} aria-label="Supplier"><option value="">Choose the supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input className={input} inputMode="decimal" placeholder={`Credit expected, Rs (${unitCost != null ? Math.round((unitCost * qty) / 100) : "cost unknown"})`} value={f.credit} onChange={(e) => setF({ ...f, credit: e.target.value.replace(/[^\d.]/g, "") })} aria-label="Credit expected" />
      </>}
      <input className={cn(input, "sm:col-span-2")} placeholder={f.kind === "WRITTEN_OFF" ? "What happened to them (required)" : "Note (optional)"} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} aria-label="Damage note" />
      <span className="flex gap-2 sm:col-span-2">
        <button className={btn} disabled={pending || !qty} onClick={() => start(async () => {
          const r = await takeOutAction({ storeId, variantId, quantity: qty, kind: f.kind, note: f.note, supplierId: f.supplierId || null, creditExpected: f.credit ? Math.round(Number(f.credit) * 100) : null });
          if (r.ok) { toast.success("Done"); setOpen(false); } else toast.error(r.error);
        })}>Save</button>
        <button className="h-9 rounded-md border border-line px-3 text-[13px]" onClick={() => setOpen(false)}>Close</button>
      </span>
    </div>
  );
}

export function RecordCredit({ entryId, expected }: { entryId: string; expected: number }) {
  const [v, setV] = useState(String(expected / 100));
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-1.5">
      <input className={cn(input, "w-24 text-right")} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Credit received Rs" />
      <button className={btn} disabled={pending} onClick={() => start(async () => { const r = await recordCreditAction(entryId, Math.round(Number(v) * 100)); if (r.ok) toast.success("Credit recorded"); else toast.error(r.error); })}>Received</button>
    </span>
  );
}
