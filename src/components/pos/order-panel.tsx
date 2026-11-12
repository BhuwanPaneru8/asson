"use client";

import { useRef, useState, useTransition } from "react";
import { Search, Truck, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { createShopOrderAction, posOrderLookup, type ElsewhereItem } from "@/actions/pos";
import { DISTRICTS } from "@/lib/config";
import { cn, formatPrice } from "@/lib/utils";

type Method = "CASH" | "ESEWA_QR" | "KHALTI_QR" | "FONEPAY_QR" | "CARD" | "BANK";
const METHODS: { id: Method; label: string }[] = [
  { id: "CASH", label: "Cash" }, { id: "ESEWA_QR", label: "eSewa QR" }, { id: "KHALTI_QR", label: "Khalti QR" },
  { id: "FONEPAY_QR", label: "Fonepay QR" }, { id: "CARD", label: "Card" }, { id: "BANK", label: "Bank" },
];
const input = "h-11 w-full rounded-md border border-line bg-white px-3 text-[15px] outline-none focus:border-ink";
const paisa = (s: string) => Math.round((Number(s.replace(/[^\d.]/g, "")) || 0) * 100);
const newRef = () => `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
type Line = ElsewhereItem & { quantity: number };

/** A size the shop doesn't have, ordered from another location: collect here later, or delivered. */
export function OrderPanel({ shop }: { shop: string }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ElsewhereItem[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [c, setC] = useState({ name: "", phone: "" });
  const [fulfil, setFulfil] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [addr, setAddr] = useState({ line1: "", city: "", district: "" });
  const [pay, setPay] = useState<"NOW" | "LATER">("NOW");
  const [method, setMethod] = useState<Method>("CASH");
  const [given, setGiven] = useState("");
  const [reference, setReference] = useState("");
  const [done, setDone] = useState<{ number: string; total: number; change: number } | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef(newRef());
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  const search = () => start(async () => setHits(await posOrderLookup(query)));
  const add = (h: ElsewhereItem) => {
    const avail = h.elsewhere.reduce((s, e) => s + e.quantity, 0);
    setLines((ls) => { const ex = ls.find((l) => l.variantId === h.variantId); if (ex) return ls.map((l) => (l.variantId === h.variantId ? { ...l, quantity: Math.min(avail, l.quantity + 1) } : l)); return [...ls, { ...h, quantity: 1 }]; });
  };
  const submit = () => start(async () => {
    const r = await createShopOrderAction({ clientRef: ref.current, lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), customer: c, fulfil, address: fulfil === "DELIVERY" ? addr : undefined, pay, tender: pay === "NOW" ? { method, tendered: method === "CASH" && given ? paisa(given) : undefined, reference: reference || undefined } : undefined });
    if (r.ok) { setDone({ number: r.number, total: r.total, change: r.change }); toast.success(`${r.number} ordered`); }
    else toast.error(r.error);
  });
  const reset = () => { setDone(null); setLines([]); setHits([]); setQuery(""); setC({ name: "", phone: "" }); setAddr({ line1: "", city: "", district: "" }); setGiven(""); setReference(""); ref.current = newRef(); };

  if (done) return (
    <div className="mx-auto max-w-md rounded-lg border border-line bg-white p-6 text-center">
      <p className="text-[13px] uppercase tracking-wider text-muted">Ordered</p>
      <p className="mt-1 text-[28px] font-semibold">{done.number}</p>
      <p className="mt-2 text-[14px] text-ink-soft">{fulfil === "PICKUP" ? `The customer gets an SMS when it's ready to collect at ${shop}.` : "The customer gets SMS updates as it's delivered."} {pay === "NOW" ? `Paid ${formatPrice(done.total)}.` : `${formatPrice(done.total)} to pay ${fulfil === "PICKUP" ? "when they collect" : "on delivery"}.`}</p>
      {done.change > 0 && <p className="mt-3 text-[20px] font-semibold">Change: {formatPrice(done.change)}</p>}
      <button className="mt-5 h-11 w-full rounded-md bg-ink text-[15px] font-medium text-white" onClick={reset}>New order</button>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (query.trim()) search(); }}>
          <input autoFocus className={input} placeholder="Scan or search the item the customer wants" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search item to order" />
          <button className="flex h-11 items-center gap-1.5 rounded-md bg-ink px-4 text-[14px] text-white disabled:opacity-40" disabled={pending || !query.trim()}><Search className="h-4 w-4" /> Find</button>
        </form>
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {hits.map((h) => {
            const avail = h.elsewhere.reduce((s, e) => s + e.quantity, 0);
            return (
              <li key={h.variantId} className="flex items-center justify-between gap-3 px-4 py-3 text-[14px]">
                <span className="min-w-0"><span className="font-medium">{h.name}</span> · {h.color} {h.size}<span className="block text-[12.5px] text-muted">{formatPrice(h.price)} · here: {h.stock} · {avail ? h.elsewhere.slice(0, 3).map((e) => `${e.name} ${e.quantity}`).join(", ") : "nowhere else"}</span></span>
                <button className="h-9 shrink-0 rounded-md border border-line px-3 text-[13px] hover:border-ink disabled:opacity-40" disabled={!avail} onClick={() => add(h)} aria-label={`Order ${h.name} ${h.color} ${h.size}`}>{avail ? "Order" : "None"}</button>
              </li>
            );
          })}
          {!hits.length && <li className="px-4 py-6 text-center text-[13.5px] text-muted">Search for a size that isn&apos;t on the shelf here to see where else it is.</li>}
        </ul>
      </div>
      <div className="space-y-3 rounded-lg border border-line bg-white p-4">
        <p className="font-semibold">Order for a customer</p>
        {!lines.length ? <p className="text-[13.5px] text-muted">Nothing added yet.</p> : (
          <ul className="space-y-1.5 text-[14px]">{lines.map((l) => (
            <li key={l.variantId} className="flex items-center justify-between gap-2"><span>{l.name} · {l.color} {l.size}</span><span className="flex items-center gap-2 tabular-nums">×{l.quantity}<button className="text-muted hover:text-danger" onClick={() => setLines((ls) => ls.filter((x) => x.variantId !== l.variantId))} aria-label={`Remove ${l.name}`}>✕</button></span></li>
          ))}</ul>
        )}
        <input className={input} placeholder="Customer's name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} aria-label="Customer name" />
        <input className={input} placeholder="Mobile (98XXXXXXXX)" inputMode="numeric" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} aria-label="Customer mobile" />
        <div className="grid grid-cols-2 gap-2">
          {([["PICKUP", `Collect at ${shop}`, StoreIcon], ["DELIVERY", "Deliver to them", Truck]] as const).map(([v, label, Icon]) => (
            <button key={v} type="button" onClick={() => setFulfil(v)} aria-pressed={fulfil === v} className={cn("flex items-center justify-center gap-1.5 rounded-md border px-2 py-2.5 text-[13px]", fulfil === v ? "border-ink bg-ink text-white" : "border-line")}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </div>
        {fulfil === "DELIVERY" && <>
          <select className={input} value={addr.district} onChange={(e) => setAddr({ ...addr, district: e.target.value })} aria-label="Delivery district"><option value="">District</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select>
          <input className={input} placeholder="City / municipality" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} aria-label="Delivery city" />
          <input className={input} placeholder="Tole / street, house no." value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} aria-label="Delivery street" />
        </>}
        <div className="grid grid-cols-2 gap-2">
          {([["NOW", "Pay now"], ["LATER", fulfil === "PICKUP" ? "Pay when collecting" : "Cash on delivery"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setPay(v)} aria-pressed={pay === v} className={cn("rounded-md border px-2 py-2.5 text-[13px]", pay === v ? "border-ink bg-ink text-white" : "border-line")}>{label}</button>
          ))}
        </div>
        {pay === "NOW" && <>
          <select className={input} value={method} onChange={(e) => setMethod(e.target.value as Method)} aria-label="Payment method">{METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
          {method === "CASH" ? <input className={input} placeholder="Cash received (for change)" inputMode="decimal" value={given} onChange={(e) => setGiven(e.target.value)} aria-label="Cash received" /> : <input className={input} placeholder="Transaction reference" value={reference} onChange={(e) => setReference(e.target.value)} aria-label="Payment reference" />}
        </>}
        <div className="flex items-baseline justify-between border-t border-line pt-3"><span className="text-muted">Items{fulfil === "DELIVERY" ? " (delivery added at checkout)" : ""}</span><span className="text-[22px] font-semibold tabular-nums">{formatPrice(subtotal)}</span></div>
        <button className="h-12 w-full rounded-md bg-ink text-[15px] font-medium text-white disabled:opacity-40" disabled={pending || !lines.length || c.name.trim().length < 2 || c.phone.length !== 10 || (fulfil === "DELIVERY" && (!addr.district || !addr.city || !addr.line1))} onClick={submit}>{pending ? "Ordering…" : "Place order"}</button>
      </div>
    </div>
  );
}
