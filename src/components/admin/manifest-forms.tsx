"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addParcelAction, cancelManifestAction, handOverAction, openManifestAction, removeParcelAction } from "@/actions/admin/manifests";
import { CARRIERS } from "@/lib/carriers";
import { cn, formatOrderNumber, formatPrice } from "@/lib/utils";

const input = "h-11 rounded-md border border-line bg-white px-3 text-[15px] outline-none focus:border-ink placeholder:font-sans";
const btn = "h-11 rounded-md bg-ink px-5 text-[14.5px] font-medium text-white disabled:opacity-40";
const ghost = "h-11 rounded-md border border-line px-4 text-[14px] hover:border-ink disabled:opacity-40";

export function OpenManifest({ storeId, ready }: { storeId: string; ready: number }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState<string>(CARRIERS[1]);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 p-4">
      <select className={input} value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Courier">{CARRIERS.map((c) => <option key={c}>{c}</option>)}</select>
      <button className={btn} disabled={pending} onClick={() => start(async () => { const r = await openManifestAction(storeId, carrier); if (r.ok) router.push(`/admin/fulfilment/manifest/${r.result}`); else toast.error(r.error); })}>{pending ? "Opening…" : "Scan parcels for this courier"}</button>
      <p className="w-full text-[12.5px] text-muted">{ready} packed parcel{ready === 1 ? "" : "s"} waiting for a courier. Each courier has one open manifest here; scanning continues it.</p>
    </div>
  );
}

export function ScanParcel({ manifestId, carrier }: { manifestId: string; carrier: string }) {
  const [order, setOrder] = useState("");
  const [tracking, setTracking] = useState("");
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const orderRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<HTMLInputElement>(null);
  const submit = () => start(async () => {
    const r = await addParcelAction({ manifestId, order, trackingNumber: tracking || undefined });
    if (r.ok) { setLast({ ok: true, text: `${formatOrderNumber(r.result.orderNumber)} · ${r.result.trackingNumber}${r.result.cod ? ` · COD ${formatPrice(r.result.cod)}` : " · prepaid"}` }); setOrder(""); setTracking(""); orderRef.current?.focus(); }
    else { setLast({ ok: false, text: r.error }); toast.error(r.error); }
  });
  return (
    <form className="space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); if (order.trim()) submit(); }}>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input ref={orderRef} autoFocus className={cn(input, "font-mono")} placeholder="Order number (scan the slip)" value={order} onChange={(e) => setOrder(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && order.trim()) { e.preventDefault(); trackRef.current?.focus(); } }} aria-label="Order number" />
        <input ref={trackRef} className={cn(input, "font-mono uppercase placeholder:normal-case")} placeholder={`${carrier} tracking number`} value={tracking} onChange={(e) => setTracking(e.target.value)} aria-label="Tracking number" />
        <button className={btn} disabled={pending || !order.trim()}>{pending ? "Adding…" : "Add parcel"}</button>
      </div>
      <p className="text-[12.5px] text-muted">Leave the tracking number empty if it&apos;s already on the order.</p>
      {last && <p role="status" className={cn("rounded-md px-3 py-2 text-[13.5px]", last.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>{last.ok ? `Added: ${last.text}` : last.text}</p>}
    </form>
  );
}

export function RemoveParcel({ manifestId, orderId }: { manifestId: string; orderId: string }) {
  const [pending, start] = useTransition();
  return <button className="text-[12.5px] text-muted underline underline-offset-4 hover:text-danger disabled:opacity-40 print:hidden" disabled={pending} onClick={() => start(async () => { const r = await removeParcelAction(manifestId, orderId); if (!r.ok) toast.error(r.error); })}>Remove</button>;
}

export function HandOver({ manifestId, parcels, cod }: { manifestId: string; parcels: number; cod: number }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", phone: "", count: "" });
  const [pending, start] = useTransition();
  return (
    <form className="space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await handOverAction({ manifestId, riderName: f.name, riderPhone: f.phone || undefined, parcels: Number(f.count) });
      if (r.ok) { toast.success(`${r.result.parcels} parcel(s) shipped`); router.refresh(); } else toast.error(r.error);
    }); }}>
      <input className={cn(input, "w-full")} placeholder="Rider's name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Rider's name" />
      <input className={cn(input, "w-full")} placeholder="Rider's phone (optional)" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} aria-label="Rider's phone" />
      <input className={cn(input, "w-full")} placeholder="Parcels the rider counted" inputMode="numeric" value={f.count} onChange={(e) => setF({ ...f, count: e.target.value.replace(/\D/g, "") })} aria-label="Parcels counted" />
      <button className={cn(btn, "w-full")} disabled={pending || !parcels || !f.name.trim() || !f.count}>{pending ? "Shipping…" : `Hand over ${parcels} parcel${parcels === 1 ? "" : "s"}`}</button>
      <p className="text-[12.5px] text-muted">The rider counts the parcels; the count must match. Every order moves to Shipped and customers get their tracking number.{cod ? ` The rider collects ${formatPrice(cod)} cash on delivery.` : ""}</p>
    </form>
  );
}

export function ManifestTools({ manifestId, open }: { manifestId: string; open: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-wrap gap-2 print:hidden">
      <button className={ghost} onClick={() => window.print()}>Print</button>
      {open && <button className={ghost} disabled={pending} onClick={() => confirm("Cancel this manifest? Its parcels go back to ready to ship.") && start(async () => { const r = await cancelManifestAction(manifestId); if (r.ok) { toast.success("Cancelled"); router.push("/admin/fulfilment"); } else toast.error(r.error); })}>Cancel manifest</button>}
    </span>
  );
}
