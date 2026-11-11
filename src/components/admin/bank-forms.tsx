"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { importStatementAction, previewStatement, resolveLineAction } from "@/actions/admin/bank";
import { cn, formatPrice } from "@/lib/utils";

const input = "h-9 rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";
const btn = "h-9 rounded-md bg-ink px-4 text-[13.5px] font-medium text-white disabled:opacity-40";

type Preview = Extract<Awaited<ReturnType<typeof previewStatement>>, { ok: true }>;

export function StatementImport({ accounts }: { accounts: string[] }) {
  const [account, setAccount] = useState(accounts[0] ?? "");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[12.5px] text-muted">Bank account<input className={cn(input, "mt-1 block w-56")} list="bank-accounts" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="e.g. NIC Asia current" aria-label="Bank account" /></label>
        <datalist id="bank-accounts">{accounts.map((a) => <option key={a} value={a} />)}</datalist>
        <label className="flex h-9 cursor-pointer items-center rounded-md border border-dashed border-line px-3 text-[13.5px] hover:border-ink">{name || "Choose the CSV export"}<input type="file" accept=".csv,text/csv" hidden aria-label="Statement file" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          const t = await f.text(); setText(t); setName(f.name); setPreview(null);
          start(async () => { const r = await previewStatement(t); if (r.ok) setPreview(r); else toast.error(r.error); });
        }} /></label>
      </div>
      {preview && (
        <div className="rounded-md bg-cloud/60 p-3 text-[13px]">
          <p><b>{preview.lines}</b> transactions{preview.from ? `, ${preview.from} to ${preview.to}` : ""} · <b>{preview.credits}</b> credits totalling <b>{formatPrice(preview.creditTotal)}</b>{preview.skipped ? ` · ${preview.skipped} line(s) skipped (balances, totals)` : ""}</p>
          <p className="mt-1 text-muted">Columns found: {Object.entries(preview.columns).filter(([, v]) => v).map(([k, v]) => `${k} = “${v}”`).join(", ")}</p>
          <ul className="mt-2 space-y-0.5 font-mono text-[12px]">{preview.sample.map((l, i) => <li key={i}>{l.date} {l.amount > 0 ? "+" : ""}{formatPrice(l.amount)} {l.description}</li>)}</ul>
        </div>
      )}
      <button className={btn} disabled={pending || !preview || account.trim().length < 2} onClick={() => start(async () => {
        const r = await importStatementAction(account, text);
        if (r.ok) { toast.success(`${r.added} new line(s) · ${r.deposits} deposit(s), ${r.remittances} COD remittance(s), ${r.payments} supplier payment(s), ${r.expenses} expense(s), ${r.vat} VAT and ${r.statutory} TDS/SSF payment(s) matched${r.leftForOthers ? ` · ${r.leftForOthers} of your own deposits left for someone else` : ""}`); setPreview(null); setText(""); setName(""); } else toast.error(r.error);
      })}>{pending ? "Working…" : "Import and match"}</button>
      <p className="text-[12px] text-muted">Importing the same file twice adds nothing. Deposits are matched by bank, amount and date (slip numbers settle ties); courier COD remittances by amount and date. Nothing ambiguous is guessed.</p>
    </div>
  );
}

type Opt = { id: string; label: string };
const BOOK = [["FEES", "Bank charge / fee"], ["UTILITIES", "Utility"], ["RENT", "Rent"], ["MARKETING", "Marketing"], ["DELIVERY", "Courier"], ["EQUIPMENT", "Equipment"], ["OTHER", "Other"]] as const;

export function ResolveLine({ lineId, debit, deposits, remittances, payments, expenses, vat = [], statutory = [] }: { lineId: string; debit: boolean; deposits: Opt[]; remittances: Opt[]; payments: Opt[]; expenses: Opt[]; vat?: Opt[]; statutory?: Opt[] }) {
  const [choice, setChoice] = useState("");
  const [why, setWhy] = useState("");
  const [cat, setCat] = useState<(typeof BOOK)[number][0]>("FEES");
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    const [kind, id] = choice.split(":");
    const r = await resolveLineAction({
      lineId,
      ...(kind === "d" ? { depositId: id } : kind === "r" ? { remittanceId: id } : kind === "p" ? { paymentId: id } : kind === "e" ? { expenseId: id } : kind === "v" ? { vatReturnId: id } : kind === "s" ? { statutoryId: id } : kind === "book" ? { book: { category: cat, description: why } } : { ignore: why }),
    });
    if (r.ok) toast.success("Done"); else toast.error(r.error);
  });
  const needsText = choice === "ignore" || choice === "book";
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <select className={cn(input, "h-8 max-w-72 text-[13px]")} value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Explain this line">
        <option value="">What is it?</option>
        {deposits.length > 0 && <optgroup label="Shop deposit">{deposits.map((d) => <option key={d.id} value={`d:${d.id}`}>{d.label}</option>)}</optgroup>}
        {remittances.length > 0 && <optgroup label="Courier COD">{remittances.map((r) => <option key={r.id} value={`r:${r.id}`}>{r.label}</option>)}</optgroup>}
        {payments.length > 0 && <optgroup label="Supplier payment">{payments.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.label}</option>)}</optgroup>}
        {expenses.length > 0 && <optgroup label="Recorded expense">{expenses.map((e) => <option key={e.id} value={`e:${e.id}`}>{e.label}</option>)}</optgroup>}
        {statutory.length > 0 && <optgroup label="Payroll TDS / SSF">{statutory.map((d) => <option key={d.id} value={`s:${d.id}`}>{d.label}</option>)}</optgroup>}
        {vat.length > 0 && <optgroup label="VAT payment">{vat.map((v) => <option key={v.id} value={`v:${v.id}`}>{v.label}</option>)}</optgroup>}
        {debit && <option value="book">Book it as an expense</option>}
        <option value="ignore">Something else (say what)</option>
      </select>
      {choice === "book" && <select className={cn(input, "h-8 text-[13px]")} value={cat} onChange={(e) => setCat(e.target.value as typeof cat)} aria-label="Expense category">{BOOK.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
      {needsText && <input className={cn(input, "h-8 w-48 text-[13px]")} placeholder={choice === "book" ? "e.g. bank service charge" : debit ? "e.g. salary batch, owner drawing" : "e.g. interest, wallet settlement"} value={why} onChange={(e) => setWhy(e.target.value)} aria-label={choice === "book" ? "What the expense was" : "What this money is"} />}
      <button className="h-8 rounded-md bg-ink px-3 text-[13px] text-white disabled:opacity-40" disabled={pending || !choice || (needsText && why.trim().length < (choice === "book" ? 3 : 1))} onClick={go}>Save</button>
    </span>
  );
}
