"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { askForLeave, clockInAt, clockOutNow, decideLeaveRequest, decideMissedShift, fixAttendance, reopenMissedShift, withdrawLeave } from "@/actions/admin/people";
import { cn } from "@/lib/utils";
import { Card } from "./ui";

const input = "h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
const label = "mb-1 block text-[12.5px] font-medium text-ink-soft";
const btn = "h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40";
type Res = { ok: boolean; error?: string };

function useRun() {
  const [pending, start] = useTransition();
  const run = (f: () => Promise<Res>, ok: string, after?: () => void) => start(async () => { const r = await f(); if (r.ok) { toast.success(ok); after?.(); } else toast.error(r.error); });
  return { pending, run };
}

export function ClockCard({ open, locations, since }: { open: { storeName: string; since: string } | null; locations: { id: string; name: string }[]; since?: string }) {
  const [storeId, setStoreId] = useState(locations[0]?.id ?? "");
  const { pending, run } = useRun();
  return (
    <Card title={open ? `Clocked in at ${open.storeName}` : "Not clocked in"}>
      <div className="flex flex-wrap items-center gap-3 p-5">
        {open ? (
          <>
            <p className="flex-1 text-[14px] text-ink-soft">Since {open.since}{since ? ` · ${since}` : ""}</p>
            <button className={btn} disabled={pending} onClick={() => run(clockOutNow, "Clocked out")}>{pending ? "…" : "Clock out"}</button>
          </>
        ) : !locations.length ? (
          <p className="text-[14px] text-muted">You aren&apos;t assigned to a location yet. Ask the owner to add you under Customers &amp; team.</p>
        ) : (
          <>
            {locations.length > 1 && <select className={cn(input, "max-w-xs")} value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Where you are working">{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
            <button className={btn} disabled={pending || !storeId} onClick={() => run(() => clockInAt(storeId), "Clocked in")}>{pending ? "…" : `Clock in${locations.length === 1 ? ` at ${locations[0].name}` : ""}`}</button>
          </>
        )}
      </div>
    </Card>
  );
}

export function LeaveForm({ types, today }: { types: { key: string; label: string; left: number | null }[]; today: string }) {
  const [f, setF] = useState({ type: types[0]?.key ?? "", from: today, to: today, reason: "" });
  const { pending, run } = useRun();
  const t = types.find((x) => x.key === f.type);
  return (
    <Card title="Ask for leave">
      <form className="grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => askForLeave(f), "Request sent to your manager", () => setF({ ...f, reason: "" })); }}>
        <label className={cn(label, "sm:col-span-2")}>Type<select className={input} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{types.map((x) => <option key={x.key} value={x.key}>{x.label}{x.left != null ? ` (${x.left} left)` : ""}</option>)}</select></label>
        <label className={label}>First day<input type="date" className={input} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} /></label>
        <label className={label}>Last day<input type="date" className={input} value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label className={cn(label, "sm:col-span-2")}>Reason (optional)<input className={input} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={300} /></label>
        <div className="flex items-center justify-between gap-3 sm:col-span-2"><p className="text-[12.5px] text-muted">{t?.left != null ? `${t.left} day(s) of ${t.label.toLowerCase()} left this year.` : ""} Saturdays aren&apos;t counted.</p><button className={cn(btn, "shrink-0 whitespace-nowrap")} disabled={pending || !f.type}>{pending ? "Sending…" : "Send request"}</button></div>
      </form>
    </Card>
  );
}

export function WithdrawButton({ id }: { id: string }) {
  const { pending, run } = useRun();
  return <button className="text-[13px] text-danger underline-offset-4 hover:underline disabled:opacity-40" disabled={pending} onClick={() => confirm("Withdraw this request?") && run(() => withdrawLeave(id), "Withdrawn")}>Withdraw</button>;
}

export function DecideButtons({ id }: { id: string }) {
  const { pending, run } = useRun();
  return (
    <div className="flex gap-2">
      <button className="h-8 rounded-md bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-40" disabled={pending} onClick={() => run(() => decideLeaveRequest(id, true), "Approved")}>Approve</button>
      <button className="h-8 rounded-md border border-line px-3 text-[13px] disabled:opacity-40" disabled={pending} onClick={() => { const why = prompt("Why not? (they'll see this)"); if (why !== null) run(() => decideLeaveRequest(id, false, why), "Declined"); }}>Decline</button>
    </div>
  );
}

