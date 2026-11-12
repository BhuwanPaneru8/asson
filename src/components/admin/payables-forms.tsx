"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { recordSupplierBill, recordSupplierCredit, recordSupplierPayment, voidSupplierBill, voidSupplierCredit, voidSupplierPayment } from "@/actions/admin/payables";
import { formatPrice } from "@/lib/utils";

const input = "mt-1 h-10 w-full rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";
const label = "text-[13px] font-medium text-ink-soft";
type Supplier = { id: string; name: string; terms: number };
type PO = { id: string; supplierId: string; label: string; received: number };
type OpenBill = { id: string; supplierId: string; label: string; outstanding: number; due: string };
const rs = (paisa: number) => formatPrice(paisa);

export function RecordBill({ suppliers, pos, today }: { suppliers: Supplier[]; pos: PO[]; today: string }) {
  const [f, setF] = useState({ supplierId: "", reference: "", billDate: today, dueDate: "", amount: "", vatAmount: "", purchaseOrderId: "", note: "" });
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const supplier = suppliers.find((s) => s.id === f.supplierId);
  const myPos = pos.filter((p) => p.supplierId === f.supplierId);
  const po = pos.find((p) => p.id === f.purchaseOrderId);
  const goods = Math.round((Number(f.amount) - Number(f.vatAmount || 0)) * 100);
  const off = po && f.amount ? goods - po.received : 0;
  const defaultDue = supplier && f.billDate ? new Date(new Date(`${f.billDate}T12:00:00+05:45`).getTime() + supplier.terms * 86_400_000).toISOString().slice(0, 10) : "";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await recordSupplierBill(f);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Bill recorded${r.creditUsed ? `; ${rs(r.creditUsed)} paid from credit` : ""}`);
      setF({ ...f, reference: "", amount: "", vatAmount: "", purchaseOrderId: "", note: "", dueDate: "" });
    });
  };
  return (
    <form onSubmit={submit} className="grid gap-3 p-4 sm:grid-cols-2">
      <label className={label}>Supplier<select className={input} value={f.supplierId} onChange={set("supplierId")} required><option value="">Choose…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className={label}>Their invoice no.<input className={input} value={f.reference} onChange={set("reference")} required placeholder="e.g. 2081/82-0457" /></label>
      <label className={label}>Bill date<input type="date" className={input} value={f.billDate} max={today} onChange={set("billDate")} required /></label>
      <label className={label}>Due date<input type="date" className={input} value={f.dueDate} onChange={set("dueDate")} placeholder={defaultDue} /><span className="text-[11.5px] font-normal text-muted">{defaultDue ? `Leave empty for ${defaultDue} (${supplier?.terms}-day terms)` : "Defaults to the supplier's terms"}</span></label>
      <label className={label}>Total incl. VAT (Rs.)<input className={input} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" required /></label>
      <label className={label}>of which VAT (Rs.)<input className={input} value={f.vatAmount} onChange={(e) => setF({ ...f, vatAmount: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="0" /><span className="text-[11.5px] font-normal text-muted">13% of the goods value on a VAT bill{f.amount ? ` ≈ ${(Number(f.amount) - Number(f.amount) / 1.13).toFixed(2)}` : ""}</span></label>
      <label className={`${label} sm:col-span-2`}>Purchase order (optional)<select className={input} value={f.purchaseOrderId} onChange={set("purchaseOrderId")} disabled={!myPos.length}><option value="">{myPos.length ? "Not linked" : "No orders from this supplier"}</option>{myPos.map((p) => <option key={p.id} value={p.id}>{p.label} · received {rs(p.received)}</option>)}</select>
        {off !== 0 && Math.abs(off) > Math.max(10_000, (po?.received ?? 0) / 100) && <span className="mt-1 block text-[12.5px] font-normal text-warn">Goods on this bill ({rs(goods)}) differ from what was received ({rs(po!.received)}) by {rs(Math.abs(off))}. Check before paying.</span>}
      </label>
      <label className={`${label} sm:col-span-2`}>Note<input className={input} value={f.note} onChange={set("note")} placeholder="Optional" /></label>
      <div className="flex justify-end sm:col-span-2"><button disabled={pending} className="h-10 rounded-md bg-ink px-5 text-[14px] font-medium text-white disabled:opacity-40">{pending ? "Saving…" : "Record bill"}</button></div>
    </form>
  );
}

export function RecordPayment({ suppliers, bills, today }: { suppliers: Supplier[]; bills: OpenBill[]; today: string }) {
  const [f, setF] = useState({ supplierId: "", amount: "", method: "BANK" as "CASH" | "BANK" | "CHEQUE" | "ESEWA" | "KHALTI" | "FONEPAY", reference: "", paidAt: today, note: "" });
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const mine = useMemo(() => bills.filter((b) => b.supplierId === f.supplierId), [bills, f.supplierId]);
  const owed = mine.reduce((s, b) => s + b.outstanding, 0);
  const amount = Math.round(Number(f.amount || 0) * 100);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount > owed && !confirm(`This is ${rs(amount - owed)} more than you owe ${suppliers.find((s) => s.id === f.supplierId)?.name}. Keep the extra as credit for their next bill?`)) return;
    start(async () => {
      const r = await recordSupplierPayment({ ...f, billIds: picked.length ? picked : undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Payment recorded${r.credit ? `; ${rs(r.credit)} kept as credit` : ""}`);
      setF({ ...f, amount: "", reference: "", note: "" }); setPicked([]);
    });
  };
  return (
    <form onSubmit={submit} className="grid gap-3 p-4 sm:grid-cols-2">
      <label className={label}>Supplier<select className={input} value={f.supplierId} onChange={(e) => { setF({ ...f, supplierId: e.target.value }); setPicked([]); }} required><option value="">Choose…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className={label}>Amount (Rs.)<input className={input} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" required />{f.supplierId && <span className="text-[11.5px] font-normal text-muted">Owed: {rs(owed)}{owed ? <> · <button type="button" className="underline" onClick={() => setF({ ...f, amount: String(owed / 100) })}>pay all</button></> : null}</span>}</label>
      <label className={label}>Paid by<select className={input} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as typeof f.method })}><option value="BANK">Bank transfer</option><option value="CHEQUE">Cheque</option><option value="CASH">Cash</option><option value="ESEWA">eSewa</option><option value="KHALTI">Khalti</option><option value="FONEPAY">Fonepay</option></select></label>
      <label className={label}>Reference{f.method !== "CASH" && " *"}<input className={input} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder={f.method === "CHEQUE" ? "Cheque no." : "Transaction ID"} required={f.method !== "CASH"} /></label>
      <label className={label}>Date paid<input type="date" className={input} value={f.paidAt} max={today} onChange={(e) => setF({ ...f, paidAt: e.target.value })} required /></label>
      <label className={label}>Note<input className={input} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Optional" /></label>
      {mine.length > 0 && (
        <fieldset className="sm:col-span-2">
          <legend className={label}>Pay which bills? <span className="font-normal text-muted">(none ticked = oldest due first)</span></legend>
          <ul className="mt-1 divide-y divide-line rounded-md border border-line bg-white">
            {mine.map((b) => (
              <li key={b.id}><label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-[13.5px]"><input type="checkbox" className="accent-ink" checked={picked.includes(b.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, b.id] : picked.filter((x) => x !== b.id))} /><span className="flex-1">{b.label} · due {b.due}</span><span className="tabular-nums">{rs(b.outstanding)}</span></label></li>
            ))}
          </ul>
        </fieldset>
      )}
      <div className="flex justify-end sm:col-span-2"><button disabled={pending} className="h-10 rounded-md bg-ink px-5 text-[14px] font-medium text-white disabled:opacity-40">{pending ? "Saving…" : "Record payment"}</button></div>
    </form>
  );
}

