"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveStockCount, cancelStockCount } from "@/actions/admin/counts";

export function CountReview({ countId, canApprove, changes }: { countId: string; canApprove: boolean; changes: number }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  if (!canApprove) return <p className="rounded-lg border border-line bg-white p-4 text-[14px] text-muted">Submitted. A manager or the owner reviews and approves the differences.</p>;
  const approve = () => {
    if (!confirm(changes ? `Apply ${changes} stock change${changes > 1 ? "s" : ""} from this count?` : "Approve this count? Nothing is different, so no stock changes.")) return;
    start(async () => {
      const r = await approveStockCount(countId, note);
      if (r.ok) toast.success(`Approved: +${r.plus} / −${r.minus} units`); else toast.error(r.error);
    });
  };
  const cancel = () => {
    const why = prompt("Why reject this count? Nothing will change; start a new count to recount.");
    if (why) start(async () => { const r = await cancelStockCount(countId, why); if (r.ok) toast.success("Count rejected"); else toast.error(r.error); });
  };
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (e.g. what explains the big differences)" aria-label="Approval note" className="w-full rounded-md border border-line p-2 text-[14px]" />
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button disabled={pending} onClick={cancel} className="h-10 rounded-md px-4 text-[14px] text-muted hover:bg-cloud hover:text-danger">Reject</button>
        <button disabled={pending} onClick={approve} className="h-10 rounded-md bg-ink px-5 text-[14px] font-medium text-white disabled:opacity-40">{pending ? "Applying…" : "Approve and adjust stock"}</button>
      </div>
    </div>
  );
}
