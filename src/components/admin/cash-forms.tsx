"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { checkDepositAction, countSafeAction, pettyAction, recordDepositAction } from "@/actions/admin/cash";
import { cn } from "@/lib/utils";
import { IssuePhotos } from "./issue-forms";

const input = "h-9 rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";
const btn = "h-9 rounded-md bg-ink px-4 text-[13.5px] font-medium text-white disabled:opacity-40";
const num = (v: string) => v.replace(/[^\d.]/g, "");

export function CountSafe({ storeId, started }: { storeId: string; started: boolean }) {
  const [f, setF] = useState({ counted: "", note: "" });
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap items-end gap-2 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await countSafeAction(storeId, Number(f.counted), f.note); if (r.ok) { toast.success(r.message ?? "Counted"); setF({ counted: "", note: "" }); } else toast.error(r.error); }); }}>
      <label className="text-[12.5px] text-muted">{started ? "Cash counted in the safe (Rs)" : "Cash in the safe now (Rs): starts the cash book"}<input className={cn(input, "mt-1 block w-44 text-right")} inputMode="decimal" value={f.counted} onChange={(e) => setF({ ...f, counted: num(e.target.value) })} aria-label="Cash counted" /></label>
      <input className={cn(input, "min-w-48 flex-1")} placeholder="Note (needed if it doesn't match)" aria-label="Count note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <button className={btn} disabled={pending || f.counted === ""}>{pending ? "Saving…" : "Save count"}</button>
    </form>
  );
}

export function RecordDeposit({ storeId, today }: { storeId: string; today: string }) {
  const blank = { amount: "", bank: "", slipNo: "", depositedOn: today, slip: [] as string[] };
  const [f, setF] = useState(blank);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-2 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await recordDepositAction({ storeId, amount: Number(f.amount), bank: f.bank, slipNo: f.slipNo, depositedOn: f.depositedOn, slipPhoto: f.slip[0] }); if (r.ok) { toast.success("Deposit recorded"); setF(blank); } else toast.error(r.error); }); }}>
      <div className="flex flex-wrap gap-2">
        <input className={cn(input, "w-36 text-right")} placeholder="Amount (Rs)" inputMode="decimal" aria-label="Deposit amount" value={f.amount} onChange={(e) => setF({ ...f, amount: num(e.target.value) })} />
        <input className={cn(input, "w-40")} placeholder="Bank" aria-label="Bank" value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} />
        <input className={cn(input, "w-36")} placeholder="Slip number" aria-label="Slip number" value={f.slipNo} onChange={(e) => setF({ ...f, slipNo: e.target.value })} />
        <input type="date" max={today} className={input} aria-label="Deposited on" value={f.depositedOn} onChange={(e) => setF({ ...f, depositedOn: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2"><IssuePhotos value={f.slip} onChange={(slip) => setF((c) => ({ ...c, slip }))} max={1} purpose="cash" label="Photo of the deposit slip" /><button className={btn} disabled={pending || !f.amount || !f.bank || !f.slipNo}>{pending ? "Saving…" : "Record deposit"}</button></div>
    </form>
  );
}

const CATS = [["OTHER", "Other"], ["UTILITIES", "Utilities"], ["PACKAGING", "Packaging"], ["DELIVERY", "Courier"], ["EQUIPMENT", "Small equipment"], ["MARKETING", "Marketing"], ["FEES", "Fees"]] as const;

export function PettyCash({ storeId, max }: { storeId: string; max: string }) {
  const blank = { amount: "", category: "OTHER" as (typeof CATS)[number][0], description: "", receipt: [] as string[] };
  const [f, setF] = useState(blank);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-2 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await pettyAction({ storeId, amount: Number(f.amount), category: f.category, description: f.description, receipt: f.receipt[0] }); if (r.ok) { toast.success("Spend recorded"); setF(blank); } else toast.error(r.error); }); }}>
      <div className="flex flex-wrap gap-2">
        <input className={cn(input, "w-32 text-right")} placeholder="Amount (Rs)" inputMode="decimal" aria-label="Petty amount" value={f.amount} onChange={(e) => setF({ ...f, amount: num(e.target.value) })} />
        <select className={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as typeof f.category })} aria-label="Petty category">{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input className={cn(input, "min-w-48 flex-1")} placeholder="What for, e.g. tea for staff, cleaning" aria-label="Petty description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2"><IssuePhotos value={f.receipt} onChange={(receipt) => setF((c) => ({ ...c, receipt }))} max={1} purpose="cash" label="Photo of the receipt" /><span className="flex items-center gap-2"><span className="text-[12px] text-muted">up to {max}</span><button className={btn} disabled={pending || !f.amount || f.description.trim().length < 3}>{pending ? "Saving…" : "Record spend"}</button></span></div>
    </form>
  );
}

export function CheckDeposit({ id, amount }: { id: string; amount: number }) {
  const [diff, setDiff] = useState(false);
  const [f, setF] = useState({ bank: String(amount / 100), note: "" });
  const [pending, start] = useTransition();
  const go = (bankRupees: number, note: string) => start(async () => { const r = await checkDepositAction(id, bankRupees, note); if (r.ok) toast.success("Checked"); else toast.error(r.error); });
  if (!diff) return <span className="flex gap-1.5"><button className="h-8 rounded-md bg-ink px-3 text-[13px] text-white disabled:opacity-40" disabled={pending} onClick={() => go(amount / 100, "")}>On the statement</button><button className="h-8 rounded-md border border-line px-3 text-[13px]" onClick={() => setDiff(true)}>Different</button></span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input className={cn(input, "h-8 w-28 text-right")} value={f.bank} onChange={(e) => setF({ ...f, bank: num(e.target.value) })} aria-label="Amount on the bank statement" inputMode="decimal" />
      <input className={cn(input, "h-8 w-48")} placeholder="What the bank showed" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} aria-label="Bank note" />
      <button className="h-8 rounded-md bg-danger px-3 text-[13px] text-white disabled:opacity-40" disabled={pending || !f.note.trim()} onClick={() => go(Number(f.bank) || 0, f.note)}>Save</button>
    </span>
  );
}
