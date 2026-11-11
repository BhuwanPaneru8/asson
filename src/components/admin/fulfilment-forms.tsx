"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelWaveAction, createWaveAction, finishWaveAction, lookupForPacking, packAction } from "@/actions/admin/fulfilment";
import { formatOrderNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

const input = "h-11 rounded-md border border-line bg-white px-3 text-[15px] outline-none focus:border-ink";
const btn = "h-11 rounded-md bg-ink px-5 text-[14.5px] font-medium text-white disabled:opacity-40";
const ghost = "h-11 rounded-md border border-line px-4 text-[14px] hover:border-ink disabled:opacity-40";

export function CreateWave({ storeId, waiting }: { storeId: string; waiting: number }) {
  const router = useRouter();
  const [max, setMax] = useState("20");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 p-4">
      <label className="text-[13.5px]">Up to <input className={`${input} mx-1 w-20 text-right`} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} aria-label="Orders in the wave" /> orders</label>
      <button className={btn} disabled={pending || !waiting || !Number(max)} onClick={() => start(async () => { const r = await createWaveAction(storeId, Number(max)); if (r.ok) router.push(`/admin/fulfilment/wave/${r.result}`); else toast.error(r.error); })}>{pending ? "Building…" : "Start a wave"}</button>
      <p className="w-full text-[12.5px] text-muted">Express orders first, then the oldest. Each order gets a numbered slot; one pick list walks the bins once.</p>
    </div>
  );
}

export function WaveActions({ waveId }: { waveId: string }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-wrap gap-2 print:hidden">
      <button className={btn} disabled={pending} onClick={() => start(async () => { const r = await finishWaveAction(waveId); if (r.ok) toast.success("Wave picked: on to packing"); else toast.error(r.error); })}>Everything is picked</button>
      <button className={ghost} disabled={pending} onClick={() => confirm("Cancel this wave? Its orders go back in the queue.") && start(async () => { const r = await cancelWaveAction(waveId); if (r.ok) toast.success("Cancelled"); else toast.error(r.error); })}>Cancel wave</button>
      <button className={ghost} onClick={() => window.print()}>Print</button>
    </span>
  );
}

type Expected = { sku: string; name: string; color: string; size: string; quantity: number };
type Order = { id: string; number: number; expected: Expected[]; from: string[]; unpicked: number; slot: number | null; wave: number | null; express: boolean; pickup: string | null };

/** The packing station: scan an order, then its items. Wrong or extra items are refused as they're scanned. */
export function PackingStation({ storeId, manager }: { storeId: string; manager: boolean }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [orderNo, setOrderNo] = useState("");
  const [scan, setScan] = useState("");
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [f, setF] = useState({ weight: "", box: "", override: "" });
  const [pending, start] = useTransition();
  const itemRef = useRef<HTMLInputElement>(null);
  const orderRef = useRef<HTMLInputElement>(null);
  const done = order ? order.expected.every((e) => (counts[e.sku.toUpperCase()] ?? 0) === e.quantity) : false;
  const blink = (k: "ok" | "bad") => { setFlash(k); setTimeout(() => setFlash(null), 450); };

  const load = () => start(async () => {
    const r = await lookupForPacking(orderNo);
    if (!r.ok) { toast.error(r.error); blink("bad"); return; }
    setOrder(r.order); setCounts({}); setF({ weight: "", box: "", override: "" }); setOrderNo("");
    setTimeout(() => itemRef.current?.focus(), 0);
  });
  const scanItem = () => {
    if (!order) return;
    const sku = scan.trim().toUpperCase(); setScan("");
    const e = order.expected.find((x) => x.sku.toUpperCase() === sku);
    if (!e) { blink("bad"); toast.error(`${sku} isn't in this order: put it back.`); return; }
    if ((counts[sku] ?? 0) >= e.quantity) { blink("bad"); toast.error(`Already have all ${e.quantity} of ${sku}.`); return; }
    setCounts({ ...counts, [sku]: (counts[sku] ?? 0) + 1 }); blink("ok");
  };
  const pack = (withOverride: boolean) => start(async () => {
    if (!order) return;
    const r = await packAction({ orderId: order.id, storeId, scans: Object.entries(counts).map(([sku, quantity]) => ({ sku, quantity })), weightGrams: f.weight ? Math.round(Number(f.weight)) : undefined, box: f.box || undefined, override: withOverride ? f.override : undefined });
    if (r.ok) { toast.success(`${formatOrderNumber(order.number)} packed`); setOrder(null); setCounts({}); setTimeout(() => orderRef.current?.focus(), 0); } else toast.error(r.error);
  });

  return (
    <div className={cn("space-y-4 p-4 transition-colors", flash === "ok" && "bg-success/10", flash === "bad" && "bg-danger/10")}>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (orderNo.trim()) load(); }}>
        <input ref={orderRef} autoFocus className={`${input} min-w-56 flex-1 font-mono placeholder:font-sans`} placeholder="Scan or type the order number" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} aria-label="Order number" />
        <button className={ghost} disabled={pending || !orderNo.trim()}>Open</button>
      </form>
      {order && (
        <div className="space-y-3">
          <p className="text-[15px]"><b>{formatOrderNumber(order.number)}</b>{order.slot ? <> · slot <b>{order.slot}</b> of wave W-{order.wave}</> : null}{order.express ? <span className="ml-2 rounded bg-danger/10 px-1.5 py-0.5 text-[12px] font-semibold text-danger">EXPRESS</span> : null}{order.pickup ? <span className="ml-2 text-[13px] text-muted">pickup at {order.pickup}</span> : null}</p>
          {order.from.length > 1 && <p className="rounded-md bg-[#fbf1df] px-3 py-2 text-[13px] text-warn">Its items come from {order.from.join(" and ")}: wait until everything is here.</p>}
          <form onSubmit={(e) => { e.preventDefault(); if (scan.trim()) scanItem(); }}>
            <input ref={itemRef} className={`${input} w-full font-mono placeholder:font-sans`} placeholder="Scan each item" value={scan} onChange={(e) => setScan(e.target.value)} aria-label="Scan item" />
          </form>
          <ul className="divide-y divide-line rounded-md border border-line">{order.expected.map((e) => {
            const got = counts[e.sku.toUpperCase()] ?? 0;
            return <li key={e.sku} className={cn("flex items-center justify-between gap-3 px-4 py-2.5 text-[14.5px]", got === e.quantity && "bg-success/10")}><span><span className="font-mono text-[13px]">{e.sku}</span> · {e.name} {e.color} <b>{e.size}</b></span><span className={cn("tabular-nums font-semibold", got === e.quantity ? "text-success" : "")}>{got} / {e.quantity}</span></li>;
          })}</ul>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[12.5px] text-muted">Weight (g)<input className={`${input} mt-1 block w-28 text-right`} inputMode="numeric" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value.replace(/\D/g, "") })} aria-label="Weight in grams" /></label>
            <label className="text-[12.5px] text-muted">Box<input className={`${input} mt-1 block w-32`} value={f.box} onChange={(e) => setF({ ...f, box: e.target.value })} placeholder="e.g. M box" aria-label="Box" /></label>
            <button className={btn} disabled={pending || !done} onClick={() => pack(false)}>{done ? "Pack" : "Scan every item to pack"}</button>
          </div>
          {manager && !done && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <input className={`${input} min-w-56 flex-1`} placeholder="Manager: why pack without a full scan?" value={f.override} onChange={(e) => setF({ ...f, override: e.target.value })} aria-label="Override reason" />
              <button className={ghost} disabled={pending || !f.override.trim()} onClick={() => pack(true)}>Pack anyway</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
