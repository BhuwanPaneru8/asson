"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adjustPayslip, approvePayroll, buildPayroll, confirmTaxBands, payPayroll, reopenPayroll, saveCommissionRule, savePayTerms, saveTaxBands } from "@/actions/admin/payroll";
import { TEMPLATE_2082, type Band } from "@/lib/payroll-rules";
import { cn } from "@/lib/utils";
import { Card } from "./ui";

const input = "h-9 w-full rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";
const btn = "h-9 rounded-md bg-ink px-3 text-[13.5px] font-medium text-white disabled:opacity-40";
const ghost = "h-9 rounded-md border border-line px-3 text-[13.5px] hover:border-ink disabled:opacity-40";
const num = (v: string) => v.replace(/[^\d.]/g, "");
type Res = { ok: boolean; error?: string };

function useRun() {
  const [pending, start] = useTransition();
  return { pending, run: (f: () => Promise<Res | undefined>, ok: string) => start(async () => { const r = await f(); if (!r || r.ok) { if (r) toast.success(ok); } else toast.error(r.error); }) };
}

export function BuildPayroll({ months }: { months: string[] }) {
  const [month, setMonth] = useState(months[0]);
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={cn(input, "w-36")} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Payroll month">{months.map((m) => <option key={m}>{m}</option>)}</select>
      <button className={btn} disabled={pending} onClick={() => run(() => buildPayroll(month), "Built")}>{pending ? "Building…" : "Build payroll"}</button>
    </div>
  );
}

type Terms = { basic: number; allowance: number; inSsf: boolean; married: boolean; active: boolean; pan: string; bankAccount: string; joinedOn: string };

export function PayTermsRow({ userId, name, role, terms }: { userId: string; name: string; role: string; terms: Terms | null }) {
  const [f, setF] = useState({ basic: terms ? String(terms.basic / 100) : "", allowance: terms ? String(terms.allowance / 100) : "0", inSsf: terms?.inSsf ?? true, married: terms?.married ?? false, active: terms?.active ?? true, pan: terms?.pan ?? "", bankAccount: terms?.bankAccount ?? "", joinedOn: terms?.joinedOn ?? "" });
  const { pending, run } = useRun();
  return (
    <tr className="align-top">
      <td className="px-4 py-2.5 text-[13.5px]"><span className="font-medium">{name}</span><span className="block text-[12px] text-muted">{role}</span></td>
      <td className="px-2 py-2"><input className={cn(input, "w-28 text-right")} value={f.basic} onChange={(e) => setF({ ...f, basic: num(e.target.value) })} inputMode="decimal" aria-label={`${name} basic salary`} /></td>
      <td className="px-2 py-2"><input className={cn(input, "w-24 text-right")} value={f.allowance} onChange={(e) => setF({ ...f, allowance: num(e.target.value) })} inputMode="decimal" aria-label={`${name} allowance`} /></td>
      <td className="px-2 py-2 text-[13px]"><label className="flex items-center gap-1.5"><input type="checkbox" className="accent-ink" checked={f.inSsf} onChange={(e) => setF({ ...f, inSsf: e.target.checked })} /> SSF</label><label className="mt-1 flex items-center gap-1.5"><input type="checkbox" className="accent-ink" checked={f.married} onChange={(e) => setF({ ...f, married: e.target.checked })} /> Married</label></td>
      <td className="px-2 py-2"><input className={cn(input, "w-28")} value={f.pan} onChange={(e) => setF({ ...f, pan: e.target.value.replace(/\D/g, "").slice(0, 9) })} inputMode="numeric" placeholder="9 digits" aria-label={`${name} PAN`} /><input className={cn(input, "mt-1 w-28")} value={f.bankAccount} onChange={(e) => setF({ ...f, bankAccount: e.target.value })} placeholder="Bank a/c" aria-label={`${name} bank account`} /></td>
      <td className="px-2 py-2 text-[13px]"><label className="flex items-center gap-1.5"><input type="checkbox" className="accent-ink" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> On payroll</label></td>
      <td className="px-4 py-2 text-right"><button className={btn} disabled={pending || !f.basic} onClick={() => run(() => savePayTerms(userId, { ...f, basic: Number(f.basic), allowance: Number(f.allowance) || 0 }), `${name} saved`)}>Save</button></td>
    </tr>
  );
}

