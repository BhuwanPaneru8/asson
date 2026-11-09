"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelStockTransfer, receiveStockTransfer, sendStockTransfer } from "@/actions/admin/locations";

type Item = { id: string; sku: string; label: string; quantity: number };

export function TransferActions({ id, status, to, items }: { id: string; status: "DRAFT" | "SENT" | "RECEIVED" | "CANCELLED"; to: string; items: Item[] }) {
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.id, String(i.quantity)])));
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  if (status === "RECEIVED" || status === "CANCELLED") return null;

  const send = () => start(async () => {
    const r = await sendStockTransfer(id);
    if (r.ok) toast.success("Sent — stock is now in transit"); else toast.error(r.error);
  });
  const cancel = () => {
    const reason = prompt(status === "SENT" ? "Why is this transfer being recalled? Units go back to the source." : "Why is this draft cancelled?");
    if (!reason) return;
    start(async () => { const r = await cancelStockTransfer(id, reason); if (r.ok) toast.success(status === "SENT" ? "Recalled — units are back at the source" : "Cancelled"); else toast.error(r.error); });
  };
  const missing = items.reduce((s, i) => s + i.quantity - (Number(counts[i.id]) || 0), 0);
  const receive = () => {
    if (missing > 0 && !note.trim()) return toast.error(`${missing} unit${missing > 1 ? "s are" : " is"} missing. Add a note saying what happened.`);
    if (missing > 0 && !confirm(`Record ${missing} unit${missing > 1 ? "s" : ""} as missing on arrival? This is logged against the transfer.`)) return;
    start(async () => {
      const r = await receiveStockTransfer({ id, note: note.trim() || undefined, counts: Object.fromEntries(items.map((i) => [i.id, Number(counts[i.id]) || 0])) });
      if (r.ok) toast.success(r.short ? "Received with a shortfall — logged" : "Received — stock added"); else toast.error(r.error);
    });
  };

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      {status === "DRAFT" ? (
        <>
          <p className="text-[13.5px] text-muted">Sending takes these units out of the source now. Pack them before you press send.</p>
          <button disabled={pending} onClick={send} className="mt-3 h-10 w-full rounded-md bg-ink text-[14px] font-medium text-white disabled:opacity-40">{pending ? "Sending…" : "Send transfer"}</button>
        </>
      ) : (
        <>
          <h2 className="text-[15px] font-semibold">Count in at {to}</h2>
          <p className="mt-1 text-[13px] text-muted">Count what actually arrived. Only counted units become sellable here.</p>
          <ul className="mt-3 space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0"><span className="block truncate">{i.label}</span><span className="font-mono text-[11.5px] text-muted">{i.sku} · sent {i.quantity}</span></span>
                <input value={counts[i.id]} onChange={(e) => setCounts({ ...counts, [i.id]: e.target.value.replace(/\D/g, "") })} inputMode="numeric" aria-label={`Received ${i.sku}`} className={`h-8 w-16 shrink-0 rounded border px-2 text-right tabular-nums ${(Number(counts[i.id]) || 0) < i.quantity ? "border-danger/50 text-danger" : "border-line"}`} />
              </li>
            ))}
          </ul>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={missing > 0 ? "What happened to the missing units? (required)" : "Note (optional)"} aria-label="Receiving note" className="mt-3 w-full rounded-md border border-line p-2 text-[13px]" />
          <button disabled={pending} onClick={receive} className="mt-2 h-10 w-full rounded-md bg-ink text-[14px] font-medium text-white disabled:opacity-40">{pending ? "Saving…" : missing > 0 ? `Receive (${missing} missing)` : "Receive all"}</button>
        </>
      )}
      <button disabled={pending} onClick={cancel} className="mt-2 h-9 w-full rounded-md text-[13.5px] text-muted hover:bg-cloud hover:text-danger">{status === "SENT" ? "Recall transfer" : "Cancel draft"}</button>
    </div>
  );
}
