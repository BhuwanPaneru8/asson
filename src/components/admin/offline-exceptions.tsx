"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resolvePosException } from "@/actions/pos-offline";
import { formatDateTime, formatOrderNumber } from "@/lib/utils";

export type OfflineException = { id: string; label: string; detail: string; at: string; order: { id: string; number: number; soldAt: string } };

/** Closing page: what came in from tills that were offline and needs a manager's eye. Each one is ticked off with a note. */
export function OfflineExceptions({ rows }: { rows: OfflineException[] }) {
  return (
    <section aria-labelledby="offline-to-check" className="mt-4 rounded-lg border border-line bg-white">
      <h2 id="offline-to-check" className="border-b border-line px-5 py-3 text-[15px] font-semibold">Offline sales to check</h2>
      <p className="px-5 pt-3 text-[13px] text-muted">Sales made while a till had no internet reach the server later. These need checking: count the shelf, or tell the owner about a late sale.</p>
      <ul className="divide-y divide-line">
        {rows.map((r) => <Row key={r.id} r={r} />)}
      </ul>
    </section>
  );
}

function Row({ r }: { r: OfflineException }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <li className="px-5 py-3 text-[13.5px]">
      <p><Link href={`/admin/orders/${r.order.id}`} className="font-medium hover:underline">{formatOrderNumber(r.order.number)}</Link> <span className="text-muted">· sold {formatDateTime(r.order.soldAt)} · {r.label}</span></p>
      <p className="mt-0.5">{r.detail}</p>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const res = await resolvePosException({ id: r.id, note }); if (res.ok) toast.success("Marked as checked"); else toast.error(res.error); }); }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you checked or did" aria-label={`What you checked for ${formatOrderNumber(r.order.number)}`} className="h-9 min-w-0 flex-1 rounded-md border border-line px-2.5" />
        <button disabled={pending} className="h-9 rounded-md border border-line px-3 font-medium hover:border-ink disabled:opacity-50">{pending ? "Saving…" : "Checked"}</button>
      </form>
    </li>
  );
}
