"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { DeliveryFailReason } from "@prisma/client";
import { receiveReturnAction, recordAttemptAction, reportLostAction, startReturnAction } from "@/actions/admin/deliveries";
import { cn, formatOrderNumber, formatPrice } from "@/lib/utils";

const input = "h-10 rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink placeholder:font-sans";
const btn = "h-10 rounded-md bg-ink px-4 text-[13.5px] font-medium text-white disabled:opacity-40";
const ghost = "h-10 rounded-md border border-line px-3 text-[13.5px] hover:border-ink disabled:opacity-40";

type Reason = { value: DeliveryFailReason; label: string };

/** Record a failed attempt, bring the parcel back, or report it lost. */
function ParcelPanel({ orderId, reasons, lostOnly = false }: { orderId: string; reasons: Reason[]; lostOnly?: boolean }) {
  const [reason, setReason] = useState<DeliveryFailReason>(reasons[0].value);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const done = (r: { ok: boolean; error?: string }, msg: string) => { if (r.ok) { toast.success(msg); setNote(""); } else toast.error(r.error); };
  return (
    <div className="flex flex-col gap-2 text-left sm:flex-row sm:flex-wrap sm:items-center">
      {!lostOnly && <select className={input} value={reason} onChange={(e) => setReason(e.target.value as DeliveryFailReason)} aria-label="What happened">{reasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>}
      <input className={cn(input, "sm:min-w-[220px] sm:flex-1")} placeholder={lostOnly ? "The courier's reference for the lost parcel" : "Note (for lost: the courier's reference)"} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
      <div className="flex flex-wrap gap-2">
        {!lostOnly && <button className={btn} disabled={pending} onClick={() => start(async () => done(await recordAttemptAction({ orderId, reason, note }), "Attempt recorded; customer asked to call"))}>Failed attempt</button>}
        {!lostOnly && <button className={ghost} disabled={pending} onClick={() => confirm("Stop delivering? The courier brings it back.") && start(async () => done(await startReturnAction({ orderId, reason, note }), "Coming back to us"))}>Return to us</button>}
        <button className={cn(ghost, "text-danger")} disabled={pending} onClick={() => confirm("The courier lost this parcel? The order is closed and its value claimed from them.") && start(async () => done(await reportLostAction(orderId, note), "Recorded as lost"))}>Lost</button>
      </div>
    </div>
  );
}

/** For a parcel already coming back: only "lost" applies. Opens below the item, full width. */
export function ParcelActions({ orderId, reasons }: { orderId: string; reasons: Reason[] }) {
  return (
    <details className="print:hidden">
      <summary className="cursor-pointer list-none text-[12.5px] text-muted underline underline-offset-4 hover:text-ink">Lost?</summary>
      <div className="mt-2"><ParcelPanel orderId={orderId} reasons={reasons} lostOnly /></div>
    </details>
  );
}

export type ParcelRow = { id: string; number: number; status: string; carrier: string | null; trackingNumber: string | null; name: string; district: string; cod: number; days: number | null; stuck: boolean; attempts: number; lastReason: string | null };

/** Parcels with couriers; "Update" opens the actions in a full-width row under the parcel. */
export function ParcelTable({ rows, reasons }: { rows: ParcelRow[]; reasons: Reason[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead className="border-b border-line bg-cloud/40 text-left text-[11.5px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-2">Order</th><th className="px-3">Courier</th><th className="px-3">To</th><th className="px-3 text-right">COD</th><th className="px-3 text-right">Days</th><th className="px-3">Attempts</th><th className="px-4" /></tr></thead>
        <tbody className="divide-y divide-line">{rows.map((p) => (
          <Fragment key={p.id}>
            <tr className={cn("align-top", p.stuck && "bg-warn/5")}>
              <td className="px-4 py-2 font-mono"><Link href={`/admin/orders/${p.id}`} className="hover:underline">{formatOrderNumber(p.number)}</Link>{p.status === "OUT_FOR_DELIVERY" && <span className="block font-sans text-[11.5px] text-muted">out for delivery</span>}</td>
              <td className="px-3 py-2">{p.carrier ?? "—"}<span className="block whitespace-nowrap font-mono text-[11.5px] text-muted">{p.trackingNumber}</span></td>
              <td className="px-3 py-2">{p.name}<span className="block text-[11.5px] text-muted">{p.district}</span></td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{p.cod ? formatPrice(p.cod) : <span className="text-muted">paid</span>}</td>
              <td className={cn("px-3 py-2 text-right tabular-nums", p.stuck && "font-semibold text-warn")}>{p.days ?? "—"}</td>
              <td className="px-3 py-2">{p.attempts ? <span>{p.attempts}<span className="block text-[11.5px] text-muted">{p.lastReason ?? ""}</span></span> : <span className="text-muted">—</span>}</td>
              <td className="px-4 py-2 text-right"><button className="text-[12.5px] text-muted underline underline-offset-4 hover:text-ink" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? "Close" : "Update"}</button></td>
            </tr>
            {open === p.id && <tr className="bg-cloud/30"><td colSpan={7} className="px-4 py-3"><div className="sticky left-4 max-w-[calc(100vw-4rem)]"><ParcelPanel orderId={p.id} reasons={reasons} /></div></td></tr>}
          </Fragment>
        ))}</tbody>
      </table>
    </div>
  );
}

/** Scan a parcel that has come back: units back on sale here (or quarantined if damaged). */
export function ReceiveReturn({ locations, defaultStoreId }: { locations: { id: string; name: string }[]; defaultStoreId: string }) {
  const [f, setF] = useState({ order: "", storeId: defaultStoreId, damaged: false, fee: "", note: "" });
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form className="space-y-2.5 p-4" onSubmit={(e) => { e.preventDefault(); if (!f.order.trim()) return; start(async () => {
      const r = await receiveReturnAction({ order: f.order, storeId: f.storeId, damaged: f.damaged, courierCharge: Math.round(Number(f.fee || 0) * 100), note: f.note || undefined });
      if (r.ok) { setLast({ ok: true, text: `${formatOrderNumber(r.result.number)} received${r.result.damaged ? " as damaged (quarantined)" : ", back on sale"}` }); setF({ ...f, order: "", damaged: false, fee: "", note: "" }); ref.current?.focus(); }
      else { setLast({ ok: false, text: r.error }); toast.error(r.error); }
    }); }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <input ref={ref} className={cn(input, "font-mono")} placeholder="Order number (scan the label)" value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })} aria-label="Returned order number" />
        <select className={input} value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })} aria-label="Received at">{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <input className={input} placeholder="Courier's return fee, Rs (0 if none)" inputMode="decimal" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value.replace(/[^\d.]/g, "") })} aria-label="Return fee" />
        <input className={input} placeholder="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} aria-label="Receipt note" />
      </div>
      <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={f.damaged} onChange={(e) => setF({ ...f, damaged: e.target.checked })} /> Damaged or opened: don&apos;t put it back on sale</label>
      <button className={btn} disabled={pending || !f.order.trim()}>{pending ? "Receiving…" : "Receive parcel"}</button>
      {last && <p role="status" className={cn("rounded-md px-3 py-2 text-[13.5px]", last.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>{last.text}</p>}
    </form>
  );
}
