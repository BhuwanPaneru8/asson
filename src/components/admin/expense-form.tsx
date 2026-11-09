"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addExpense } from "@/actions/admin/finance";

const CATS = [["RENT", "Rent"], ["SALARIES", "Salaries & wages"], ["UTILITIES", "Utilities"], ["MARKETING", "Marketing & ads"], ["PACKAGING", "Packaging"], ["DELIVERY", "Courier & delivery"], ["EQUIPMENT", "Equipment & fit-out"], ["FEES", "Bank / wallet / govt fees"], ["OTHER", "Other"]] as const;
const input = "h-9 rounded-md border border-line bg-white px-2 text-[13.5px] outline-none focus:border-ink";

export function ExpenseForm({ defaultDate }: { defaultDate: string }) {
  const [f, setF] = useState({ date: defaultDate, category: "RENT" as (typeof CATS)[number][0], amount: "", description: "", paidVia: "" });
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
      <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Description" aria-label="Description" className={`${input} min-w-48 flex-1`} />
      <input value={f.paidVia} onChange={(e) => setF({ ...f, paidVia: e.target.value })} placeholder="Paid via (cash, bank…)" aria-label="Paid via" className={`${input} w-40`} />
      <input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.-]/g, "") })} placeholder="Rs" inputMode="decimal" aria-label="Amount" className={`${input} w-28 text-right`} />
      <button disabled={pending} className="h-9 rounded-md bg-ink px-4 text-[13.5px] text-white disabled:opacity-50">Add</button>
      <p className="w-full text-[12px] text-muted">Expenses are never deleted. To correct one, add the same category with a negative amount.</p>
    </form>
  );
}
