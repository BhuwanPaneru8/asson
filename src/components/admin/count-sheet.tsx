"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { ScanBarcode, X } from "lucide-react";
import { toast } from "sonner";
import { cancelStockCount, scanForCount, setCountLine, submitStockCount } from "@/actions/admin/counts";
import { cn } from "@/lib/utils";

type Line = { variantId: string; sku: string; name: string; color: string; size: string; counted: number | null };
type Filter = "todo" | "done" | "all";

/** Blind counting screen: no system figures here, only what the counter finds. */
export function CountSheet({ countId, lines: initial }: { countId: string; lines: Line[] }) {
  const [lines, setLines] = useState(initial);
  const [code, setCode] = useState("");
  const [last, setLast] = useState<{ label: string; sku: string; counted: number } | null>(null);
  const [filter, setFilter] = useState<Filter>("todo");
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);

  const done = lines.filter((l) => l.counted != null).length;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lines.filter((l) => (filter === "all" || (filter === "done") === (l.counted != null)) && (!needle || `${l.sku} ${l.name} ${l.color} ${l.size}`.toLowerCase().includes(needle)));
  }, [lines, filter, q]);

  const update = (variantId: string, counted: number | null, extra?: Partial<Line>) =>
    setLines((x) => (x.some((l) => l.variantId === variantId) ? x.map((l) => (l.variantId === variantId ? { ...l, counted } : l)) : [{ variantId, sku: "", name: "", color: "", size: "", ...extra, counted }, ...x]));

  // Never disable the scan form's only submit button: browsers then ignore Enter and drop fast scans.
  const scan = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setCode("");
    start(async () => {
      const r = await scanForCount(countId, c);
      if (!r.ok) { toast.error(r.error); return; }
      update(r.variantId, r.counted, { sku: r.sku, name: r.name, color: r.color, size: r.size });
      setLast({ label: `${r.name} · ${r.color} ${r.size}`, sku: r.sku, counted: r.counted });
    });
    scanRef.current?.focus();
  };

  const save = (l: Line, raw: string) => {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value === l.counted) return;
    if (value != null && (!Number.isInteger(value) || value < 0)) return void toast.error("Enter a whole number");
    start(async () => {
      const r = await setCountLine(countId, l.variantId, value);
      if (r.ok) update(l.variantId, r.counted); else toast.error(r.error);
    });
  };

  const submit = () => {
    const left = lines.length - done;
    if (!confirm(left ? `${left} item${left > 1 ? "s were" : " was"} not counted and will stay as they are. Submit for approval?` : "Submit this count for approval?")) return;
    start(async () => { const r = await submitStockCount(countId); if (r.ok) toast.success("Submitted. A manager will review the differences."); else toast.error(r.error); });
  };
  const cancel = () => {
    const why = prompt("Why cancel this count? Nothing will change.");
    if (why) start(async () => { const r = await cancelStockCount(countId, why); if (r.ok) toast.success("Count cancelled"); else toast.error(r.error); });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={scan} className="rounded-lg border border-line bg-white p-4">
        <label htmlFor="scan" className="mb-2 flex items-center gap-2 text-[14px] font-medium"><ScanBarcode className="h-4 w-4" /> Scan each item (or type its SKU and press Enter)</label>
        <div className="flex gap-2">
          <input id="scan" ref={scanRef} autoFocus value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder="AS-01234" className="h-12 flex-1 rounded-md border border-line px-3 font-mono text-[17px] uppercase outline-none focus:border-ink" />
          <button className="h-12 rounded-md bg-ink px-5 text-[15px] font-medium text-white">Add</button>
        </div>
        <p className="mt-2 min-h-5 text-[14px]" aria-live="polite">{last ? <>Counted <b>{last.counted}</b> × {last.label} <span className="font-mono text-[12px] text-muted">{last.sku}</span></> : <span className="text-muted">Each scan adds one. Type a number below for items counted by hand.</span>}</p>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-[14px]"><b>{done}</b> of {lines.length} items counted</p>
        {(["todo", "done", "all"] as const).map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-md px-3 py-1.5 text-[13px]", filter === f ? "bg-ink text-white" : "border border-line bg-white")}>{f === "todo" ? "Not counted" : f === "done" ? "Counted" : "All"}</button>)}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Filter items" className="h-9 w-40 rounded-md border border-line bg-white px-3 text-[13.5px]" />
      </div>

      <ul className={cn("divide-y divide-line rounded-lg border border-line bg-white", pending && "opacity-80")}>
        {shown.slice(0, 300).map((l) => (
          <li key={l.variantId} className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
            <div className="min-w-0 flex-1"><p className="truncate">{l.name} · {l.color} <b>{l.size}</b></p><p className="font-mono text-[11.5px] text-muted">{l.sku}</p></div>
            <input key={`${l.variantId}-${l.counted}`} defaultValue={l.counted ?? ""} onBlur={(e) => save(l, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} inputMode="numeric" placeholder="—" aria-label={`Counted ${l.sku}`} className="h-10 w-20 rounded-md border border-line px-2 text-right text-[15px] tabular-nums" />
            {l.counted != null && <button type="button" onClick={() => save(l, "")} aria-label={`Clear ${l.sku}`} className="p-1 text-muted hover:text-danger"><X className="h-4 w-4" /></button>}
          </li>
        ))}
        {!shown.length && <li className="p-8 text-center text-[14px] text-muted">{filter === "todo" ? "Everything here is counted." : "Nothing matches."}</li>}
        {shown.length > 300 && <li className="p-3 text-center text-[13px] text-muted">Showing 300 of {shown.length}. Use the filter or scan to find the rest.</li>}
      </ul>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={cancel} disabled={pending} className="h-11 rounded-md px-4 text-[14px] text-muted hover:bg-cloud hover:text-danger">Cancel count</button>
        <button type="button" onClick={submit} disabled={pending || !done} className="h-11 rounded-md bg-ink px-6 text-[15px] font-medium text-white disabled:opacity-40">Submit for approval</button>
      </div>
    </div>
  );
}