/** clockIn/clockOut as Nepal local "YYYY-MM-DDTHH:mm" */
export function FixEntryForm({ id, clockIn, clockOut }: { id: string; clockIn: string; clockOut: string }) {
  const [f, setF] = useState({ clockIn, clockOut, reason: "" });
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  if (!open) return <button className="text-[13px] underline underline-offset-4" onClick={() => setOpen(true)}>Fix</button>;
  return (
    <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => fixAttendance({ id, ...f }), "Corrected", () => setOpen(false)); }}>
      <label className="text-[12px] text-muted">In<input type="datetime-local" className={cn(input, "h-9")} value={f.clockIn} onChange={(e) => setF({ ...f, clockIn: e.target.value })} /></label>
      <label className="text-[12px] text-muted">Out<input type="datetime-local" className={cn(input, "h-9")} value={f.clockOut} onChange={(e) => setF({ ...f, clockOut: e.target.value })} /></label>
      <label className="min-w-48 flex-1 text-[12px] text-muted">Why<input className={cn(input, "h-9")} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. forgot to clock out, confirmed by manager" /></label>
      <button className="h-9 rounded-md bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-40" disabled={pending || f.reason.trim().length < 3}>Save</button>
    </form>
  );
}

/** One missed shift: unpaid, booked as leave (a type with days left), or worked (with how you know). */
export function AbsenceDecide({ id, name, leaveTypes }: { id: string; name: string; leaveTypes: { key: string; label: string; left: number | null }[] }) {
  const [mode, setMode] = useState<"" | "LEAVE" | "WORKED">("");
  const usable = leaveTypes.filter((t) => t.left == null || t.left >= 1);
  const [type, setType] = useState(usable[0]?.key ?? "");
  const [note, setNote] = useState("");
  const { pending, run } = useRun();
  const small = "h-8 rounded-md border border-line px-3 text-[13px] disabled:opacity-40";
  if (!mode) return (
    <div className="flex flex-wrap gap-2">
      <button className={cn(small, "border-danger/40 text-danger")} disabled={pending} onClick={() => { if (confirm(`Record this as an unpaid day for ${name}? A day's pay comes off this month and they get an SMS.`)) run(() => decideMissedShift({ id, decision: "UNPAID" }), "Recorded as unpaid"); }}>Unpaid</button>
      <button className={small} disabled={pending || !usable.length} title={usable.length ? undefined : "No leave left"} onClick={() => setMode("LEAVE")}>Take as leave</button>
      <button className={small} disabled={pending} onClick={() => setMode("WORKED")}>They worked</button>
    </div>
  );
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => decideMissedShift({ id, decision: mode, leaveType: mode === "LEAVE" ? type : undefined, note }), mode === "LEAVE" ? "Booked as leave" : "Recorded as worked", () => setMode("")); }}>
      {mode === "LEAVE" && (
        <label className="text-[12px] text-muted">Leave<select aria-label="Kind of leave" className={cn(input, "h-9")} value={type} onChange={(e) => setType(e.target.value)}>{usable.map((t) => <option key={t.key} value={t.key}>{t.label}{t.left != null ? ` (${t.left} left)` : ""}</option>)}</select></label>
      )}
      <label className="min-w-48 flex-1 text-[12px] text-muted">{mode === "WORKED" ? "How do you know?" : "Note (optional)"}<input className={cn(input, "h-9")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "WORKED" ? "e.g. on the till all day, checked the sales" : "e.g. phoned in sick"} /></label>
      <button className="h-9 rounded-md bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-40" disabled={pending || (mode === "WORKED" && note.trim().length < 3)}>Save</button>
      <button type="button" className="h-9 px-2 text-[13px] underline underline-offset-4" onClick={() => setMode("")}>Back</button>
    </form>
  );
}

export function AbsenceReopen({ id }: { id: string }) {
  const { pending, run } = useRun();
  return <button className="text-[13px] underline underline-offset-4 disabled:opacity-40" disabled={pending} onClick={() => { const why = prompt("Why take this decision back? (kept in the record)"); if (why !== null) run(() => reopenMissedShift(id, why), "Back to decide"); }}>Take back</button>;
}
