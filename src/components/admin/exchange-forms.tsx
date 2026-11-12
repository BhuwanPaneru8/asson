"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { lookupExchangeAction, receiveExchangeAction, staffExchangeAction } from "@/actions/admin/exchanges";
import { cn } from "@/lib/utils";

const input = "h-10 rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink placeholder:font-sans";
const btn = "h-10 rounded-md bg-ink px-4 text-[13.5px] font-medium text-white disabled:opacity-40";
type Found = { ref: string; from: string; replacement: string; replacementStatus: string; items: { id: string; label: string; quantity: number }[] };

/** Scan the old items' parcel (order or EX- number), check each item, receive. */
export function ReceiveExchange({ locations, defaultStoreId }: { locations: { id: string; name: string }[]; defaultStoreId: string }) {
  const [ref, setRef] = useState("");
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [found, setFound] = useState<Found | null>(null);
  const [cond, setCond] = useState<Record<string, "RESELLABLE" | "DAMAGED">>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 p-4">
      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await lookupExchangeAction(ref); if (r.ok) { setFound(r.exchange); setCond({}); setMsg(null); } else { setFound(null); setMsg({ ok: false, text: r.error }); } }); }}>
        <input className={cn(input, "font-mono")} placeholder="Order or EX- number" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Exchange or order number" />
        <select className={input} value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Received at">{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <button className={btn} disabled={pending || !ref.trim()}>Find</button>
      </form>
      {found && (
        <div className="rounded-md border border-line p-3 text-[13.5px]">
          <p className="font-semibold">{found.ref} · from {found.from} · new size on {found.replacement} ({found.replacementStatus.toLowerCase().replace(/_/g, " ")})</p>
          <ul className="mt-2 space-y-2">{found.items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2"><span>{i.label}{i.quantity > 1 ? ` ×${i.quantity}` : ""}</span>
              <select className={cn(input, "h-9")} value={cond[i.id] ?? "RESELLABLE"} onChange={(e) => setCond({ ...cond, [i.id]: e.target.value as "RESELLABLE" | "DAMAGED" })} aria-label={`Condition of ${i.label}`}><option value="RESELLABLE">Back on sale</option><option value="DAMAGED">Damaged: quarantine</option></select>
            </li>
          ))}</ul>
          <button className={cn(btn, "mt-3")} disabled={pending} onClick={() => start(async () => {
            const r = await receiveExchangeAction({ ref: found.ref, storeId, conditions: Object.fromEntries(found.items.map((i) => [i.id, cond[i.id] ?? "RESELLABLE"])) });
            if (r.ok) { setMsg({ ok: true, text: `${found.ref} received${r.result.damaged ? `, ${r.result.damaged} damaged (quarantined)` : ", back on sale"}` }); setFound(null); setRef(""); } else setMsg({ ok: false, text: r.error });
            if (!r.ok) toast.error(r.error);
          })}>Receive old items</button>
        </div>
      )}
      {msg && <p role="status" className={cn("rounded-md px-3 py-2 text-[13.5px]", msg.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>{msg.text}</p>}
    </div>
  );
}

type Option = { orderItemId: string; name: string; color: string; size: string; left: number; sizes: { variantId: string; size: string; stock: number }[] };

/** On the admin order page: swap sizes for a customer who called (same rules as their own order page). */
export function StaffExchange({ orderId, items }: { orderId: string; items: Option[] }) {
  const [pick, setPick] = useState<Record<string, { variantId: string; quantity: number }>>({});
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const lines = Object.entries(pick).filter(([, p]) => p.variantId).map(([orderItemId, p]) => ({ orderItemId, newVariantId: p.variantId, quantity: p.quantity }));
  return (
    <div className="space-y-3 px-5 py-4 text-[13.5px]">
      {items.filter((i) => i.left > 0).map((i) => {
        const cur = pick[i.orderItemId];
        return (
          <div key={i.orderItemId}>
            <p className="font-medium">{i.name} · {i.color} {i.size}{i.left > 1 ? ` (${i.left} can swap)` : ""}</p>
            {!i.sizes.length ? <p className="text-muted">No other size in stock.</p> : (
              <div className="mt-1 flex gap-2">
                <select className={cn(input, "min-w-0 flex-1")} value={cur?.variantId ?? ""} onChange={(e) => setPick({ ...pick, [i.orderItemId]: { variantId: e.target.value, quantity: cur?.quantity ?? 1 } })} aria-label={`New size for ${i.name} ${i.size}`}>
                  <option value="">Keep {i.size}</option>{i.sizes.map((s) => <option key={s.variantId} value={s.variantId}>{s.size} ({s.stock} in stock)</option>)}
                </select>
                {i.left > 1 && cur?.variantId && <select className={cn(input, "w-20")} value={String(cur.quantity)} onChange={(e) => setPick({ ...pick, [i.orderItemId]: { ...cur, quantity: Number(e.target.value) } })} aria-label="How many">{Array.from({ length: i.left }, (_, n) => <option key={n} value={n + 1}>×{n + 1}</option>)}</select>}
              </div>
            )}
          </div>
        );
      })}
      <input className={cn(input, "w-full")} placeholder="Why (e.g. called: too tight)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Exchange reason" />
      <button className={cn(btn, "w-full")} disabled={pending || !lines.length} onClick={() => start(async () => {
        const r = await staffExchangeAction({ orderId, lines, reason });
        if (r.ok) { toast.success(`EX-${r.result.number} created: the new size is ready to pick`); setPick({}); setReason(""); } else toast.error(r.error);
      })}>Send the new size</button>
      <p className="text-[12px] text-muted">Free, at the price paid. The rider collects the old item at the door; the customer gets an SMS.</p>
    </div>
  );
}
