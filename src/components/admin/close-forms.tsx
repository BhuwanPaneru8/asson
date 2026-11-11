"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { closeMonthAction, reopenMonthAction } from "@/actions/admin/close";

export function CloseMonthButton({ month, warnings, disabled }: { month: string; warnings: number; disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className="h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40" disabled={pending || disabled} onClick={() => {
      if (!confirm(warnings ? `${warnings} warning(s) are still open. Close ${month} anyway? Nothing dated in ${month} can be added or changed until it's reopened.` : `Close ${month}? Nothing dated in it can be added or changed until it's reopened.`)) return;
      start(async () => { const r = await closeMonthAction(month, true); if (r.ok) toast.success(`${month} closed`); else toast.error(r.error); });
    }}>{pending ? "Closing…" : `Close ${month}`}</button>
  );
}

export function ReopenMonth({ month }: { month: string }) {
  const [why, setWhy] = useState("");
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input className="h-10 w-72 rounded-md border border-line bg-white px-3 text-[14px]" placeholder="Why reopen? e.g. late invoice from the landlord" value={why} onChange={(e) => setWhy(e.target.value)} aria-label="Reason to reopen" />
      <button className="h-10 rounded-md border border-line px-4 text-[14px] hover:border-ink disabled:opacity-40" disabled={pending || !why.trim()} onClick={() => start(async () => { const r = await reopenMonthAction(month, why); if (r.ok) { toast.success(`${month} reopened`); setWhy(""); } else toast.error(r.error); })}>Reopen</button>
    </span>
  );
}
