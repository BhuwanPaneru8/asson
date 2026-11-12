"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelSwapAction, decideSwapAction, offerSwapAction, respondSwapAction } from "@/actions/admin/shift-swaps";
import { cn } from "@/lib/utils";

const input = "h-10 rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";
const btn = "h-9 rounded-md bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-40";
const ghost = "h-9 rounded-md border border-line bg-white px-3 text-[13px] hover:border-ink disabled:opacity-40";
type Colleague = { id: string; name: string; shifts: { id: string; label: string }[] };
type Req = { id: string; status: string; note: string; from: string; to: string; shift: string; back: string | null; decisionNote: string };

const done = (r: { ok: boolean; error?: string }, msg: string) => { if (r.ok) toast.success(msg); else toast.error(r.error); return r.ok; };

/** On one of my shifts: hand it to a colleague, or trade it for one of theirs. */
export function OfferSwap({ shiftId, colleagues }: { shiftId: string; colleagues: Colleague[] }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [back, setBack] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  if (!colleagues.length) return null;
  if (!open) return <button className="text-[12.5px] text-muted underline underline-offset-4 hover:text-ink" onClick={() => setOpen(true)}>Swap</button>;
  const c = colleagues.find((x) => x.id === to);
  return (
    <div className="mt-2 grid w-full gap-2 sm:grid-cols-2">
      <select className={input} value={to} onChange={(e) => { setTo(e.target.value); setBack(""); }} aria-label="Colleague"><option value="">Choose a colleague</option>{colleagues.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select className={input} value={back} onChange={(e) => setBack(e.target.value)} disabled={!c} aria-label="In return"><option value="">Give it to them (nothing back)</option>{c?.shifts.map((s) => <option key={s.id} value={s.id}>Swap for their {s.label}</option>)}</select>
      <input className={cn(input, "sm:col-span-2")} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Swap note" />
      <div className="flex gap-2 sm:col-span-2">
        <button className={btn} disabled={pending || !to} onClick={() => start(async () => { if (done(await offerSwapAction({ shiftId, toUserId: to, backShiftId: back || null, note }), "Asked: they accept, then a manager approves")) setOpen(false); })}>Ask them</button>
        <button className={ghost} onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}

function Line({ r, who }: { r: Req; who: "from" | "to" | "manager" }) {
  return <span className="min-w-0">{r.back ? <><b>{r.from}</b> {r.shift} ⇄ <b>{r.to}</b> {r.back}</> : <><b>{r.from}</b> gives {r.shift} to <b>{r.to}</b></>}{r.note && <span className="block text-[12px] text-muted">“{r.note}”</span>}{who !== "manager" && r.decisionNote && <span className="block text-[12px] text-muted">Manager: {r.decisionNote}</span>}</span>;
}

/** Requests I'm part of, on Today. */
export function MySwaps({ forMe, mine, recent }: { forMe: Req[]; mine: Req[]; recent: Req[] }) {
  const [pending, start] = useTransition();
  return (
    <ul className="divide-y divide-line text-[13.5px]">
      {forMe.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 bg-accent-soft/40 px-5 py-2.5"><Line r={r} who="to" />
          <span className="flex gap-2"><button className={btn} disabled={pending} onClick={() => start(async () => { done(await respondSwapAction(r.id, true), "Accepted: a manager approves it next"); })}>Accept</button><button className={ghost} disabled={pending} onClick={() => start(async () => { done(await respondSwapAction(r.id, false), "Declined"); })}>Decline</button></span>
        </li>
      ))}
      {mine.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5"><Line r={r} who="from" />
          <span className="flex items-center gap-2"><span className="text-[12px] text-muted">{r.status === "OFFERED" ? `waiting for ${r.to}` : "waiting for a manager"}</span><button className={ghost} disabled={pending} onClick={() => start(async () => { done(await cancelSwapAction(r.id), "Withdrawn"); })}>Withdraw</button></span>
        </li>
      ))}
      {recent.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-muted"><Line r={r} who="from" /><span className={cn("text-[12px] font-medium", r.status === "APPROVED" ? "text-success" : "text-danger")}>{r.status === "APPROVED" ? "approved" : r.status === "DECLINED" ? "declined" : "not approved"}</span></li>
      ))}
    </ul>
  );
}

/** Managers: accepted swaps waiting for approval. */
export function ApproveSwaps({ rows }: { rows: Req[] }) {
  const [pending, start] = useTransition();
  if (!rows.length) return <p className="p-5 text-[14px] text-muted">No swaps waiting.</p>;
  return (
    <ul className="divide-y divide-line text-[13.5px]">{rows.map((r) => (
      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"><Line r={r} who="manager" />
        <span className="flex gap-2">
          <button className={btn} disabled={pending} onClick={() => start(async () => { done(await decideSwapAction(r.id, true), "Approved: the roster is updated"); })}>Approve</button>
          <button className={ghost} disabled={pending} onClick={() => { const note = prompt("Why not? (they'll see this)") ?? ""; start(async () => { done(await decideSwapAction(r.id, false, note), "Rejected"); }); }}>Reject</button>
        </span>
      </li>
    ))}</ul>
  );
}