export function VoidButton({ kind, id }: { kind: "bill" | "payment" | "credit"; id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} className="text-[12.5px] text-muted underline hover:text-danger" onClick={() => {
      const why = prompt(kind === "bill" ? "Why is this bill void? Anything paid on it becomes credit." : kind === "credit" ? "Why is this credit note void? Its bills will be owed again." : "Why is this payment void? Its bills will be owed again.");
      if (!why) return;
      start(async () => { const r = kind === "bill" ? await voidSupplierBill(id, why) : kind === "credit" ? await voidSupplierCredit(id, why) : await voidSupplierPayment(id, why); if (r.ok) toast.success("Voided"); else toast.error(r.error); });
    }}>Void</button>
  );
}

type Damaged = { id: string; supplierId: string; label: string; expected: number };

/** A supplier's credit note: settles open bills (oldest first, or the ones ticked) and can cover damaged returns. */
export function RecordCredit({ suppliers, bills, damaged, today }: { suppliers: Supplier[]; bills: OpenBill[]; damaged: Damaged[]; today: string }) {
  const [f, setF] = useState({ supplierId: "", reference: "", date: today, amount: "", vatAmount: "", reason: "" });
  const [pick, setPick] = useState<string[]>([]);
  const [dmg, setDmg] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const mine = bills.filter((b) => b.supplierId === f.supplierId);
  const myDamaged = damaged.filter((d) => d.supplierId === f.supplierId);
  return (
    <form className="space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await recordSupplierCredit({ ...f, billIds: pick, damageEntryIds: dmg });
      if (r.ok) { toast.success(`CN-${String(r.number).padStart(5, "0")} recorded${r.credit ? `: ${rs(r.credit)} kept as credit` : ""}`); setF({ ...f, reference: "", amount: "", vatAmount: "", reason: "" }); setPick([]); setDmg([]); } else toast.error(r.error);
    }); }}>
      <label className="block"><span className={label}>Supplier</span><select className={input} value={f.supplierId} onChange={(e) => { setF({ ...f, supplierId: e.target.value }); setPick([]); setDmg([]); }} aria-label="Credit note supplier"><option value="">Choose…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className={label}>Their credit note no.</span><input className={input} value={f.reference} onChange={set("reference")} aria-label="Credit note number" /></label>
        <label className="block"><span className={label}>Date</span><input type="date" className={input} value={f.date} onChange={set("date")} aria-label="Credit note date" /></label>
        <label className="block"><span className={label}>Total, Rs (with VAT)</span><input className={input} inputMode="decimal" value={f.amount} onChange={set("amount")} aria-label="Credit total" /></label>
        <label className="block"><span className={label}>VAT in it, Rs</span><input className={input} inputMode="decimal" value={f.vatAmount} onChange={set("vatAmount")} aria-label="Credit VAT" /></label>
      </div>
      <label className="block"><span className={label}>What it&apos;s for</span><input className={input} placeholder="e.g. damaged shirts returned, price correction on BILL-00012" value={f.reason} onChange={set("reason")} aria-label="Credit reason" /></label>
      {myDamaged.length > 0 && (
        <fieldset className="rounded-md border border-line p-3"><legend className="px-1 text-[12.5px] font-medium">Damaged goods it covers</legend>
          {myDamaged.map((d) => <label key={d.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={dmg.includes(d.id)} onChange={(e) => setDmg(e.target.checked ? [...dmg, d.id] : dmg.filter((x) => x !== d.id))} /> {d.label} · {rs(d.expected)} expected</label>)}
        </fieldset>
      )}
      {mine.length > 0 && (
        <fieldset className="rounded-md border border-line p-3"><legend className="px-1 text-[12.5px] font-medium">Set against (none ticked: oldest due first)</legend>
          {mine.map((b) => <label key={b.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={pick.includes(b.id)} onChange={(e) => setPick(e.target.checked ? [...pick, b.id] : pick.filter((x) => x !== b.id))} /> {b.label} · {rs(b.outstanding)} owed</label>)}
        </fieldset>
      )}
      <button className="h-10 w-full rounded-md bg-ink text-[14px] font-medium text-white disabled:opacity-40" disabled={pending || !f.supplierId || !f.reference || !f.amount || f.reason.trim().length < 3}>{pending ? "Saving…" : "Record credit note"}</button>
    </form>
  );
}
