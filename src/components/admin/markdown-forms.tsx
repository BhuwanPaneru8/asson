"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addItemsAction, cancelEventAction, createEventAction, endEventAction, removeItemAction, scheduleEventAction, setItemPriceAction } from "@/actions/admin/markdowns";
import { cn } from "@/lib/utils";

const input = "h-10 rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";
const btn = "h-10 rounded-md bg-ink px-4 text-[13.5px] font-medium text-white disabled:opacity-40";
const ghost = "h-10 rounded-md border border-line bg-white px-3 text-[13.5px] hover:border-ink disabled:opacity-40";
const done = (r: { ok: boolean; error?: string }, msg: string) => { if (r.ok) toast.success(msg); else toast.error(r.error, { duration: 10_000 }); return r.ok; };

export function CreateEvent() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", startsAt: "", endsAt: "" });
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto_auto]" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await createEventAction(f); if (done(r, "Sale drafted: add products")) router.push(`/admin/markdowns/${(r as { result: string }).result}`); }); }}>
      <input className={input} placeholder="Name, e.g. Dashain sale 2083" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Sale name" />
      <label className="flex items-center gap-1.5 text-[12.5px] text-muted">From <input type="datetime-local" className={input} value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} aria-label="Starts" /></label>
      <label className="flex items-center gap-1.5 text-[12.5px] text-muted">to <input type="datetime-local" className={input} value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} aria-label="Ends" /></label>
      <button className={btn} disabled={pending || !f.name.trim() || !f.startsAt}>Draft sale</button>
      <p className="text-[12px] text-muted sm:col-span-4">Nepal time. Leave the end empty for a permanent markdown (clearance).</p>
    </form>
  );
}

/** Add products by category or search, at a % off (or a fixed sale price). */
export function AddProducts({ eventId, categories }: { eventId: string; categories: { id: string; name: string }[] }) {
  const [f, setF] = useState({ categoryId: "", query: "", off: "20", price: "", mode: "off" as "off" | "price" });
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-2 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await addItemsAction({ eventId, categoryId: f.categoryId || undefined, query: f.query || undefined, percentOff: f.mode === "off" ? Number(f.off) : null, price: f.mode === "price" ? Math.round(Number(f.price) * 100) : null });
      if (done(r, r.ok ? `${(r as { result: { added: number } }).result.added} product(s) added` : "")) setF({ ...f, query: "" });
    }); }}>
      <select className={input} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} aria-label="Category"><option value="">Any category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input className={input} placeholder="Product name or SKU (optional)" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} aria-label="Product search" />
      <span className="flex items-center gap-2">
        <select className={input} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as "off" | "price" })} aria-label="Markdown type"><option value="off">% off</option><option value="price">Sale price Rs</option></select>
        {f.mode === "off" ? <input className={cn(input, "w-20 text-right")} inputMode="numeric" value={f.off} onChange={(e) => setF({ ...f, off: e.target.value.replace(/[^\d.]/g, "") })} aria-label="Percent off" /> : <input className={cn(input, "w-28 text-right")} inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/[^\d.]/g, "") })} aria-label="Sale price" />}
      </span>
      <button className={btn} disabled={pending || (!f.categoryId && !f.query.trim())}>{pending ? "Adding…" : "Add products"}</button>
      <p className="text-[12px] text-muted sm:col-span-2">% off is taken from today&apos;s shelf price and rounded down to Rs 10. Adding a product again changes its sale price.</p>
    </form>
  );
}

export function AddSuggested({ eventId, productIds, off }: { eventId: string; productIds: string[]; off: number }) {
  const [pending, start] = useTransition();
  return <button className="text-[12.5px] underline underline-offset-4 disabled:opacity-40" disabled={pending} onClick={() => start(async () => { done(await addItemsAction({ eventId, productIds, percentOff: off }), "Added"); })}>Add at {off}% off</button>;
}

export function ItemPrice({ eventId, productId, price, editable }: { eventId: string; productId: string; price: number; editable: boolean }) {
  const [v, setV] = useState(String(price / 100));
  const [pending, start] = useTransition();
  if (!editable) return null;
  const changed = Math.round(Number(v) * 100) !== price;
  return (
    <span className="flex items-center justify-end gap-1.5">
      <input className={cn(input, "h-8 w-24 text-right")} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Sale price Rs" />
      {changed && <button className="h-8 rounded-md bg-ink px-2 text-[12px] text-white" disabled={pending} onClick={() => start(async () => { done(await setItemPriceAction(eventId, productId, Math.round(Number(v) * 100)), "Saved"); })}>Save</button>}
      <button className="text-[12px] text-muted hover:text-danger" disabled={pending} onClick={() => start(async () => { done(await removeItemAction(eventId, productId), "Removed"); })} aria-label="Remove">✕</button>
    </span>
  );
}

export function EventActions({ eventId, status, belowMin, owner }: { eventId: string; status: string; belowMin: number; owner: boolean }) {
  const [allow, setAllow] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && <>
        {belowMin > 0 && owner && <label className="flex items-center gap-1.5 text-[13px] text-danger"><input type="checkbox" checked={allow} onChange={(e) => setAllow(e.target.checked)} /> Below margin is OK ({belowMin})</label>}
        <button className={btn} disabled={pending} onClick={() => start(async () => { done(await scheduleEventAction(eventId, allow), "Scheduled: it starts by itself (or now, if the start time has come)"); })}>Schedule</button>
      </>}
      {status === "LIVE" && <button className={btn} disabled={pending} onClick={() => confirm("End the sale now? Prices go back.") && start(async () => { done(await endEventAction(eventId), "Ended: prices put back"); })}>End sale now</button>}
      {(status === "DRAFT" || status === "SCHEDULED") && <button className={ghost} disabled={pending} onClick={() => confirm("Cancel this sale?") && start(async () => { done(await cancelEventAction(eventId), "Cancelled"); })}>Cancel</button>}
    </div>
  );
}
