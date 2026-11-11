"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordStatutoryDeposit } from "@/actions/admin/statutory";

const input = "h-9 rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";

export function RecordStatutory({ id, amount, today, label }: { id: string; amount: number; today: string; label: string }) {
  const [f, setF] = useState({ on: today, amount: String(amount / 100), ref: "" });
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input type="date" max={today} className={input} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} aria-label={`${label} deposited on`} />
      <input className={`${input} w-28 text-right`} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} aria-label={`${label} amount`} />
      <input className={`${input} w-36`} placeholder="Voucher / challan no." value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} aria-label={`${label} voucher`} />
      <button className="h-9 rounded-md bg-ink px-3 text-[13.5px] text-white disabled:opacity-40" disabled={pending || !f.amount || !f.ref.trim()} onClick={() => start(async () => { const r = await recordStatutoryDeposit(id, f.on, Number(f.amount), f.ref); if (r.ok) toast.success("Deposit recorded"); else toast.error(r.error); })}>Deposited</button>
    </span>
  );
}