function BandsEditor({ title, bands, onChange }: { title: string; bands: Band[]; onChange: (b: Band[]) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold">{title}</p>
      <div className="space-y-1.5">
        {bands.map((b, i) => (
          <div key={i} className="flex items-center gap-2 text-[13px]">
            <span className="w-16 text-muted">{i === 0 ? "Up to" : i === bands.length - 1 ? "Above" : "Up to"}</span>
            {i === bands.length - 1 ? <span className="w-32 text-muted">the rest</span> : <input className={cn(input, "w-32 text-right")} value={b.upTo ?? ""} onChange={(e) => onChange(bands.map((x, j) => (j === i ? { ...x, upTo: Number(num(e.target.value)) || 0 } : x)))} inputMode="numeric" aria-label={`${title} band ${i + 1} limit`} />}
            <input className={cn(input, "w-16 text-right")} value={b.rate} onChange={(e) => onChange(bands.map((x, j) => (j === i ? { ...x, rate: Number(num(e.target.value)) || 0 } : x)))} inputMode="decimal" aria-label={`${title} band ${i + 1} rate`} /><span className="text-muted">%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TaxYearEditor({ fiscalYear, initial, confirmed, source }: { fiscalYear: string; initial: { single: Band[]; married: Band[]; ssfFirstBandZero: boolean } | null; confirmed: boolean; source: string }) {
  const [d, setD] = useState(initial ?? TEMPLATE_2082);
  const [src, setSrc] = useState(source);
  const { pending, run } = useRun();
  return (
    <Card title={`FY ${fiscalYear} · ${confirmed ? "confirmed" : initial ? "saved, not confirmed" : "not set"}`}>
      <div className="space-y-4 p-4">
        {!initial && <p className="rounded-md bg-cloud p-3 text-[13px] text-ink-soft">Filled in with the FY 2082/83 bands as widely published. Sources disagree about FY 2083/84, so have your accountant check every figure against the Finance Act before confirming.</p>}
        <div className="grid gap-4 sm:grid-cols-2"><BandsEditor title="Single" bands={d.single} onChange={(single) => setD({ ...d, single })} /><BandsEditor title="Married couple" bands={d.married} onChange={(married) => setD({ ...d, married })} /></div>
        <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" className="accent-ink" checked={d.ssfFirstBandZero} onChange={(e) => setD({ ...d, ssfFirstBandZero: e.target.checked })} /> SSF members pay 0% in the first band (no 1% social security tax)</label>
        <label className="block text-[12.5px] text-muted">Source (Finance Act section, IRD notice, accountant)<input className={cn(input, "mt-1")} value={src} onChange={(e) => setSrc(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          <button className={ghost} disabled={pending} onClick={() => run(() => saveTaxBands({ fiscalYear, ...d, source: src }), "Saved: confirm when checked")}>Save</button>
          {initial && !confirmed && <button className={btn} disabled={pending} onClick={() => confirm(`Confirm these bands for FY ${fiscalYear}? Payroll will use them.`) && run(() => confirmTaxBands(fiscalYear), "Confirmed")}>Confirm for payroll</button>}
        </div>
      </div>
    </Card>
  );
}

export function SlipAdjust({ id, bonus, extraUnpaidDays, note }: { id: string; bonus: number; extraUnpaidDays: number; note: string }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ bonus: String(bonus / 100), extra: String(extraUnpaidDays), note });
  const { pending, run } = useRun();
  if (!open) return <button className="text-[13px] underline underline-offset-4" onClick={() => setOpen(true)}>Adjust</button>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-[12px] text-muted">Bonus Rs.<input className={cn(input, "w-24")} value={f.bonus} onChange={(e) => setF({ ...f, bonus: num(e.target.value) })} inputMode="decimal" /></label>
      <label className="text-[12px] text-muted">Extra unpaid days<input className={cn(input, "w-20")} value={f.extra} onChange={(e) => setF({ ...f, extra: e.target.value.replace(/\D/g, "") })} inputMode="numeric" /></label>
      <label className="text-[12px] text-muted">Note<input className={cn(input, "w-40")} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      <button className={btn} disabled={pending} onClick={() => run(() => adjustPayslip(id, { bonus: Number(f.bonus) || 0, extraUnpaidDays: Number(f.extra) || 0, note: f.note }), "Updated")}>Save</button>
    </div>
  );
}

export function RunActions({ month, status }: { month: string; status: "DRAFT" | "APPROVED" | "PAID" }) {
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && <><button className={ghost} disabled={pending} onClick={() => run(() => buildPayroll(month), "Rebuilt")}>Rebuild from timesheet</button><button className={btn} disabled={pending} onClick={() => confirm(`Approve ${month} payroll? Payslips will be frozen.`) && run(() => approvePayroll(month), "Approved")}>Approve</button></>}
      {status === "APPROVED" && <><button className={ghost} disabled={pending} onClick={() => { const why = prompt("Reopen for changes. Why?"); if (why) run(() => reopenPayroll(month, why), "Reopened"); }}>Reopen</button><button className={btn} disabled={pending} onClick={() => { const via = prompt("Salaries paid how? (e.g. Bank transfer, Cash)", "Bank transfer"); if (via) run(() => payPayroll(month, via), "Marked paid: cost posted to expenses"); }}>Mark salaries paid</button></>}
    </div>
  );
}

export function CommissionRuleRow({ storeId, label, rule }: { storeId: string | null; label: string; rule: { rateBp: number; threshold: number; active: boolean } | null }) {
  const [f, setF] = useState({ rate: rule ? String(rule.rateBp / 100) : "", threshold: rule ? String(rule.threshold / 100) : "0", active: rule?.active ?? true });
  const { pending, run } = useRun();
  return (
    <tr>
      <td className="px-4 py-2 text-[13.5px]">{label}{!rule && storeId && <span className="block text-[12px] text-muted">uses the rule for every shop</span>}</td>
      <td className="px-2 py-2"><div className="flex items-center gap-1"><input className={cn(input, "w-20 text-right")} value={f.rate} onChange={(e) => setF({ ...f, rate: num(e.target.value) })} inputMode="decimal" aria-label={`${label} rate`} /><span className="text-muted">%</span></div></td>
      <td className="px-2 py-2"><input className={cn(input, "w-32 text-right")} value={f.threshold} onChange={(e) => setF({ ...f, threshold: num(e.target.value) })} inputMode="decimal" aria-label={`${label} monthly target`} /></td>
      <td className="px-2 py-2 text-[13px]"><label className="flex items-center gap-1.5"><input type="checkbox" className="accent-ink" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> On</label></td>
      <td className="px-4 py-2 text-right"><button className={btn} disabled={pending || f.rate === ""} onClick={() => run(() => saveCommissionRule({ storeId, ratePct: Number(f.rate), threshold: Number(f.threshold) || 0, active: f.active }), `${label} saved`)}>Save</button></td>
    </tr>
  );
}
