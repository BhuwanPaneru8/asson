"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createVatReturn, fileVatReturn, payVatReturn, reopenVatReturn } from "@/actions/admin/vat";
import { cn } from "@/lib/utils";

const input = "h-9 rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";
const btn = "h-9 rounded-md bg-ink px-4 text-[13.5px] font-medium text-white disabled:opacity-40";
const ghost = "h-9 rounded-md border border-line px-3 text-[13.5px] hover:border-ink disabled:opacity-40";

export function NewVatReturn({ suggestion }: { suggestion: { from: string; to: string } | null }) {
  const [f, setF] = useState({ label: "", from: suggestion?.from ?? "", to: suggestion?.to ?? "" });
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap items-end gap-2 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await createVatReturn(f.label, f.from, f.to); if (r.ok) { toast.success("Return started"); setF({ label: "", from: "", to: "" }); } else toast.error(r.error); }); }}>
      <label className="text-[12.5px] text-muted">Nepali month<input className={cn(input, "mt-1 block w-40")} placeholder="Mangsir 2083" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} aria-label="Nepali month" /></label>
      <label className="text-[12.5px] text-muted">First day (AD)<input type="date" className={cn(input, "mt-1 block")} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="First day" /></label>
      <label className="text-[12.5px] text-muted">Last day (AD)<input type="date" className={cn(input, "mt-1 block")} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="Last day" /></label>
      <button className={btn} disabled={pending || f.label.trim().length < 3 || !f.from || !f.to}>{pending ? "Starting…" : "Start return"}</button>
      <p className="w-full text-[12px] text-muted">Use the AD dates of the Nepali month exactly as the IRD calendar has them{suggestion ? "; the dates shown start the day after your last return (check the last day)" : ""}.</p>
    </form>
  );
}

export function FileVatReturn({ id }: { id: string }) {
  const [ack, setAck] = useState("");
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input className={cn(input, "w-48")} placeholder="IRD acknowledgement no." value={ack} onChange={(e) => setAck(e.target.value)} aria-label="Acknowledgement number" />
      <button className={btn} disabled={pending || !ack.trim()} onClick={() => confirm("Mark this return as filed with the IRD? Its figures are frozen and its period's bills are locked.") && start(async () => { const r = await fileVatReturn(id, ack); if (r.ok) toast.success("Filed"); else toast.error(r.error); })}>Mark filed</button>
    </span>
  );
}

export function PayVatReturn({ id, payable, today }: { id: string; payable: number; today: string }) {
  const [f, setF] = useState({ on: today, amount: String(payable / 100), ref: "" });
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input type="date" max={today} className={input} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} aria-label="Paid on" />
      <input className={cn(input, "w-32 text-right")} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} aria-label="Amount paid" />
      <input className={cn(input, "w-40")} placeholder="Voucher / ref" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} aria-label="Payment reference" />
      <button className={ghost} disabled={pending || !f.amount} onClick={() => start(async () => { const r = await payVatReturn(id, f.on, Number(f.amount), f.ref); if (r.ok) toast.success("Payment recorded"); else toast.error(r.error); })}>Record payment</button>
    </span>
  );
}

export function ReopenVatReturn({ id }: { id: string }) {
  const [why, setWhy] = useState("");
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input className={cn(input, "w-56")} placeholder="Why reopen? (to amend)" value={why} onChange={(e) => setWhy(e.target.value)} aria-label="Reason to reopen" />
      <button className={ghost} disabled={pending || !why.trim()} onClick={() => start(async () => { const r = await reopenVatReturn(id, why); if (r.ok) toast.success("Reopened"); else toast.error(r.error); })}>Reopen</button>
    </span>
  );
}
