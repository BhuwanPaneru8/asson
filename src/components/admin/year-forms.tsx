"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { closeYearAction, reopenYearAction, startYearAction } from "@/actions/admin/year";

const input = "h-9 rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";

export function StartYear({ guess }: { guess: { label: string; from: string; to: string } }) {
  const [f, setF] = useState(guess);
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap items-end gap-2 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await startYearAction(f.label, f.from, f.to); if (r.ok) toast.success(`FY ${f.label} set up`); else toast.error(r.error); }); }}>
      <label className="text-[12.5px] text-muted">Fiscal year<input className={`${input} mt-1 block w-28`} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} aria-label="Fiscal year" /></label>
      <label className="text-[12.5px] text-muted">Shrawan 1 (AD)<input type="date" className={`${input} mt-1 block`} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="First day of the year" /></label>
      <label className="text-[12.5px] text-muted">Last day of Ashadh (AD)<input type="date" className={`${input} mt-1 block`} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="Last day of the year" /></label>
      <button className="h-9 rounded-md bg-ink px-4 text-[13.5px] font-medium text-white disabled:opacity-40" disabled={pending || !f.from || !f.to}>Set up</button>
      <p className="w-full text-[12px] text-muted">Check both dates against the official calendar: Shrawan 1 moves between 15 and 18 July.</p>
    </form>
  );
}

export function CloseYear({ label, warnings, disabled }: { label: string; warnings: number; disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className="h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40" disabled={pending || disabled} onClick={() => {
      if (!confirm(`${warnings ? `${warnings} warning(s) are still open. ` : ""}Close FY ${label}? Its figures are recorded as they stand.`)) return;
      start(async () => { const r = await closeYearAction(label); if (r.ok) toast.success(`FY ${label} closed`); else toast.error(r.error); });
    }}>{pending ? "Closing…" : `Close FY ${label}`}</button>
  );
}

export function ReopenYear({ label }: { label: string }) {
  const [why, setWhy] = useState("");
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input className={`${input} w-64`} placeholder="Why reopen? e.g. auditor's adjustment" value={why} onChange={(e) => setWhy(e.target.value)} aria-label="Reason to reopen the year" />
      <button className="h-9 rounded-md border border-line px-3 text-[13.5px] hover:border-ink disabled:opacity-40" disabled={pending || !why.trim()} onClick={() => start(async () => { const r = await reopenYearAction(label, why); if (r.ok) toast.success("Reopened"); else toast.error(r.error); })}>Reopen</button>
    </span>
  );
}
