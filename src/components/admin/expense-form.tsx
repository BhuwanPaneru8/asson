"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addExpense, saveRecurring } from "@/actions/admin/finance";

const CATS = [["RENT", "Rent"], ["SALARIES", "Salaries & wages"], ["UTILITIES", "Utilities"], ["MARKETING", "Marketing & ads"], ["PACKAGING", "Packaging"], ["DELIVERY", "Courier & delivery"], ["EQUIPMENT", "Equipment & fit-out"], ["FEES", "Bank / wallet / govt fees"], ["OTHER", "Other"]] as const;
const input = "h-9 rounded-md border border-line bg-white px-2 text-[13.5px] outline-none focus:border-ink";

export function ExpenseForm({ defaultDate, locations }: { defaultDate: string; locations: { id: string; name: string }[] }) {
  const [f, setF] = useState({ date: defaultDate, category: "RENT" as (typeof CATS)[number][0], amount: "", description: "", paidVia: "", storeId: "" });
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await addExpense({ ...f, amount: Math.round(Number(f.amount) * 100) });
      if (r.ok) { toast.success("Expense recorded"); setF({ ...f, amount: "", description: "", paidVia: "" }); } else toast.error(r.error);
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-b border-line p-4">
      <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Date" className={input} />
      <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as typeof f.category })} aria-label="Category" className={input}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })} aria-label="Location" className={input}><option value="">HQ / central</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Description" aria-label="Description" className={`${input} min-w-48 flex-1`} />
      <input value={f.paidVia} onChange={(e) => setF({ ...f, paidVia: e.target.value })} placeholder="Paid via (cash, bank…)" aria-label="Paid via" className={`${input} w-40`} />
      <input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.-]/g, "") })} placeholder="Rs" inputMode="decimal" aria-label="Amount" className={`${input} w-28 text-right`} />
      <button disabled={pending} className="h-9 rounded-md bg-ink px-4 text-[13.5px] text-white disabled:opacity-50">Add</button>
      <p className="w-full text-[12px] text-muted">Expenses are never deleted. To correct one, add the same category with a negative amount.</p>
    </form>
  );
}

export function RecurringForm({ locations, thisMonth, initial }: { locations: { id: string; name: string }[]; thisMonth: string; initial?: { id: string; storeId: string | null; category: string; amount: number; description: string; startMonth: string; endMonth: string | null; active: boolean } }) {
  const blank = { storeId: "", category: "RENT", amount: "", description: "", startMonth: thisMonth, endMonth: "", active: true };
  const [f, setF] = useState(initial ? { ...initial, storeId: initial.storeId ?? "", amount: String(initial.amount / 100), endMonth: initial.endMonth ?? "" } : blank);
  const [open, setOpen] = useState(!initial);
  const [pending, start] = useTransition();
  if (!open) return <button className="text-[13px] underline underline-offset-4" onClick={() => setOpen(true)}>Edit</button>;
  return (
    <form className="flex flex-wrap items-end gap-2 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await saveRecurring({ id: initial?.id, storeId: f.storeId, category: f.category as "RENT", amount: Math.round(Number(f.amount) * 100), description: f.description, startMonth: f.startMonth, endMonth: f.endMonth, active: f.active });
      if (r.ok) { toast.success("Saved: this month's is posted"); if (initial) setOpen(false); else setF(blank); } else toast.error(r.error);
    }); }}>
      <select value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })} aria-label="Recurring location" className={input}><option value="">HQ / central</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Recurring category" className={input}>{CATS.filter(([v]) => v !== "SALARIES").map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Shop rent, internet" aria-label="Recurring description" className={`${input} min-w-40 flex-1`} />
      <input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} placeholder="Rs a month" inputMode="decimal" aria-label="Monthly amount" className={`${input} w-28 text-right`} />
      <label className="text-[12px] text-muted">From<input type="month" value={f.startMonth} onChange={(e) => setF({ ...f, startMonth: e.target.value })} aria-label="First month" className={`${input} ml-1 w-36`} /></label>
      <label className="text-[12px] text-muted">Until<input type="month" value={f.endMonth} onChange={(e) => setF({ ...f, endMonth: e.target.value })} aria-label="Last month" className={`${input} ml-1 w-36`} /></label>
      {initial && <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" className="accent-ink" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> On</label>}
      <button disabled={pending || !f.amount || f.description.trim().length < 2} className="h-9 rounded-md bg-ink px-4 text-[13.5px] text-white disabled:opacity-50">{initial ? "Save" : "Add monthly cost"}</button>
    </form>
  );
}
