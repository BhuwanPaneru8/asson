"use client";

import { useState, useTransition } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { newTransfer, transferLookup } from "@/actions/admin/locations";
import { cn } from "@/lib/utils";

type Loc = { id: string; name: string };
type Hit = Awaited<ReturnType<typeof transferLookup>>[number];
type Line = Hit & { quantity: number };
const sel = "h-10 w-full rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";

export function TransferForm({ locations, defaultFrom, defaultTo }: { locations: Loc[]; defaultFrom: string; defaultTo: string }) {
  const [fromId, setFrom] = useState(defaultFrom);
  const [toId, setTo] = useState(defaultTo);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  // scanner-friendly: Enter on an exact SKU adds it straight away
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    start(async () => {
      const h = await transferLookup(q, fromId);
      if (h.length === 1 && h[0].sku.toLowerCase() === q.toLowerCase()) { add(h[0]); setQuery(""); setHits([]); return; }
      setHits(h);
      if (!h.length) toast.error("No matching products");
    });
  };
  const add = (h: Hit) => setLines((x) => (x.some((l) => l.variantId === h.variantId) ? x.map((l) => (l.variantId === h.variantId ? { ...l, quantity: l.quantity + 1 } : l)) : [...x, { ...h, quantity: 1 }]));
  const changeFrom = (id: string) => {
    setFrom(id);
    // available counts are per source; refresh them for the lines already added
    if (lines.length) start(async () => {
      const fresh = await Promise.all(lines.map((l) => transferLookup(l.sku, id)));
      setLines((x) => x.map((l, i) => ({ ...l, available: fresh[i].find((f) => f.variantId === l.variantId)?.available ?? 0 })));
    });
  };
  const submit = (sendNow: boolean) => start(async () => {
    const r = await newTransfer({ fromId, toId, note, sendNow, items: lines.filter((l) => l.quantity > 0).map((l) => ({ variantId: l.variantId, quantity: l.quantity })) });
    if (r && !r.ok) toast.error(r.error);
  });
  const over = lines.filter((l) => l.quantity > l.available);
  const units = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2">
        <label className="text-[13px] font-medium text-ink-soft">From<select className={cn(sel, "mt-1")} value={fromId} onChange={(e) => changeFrom(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label className="text-[13px] font-medium text-ink-soft">To<select className={cn(sel, "mt-1")} value={toId} onChange={(e) => setTo(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id} disabled={l.id === fromId}>{l.name}</option>)}</select></label>
      </div>

      <div className="rounded-lg border border-line bg-white">
        <form onSubmit={search} className="flex gap-2 border-b border-line p-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Scan a barcode or search by name" aria-label="Find product" className="h-10 flex-1 rounded-md border border-line px-3 text-[14px] outline-none focus:border-ink" />
          <button className="flex h-10 items-center gap-1.5 rounded-md border border-line px-3 text-[14px] hover:border-ink"><Search className="h-4 w-4" /> Find</button>
        </form>
        {hits.length > 0 && (
          <ul className="max-h-64 divide-y divide-line overflow-y-auto border-b border-line">
            {hits.map((h) => (
              <li key={h.variantId}>
                <button type="button" onClick={() => add(h)} className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-[13.5px] hover:bg-cloud/40">
                  <span><span className="font-mono text-[12px] text-muted">{h.sku}</span> {h.name} · {h.color} {h.size}</span>
                  <span className={cn("tabular-nums", h.available ? "" : "text-danger")}>{h.available} here</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="bg-cloud/40"><tr className="text-left text-[12px] uppercase tracking-wider text-muted"><th className="px-4 py-2">Item</th><th className="px-3 text-right">At source</th><th className="px-3 text-right">Send</th><th /></tr></thead>
            <tbody className="divide-y divide-line">
              {lines.map((l) => (
                <tr key={l.variantId}>
                  <td className="px-4 py-2"><span className="font-mono text-[12px] text-muted">{l.sku}</span> {l.name} · {l.color} {l.size}</td>
                  <td className={cn("px-3 text-right tabular-nums", l.quantity > l.available && "font-semibold text-danger")}>{l.available}</td>
                  <td className="px-3 text-right"><input value={l.quantity} onChange={(e) => { const q = Number(e.target.value.replace(/\D/g, "")) || 0; setLines((x) => x.map((y) => (y.variantId === l.variantId ? { ...y, quantity: q } : y))); }} inputMode="numeric" aria-label={`Quantity of ${l.sku}`} className="h-8 w-20 rounded border border-line px-2 text-right tabular-nums" /></td>
                  <td className="px-3 text-right"><button type="button" onClick={() => setLines((x) => x.filter((y) => y.variantId !== l.variantId))} aria-label={`Remove ${l.sku}`} className="p-1 text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lines.length && <p className="p-8 text-center text-[14px] text-muted">Scan or search for items to send.</p>}
        </div>
      </div>

      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for the driver or receiving shop (optional)" aria-label="Note" className="w-full rounded-md border border-line bg-white p-3 text-[14px]" />
      {over.length > 0 && <p className="text-[13.5px] text-danger">{over.length} line{over.length > 1 ? "s ask" : " asks"} for more than the source holds. You can save a draft, but it can&apos;t be sent until the count is right.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={pending || !lines.length || fromId === toId} onClick={() => submit(false)} className="h-10 rounded-md border border-line bg-white px-4 text-[14px] hover:border-ink disabled:opacity-40">Save draft</button>
        <button type="button" disabled={pending || !lines.length || fromId === toId || over.length > 0 || units === 0} onClick={() => submit(true)} className="h-10 rounded-md bg-ink px-5 text-[14px] font-medium text-white disabled:opacity-40">{pending ? "Working…" : `Send ${units} unit${units === 1 ? "" : "s"} now`}</button>
      </div>
    </div>
  );
}
