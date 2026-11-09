"use client";

import { useEffect, useState, useTransition } from "react";
import { PackageCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { collectPickup, listPickups, type PickupRow } from "@/actions/pos";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";

type Method = "CASH" | "ESEWA_QR" | "KHALTI_QR" | "FONEPAY_QR" | "CARD" | "BANK";
const METHODS: { id: Method; label: string }[] = [
  { id: "CASH", label: "Cash" }, { id: "ESEWA_QR", label: "eSewa QR" }, { id: "KHALTI_QR", label: "Khalti QR" },
  { id: "FONEPAY_QR", label: "Fonepay QR" }, { id: "CARD", label: "Card" }, { id: "BANK", label: "Bank" },
];
const paisa = (s: string) => Math.round((Number(s.replace(/[^\d.]/g, "")) || 0) * 100);

/** Click-and-collect: find the customer's order, take what's due, hand it over. */
export function PickupPanel({ shop }: { shop: string }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PickupRow[] | null>(null);
  const [open, setOpen] = useState<PickupRow | null>(null);
  const [method, setMethod] = useState<Method>("CASH");
  const [given, setGiven] = useState("");
  const [ref, setRef] = useState("");
  const [pending, start] = useTransition();

  const load = (q = query) => start(async () => {
    const r = await listPickups(q);
    if (r.ok) setRows(r.rows); else toast.error(r.error);
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(""); }, []);

  const hand = (o: PickupRow) => start(async () => {
    const r = await collectPickup({ orderId: o.orderId, ...(o.due ? { method, tendered: method === "CASH" && given ? paisa(given) : undefined, reference: ref || undefined } : {}) });
    if (!r.ok) return void toast.error(r.error);
    toast.success(r.change ? `Handed over. Give ${formatPrice(r.change)} change.` : "Handed over");
    setOpen(null); setGiven(""); setRef("");
    load();
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[20px] font-semibold">Pickups at {shop}</h1>
      <p className="mt-1 text-[14px] text-muted">Orders that are ready here. Ask for the order number or phone, check the name, take what&apos;s due and hand it over.</p>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mt-4 flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Order number or phone" aria-label="Order number or phone" className="h-11 flex-1 rounded-md border border-line bg-white px-3 text-[15px] outline-none focus:border-ink" />
        <button className="flex h-11 items-center gap-1.5 rounded-md border border-line bg-white px-4 text-[14px] hover:border-ink"><Search className="h-4 w-4" /> Find</button>
      </form>

      <ul className={cn("mt-4 divide-y divide-line rounded-lg border border-line bg-white", pending && "opacity-60")}>
        {rows?.map((o) => (
          <li key={o.orderId} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[14px]">
                <p className="font-semibold">{o.number} · {o.name}</p>
                <p className="text-muted">{o.phone} · {o.units} item{o.units === 1 ? "" : "s"}{o.readyAt ? ` · ready ${formatDateTime(o.readyAt)}` : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-[15px] font-semibold tabular-nums", o.due ? "" : "text-success")}>{o.due ? `Due ${formatPrice(o.due)}` : "Paid"}</span>
                {open?.orderId !== o.orderId && <button onClick={() => { setOpen(o); setMethod("CASH"); }} className="h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white">Hand over</button>}
              </div>
            </div>
            {open?.orderId === o.orderId && (
              <div className="mt-3 rounded-md bg-cloud/50 p-3">
                {o.due > 0 && (
                  <>
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Payment method">
                      {METHODS.map((m) => <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)} className={cn("h-9 rounded-md border px-3 text-[13.5px]", method === m.id ? "border-ink bg-ink text-white" : "border-line bg-white")}>{m.label}</button>)}
                    </div>
                    {method === "CASH"
                      ? <label className="mt-2 block text-[13px] text-ink-soft">Cash received (Rs.)<input value={given} onChange={(e) => setGiven(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder={String(o.due / 100)} className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 tabular-nums" /></label>
                      : <label className="mt-2 block text-[13px] text-ink-soft">Payment reference<input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transaction ID" className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3" /></label>}
                    {method === "CASH" && given && paisa(given) > o.due && <p className="mt-1 text-[13px]">Change: <b>{formatPrice(paisa(given) - o.due)}</b></p>}
                  </>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(null)} className="h-10 rounded-md px-3 text-[14px] hover:bg-white">Cancel</button>
                  <button type="button" disabled={pending} onClick={() => hand(o)} className="flex h-10 items-center gap-1.5 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40"><PackageCheck className="h-4 w-4" /> {o.due ? `Take ${formatPrice(o.due)} & hand over` : "Hand over"}</button>
                </div>
              </div>
            )}
          </li>
        ))}
        {!rows && <li className="p-8 text-center text-[14px] text-muted" aria-busy="true">Loading pickups…</li>}
        {rows && !rows.length && <li className="p-8 text-center text-[14px] text-muted">{query ? "No ready order matches that." : "No orders waiting for pickup here."}</li>}
      </ul>
    </div>
  );
}
