"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { lockDay } from "@/actions/pos";

export function LockDayForm({ date, storeId, ready, hasDifference }: { date: string; storeId: string; ready: boolean; hasDifference: boolean }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mt-4 rounded-lg border border-line bg-white p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Lock className="h-4 w-4" /> Lock the day</h2>
      <p className="mt-1 text-[13.5px] text-muted">Locking freezes today&apos;s figures. No new shifts can be opened for this date afterwards.</p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={hasDifference ? "Explain the cash difference (required)" : "Closing note (optional)"} aria-label="Closing note" className="mt-3 w-full rounded-md border border-line p-2.5 text-[14px]" />
      <button disabled={!ready || pending} onClick={() => { if (!confirm("Lock this day? This can't be undone.")) return; start(async () => { const r = await lockDay(date, note, storeId); if (r.ok) toast.success("Day locked"); else toast.error(r.error); }); }} className="mt-3 h-10 rounded-md bg-ink px-5 text-[14px] font-medium text-white disabled:opacity-40">
        {ready ? "Lock day" : "Close all shifts first"}
      </button>
    </div>
  );
}
