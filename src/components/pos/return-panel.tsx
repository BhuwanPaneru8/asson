"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Minus, Plus, Printer, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { findReturnableOrder, processReturn, type ReturnableOrder } from "@/actions/returns";
import { cn, formatDate, formatPrice } from "@/lib/utils";

const REASONS = ["Size too small", "Size too large", "Colour not as expected", "Quality issue / defect", "Changed mind", "Exchange for another size/colour", "Other"];
const METHODS = [
  { id: "STORE_CREDIT", label: "Store credit / exchange", hint: "Issues a voucher code — use it for the exchange sale" },
  { id: "CASH", label: "Cash", hint: "Paid from your drawer" },
  { id: "ESEWA_QR", label: "eSewa", hint: "Send back via eSewa — add the transaction ID" },
  { id: "KHALTI_QR", label: "Khalti", hint: "Send back via Khalti — add the transaction ID" },
  { id: "BANK", label: "Bank transfer", hint: "Add the transfer reference" },
] as const;
type Method = (typeof METHODS)[number]["id"];
const newRef = () => `ret-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function ReturnPanel({ canApprove }: { canApprove: boolean }) {
  const [number, setNumber] = useState("");
  const [order, setOrder] = useState<ReturnableOrder | null>(null);
  const [picks, setPicks] = useState<Record<string, { qty: number; condition: "RESELLABLE" | "DAMAGED" }>>({});
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<Method>("STORE_CREDIT");
  const [reference, setReference] = useState("");
  const [pin, setPin] = useState("");
  const [done, setDone] = useState<{ returnId: string; refund: number; voucherCode: string | null } | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const ref = useRef(newRef());

  const find = (e: React.FormEvent) => {
    e.preventDefault();
    startLoad(async () => {
      const r = await findReturnableOrder(number);
      if (!r.ok) { toast.error(r.error); setOrder(null); return; }
      setOrder(r.order); setPicks({}); setDone(null); ref.current = newRef();
    });
  };

  const total = order ? order.lines.reduce((s, l) => s + (picks[l.orderItemId]?.qty ?? 0) * l.refundPerUnit, 0) : 0;
  const count = Object.values(picks).reduce((s, p) => s + p.qty, 0);
  const needsRef = method !== "STORE_CREDIT" && method !== "CASH";

  const submit = () => startSave(async () => {
    if (!order) return;
    const r = await processReturn({
      clientRef: ref.current,
      orderId: order.orderId,
      lines: Object.entries(picks).filter(([, p]) => p.qty > 0).map(([orderItemId, p]) => ({ orderItemId, quantity: p.qty, condition: p.condition })),
      reason, refundMethod: method, reference: reference || undefined,
      approverPin: canApprove ? undefined : pin,
    });
    if (!r.ok) { toast.error(r.error); return; }
    setDone(r); setOrder(null); setNumber(""); setPicks({}); setReason(""); setPin(""); setReference("");
  });

  return (
    <div className="mx-auto max-w-4xl">
      <form onSubmit={find} className="flex gap-2">
        <input autoFocus value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Receipt / order number, e.g. AS000123" aria-label="Order number" className="h-12 flex-1 rounded-md border border-line bg-white px-4 text-[16px] uppercase outline-none focus:border-ink" />
        <button disabled={loading} className="flex h-12 items-center gap-2 rounded-md bg-ink px-5 text-[14px] font-medium text-white"><Search className="h-4 w-4" /> Find order</button>
      </form>

      {done && (
        <div className="mt-6 rounded-lg border border-line bg-white p-6">
          <p className="text-[13px] uppercase tracking-wider text-success">Return complete</p>
          <p className="mt-1 text-[24px] font-semibold">Refund {formatPrice(done.refund)}</p>
          {done.voucherCode && <p className="mt-3 rounded-md bg-accent-soft p-4 text-[15px]">Store credit code: <b className="font-mono text-[20px] tracking-wider">{done.voucherCode}</b><br /><span className="text-[13px] text-muted">For an exchange: switch to Sale, add the new item and pay with “Store credit”. Valid for 1 year, online too.</span></p>}
          <a href={`/admin/pos/return/${done.returnId}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 hover:border-ink"><Printer className="h-4 w-4" /> Print return slip</a>
        </div>
      )}

      {order && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="rounded-lg border border-line bg-white">
            <div className="border-b border-line px-5 py-3 text-[13.5px]">
              <p className="font-semibold">{order.number} · {order.channel === "STORE" ? "Store sale" : "Online order"} · {order.customer}</p>
              <p className="text-muted">Sold {formatDate(order.soldAt)} ({order.daysSince} days ago) · paid with {order.paidWith.join(", ").replace(/_QR/g, "")}</p>
              {!order.withinWindow && <p className="mt-1 font-medium text-warn">Outside the return window — a manager must approve.</p>}
            </div>
            <ul className="divide-y divide-line">
              {order.lines.map((l) => {
                const p = picks[l.orderItemId] ?? { qty: 0, condition: "RESELLABLE" as const };
                const set = (patch: Partial<typeof p>) => setPicks((x) => ({ ...x, [l.orderItemId]: { ...p, ...patch } }));
                return (
                  <li key={l.orderItemId} className={cn("flex gap-3 px-5 py-3", l.returnable === 0 && "opacity-40")}>
                    <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-cloud">{l.image && <Image src={l.image} alt="" fill sizes="48px" className="object-cover" />}</div>
                    <div className="min-w-0 flex-1 text-[13.5px]">
                      <p className="font-medium">{l.name}</p>
                      <p className="text-muted">{l.color} · {l.size} · {l.sku} · {formatPrice(l.refundPerUnit)} each{l.returned ? ` · ${l.returned} already returned` : ""}</p>
                      {l.returnable > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => set({ qty: Math.max(0, p.qty - 1) })} className="flex h-7 w-7 items-center justify-center rounded border border-line" aria-label="Fewer"><Minus className="h-3 w-3" /></button>
                            <span className="w-8 text-center tabular-nums">{p.qty}/{l.returnable}</span>
                            <button onClick={() => set({ qty: Math.min(l.returnable, p.qty + 1) })} className="flex h-7 w-7 items-center justify-center rounded border border-line" aria-label="More"><Plus className="h-3 w-3" /></button>
                          </div>
                          {p.qty > 0 && (
                            <div className="flex rounded-md border border-line text-[12.5px]">
                              {(["RESELLABLE", "DAMAGED"] as const).map((c) => (
                                <button key={c} onClick={() => set({ condition: c })} className={cn("px-2.5 py-1", p.condition === c ? (c === "DAMAGED" ? "bg-danger text-white" : "bg-ink text-white") : "")}>{c === "RESELLABLE" ? "Good — restock" : "Damaged — quarantine"}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-3 rounded-lg border border-line bg-white p-5">
            <label className="block text-[13px] font-medium text-ink-soft">Reason
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-line px-2 text-[14px]"><option value="">Select…</option>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            </label>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-ink-soft">Refund as</legend>
              <div className="space-y-1.5">
                {METHODS.map((m) => (
                  <label key={m.id} className={cn("flex cursor-pointer gap-2 rounded-md border p-2.5 text-[13.5px]", method === m.id ? "border-ink" : "border-line")}>
                    <input type="radio" checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-0.5 accent-ink" />
                    <span><b className="font-medium">{m.label}</b><br /><span className="text-[12px] text-muted">{m.hint}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            {needsRef && <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction / transfer reference" aria-label="Refund reference" className="h-10 w-full rounded-md border border-line px-3 text-[14px]" />}
            {!canApprove && (
              <label className="block text-[13px] font-medium text-ink-soft">Manager PIN
                <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" className="mt-1.5 h-10 w-full rounded-md border border-line px-3 tracking-[0.4em]" />
              </label>
            )}
            <div className="flex items-baseline justify-between border-t border-line pt-3"><span className="text-[14px]">{count} item{count === 1 ? "" : "s"} · refund</span><span className="text-[24px] font-semibold tabular-nums">{formatPrice(total)}</span></div>
            <button onClick={submit} disabled={saving || count === 0 || !reason || (!canApprove && pin.length < 4) || (needsRef && !reference.trim())} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ink font-medium text-white disabled:opacity-40">
              <RotateCcw className="h-4 w-4" /> {saving ? "Processing…" : "Complete return"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
