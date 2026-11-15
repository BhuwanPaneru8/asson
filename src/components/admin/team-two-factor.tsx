"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldOff } from "lucide-react";
import { requireMemberTwoFactor, resetMemberTwoFactor } from "@/actions/two-factor";
import { cn } from "@/lib/utils";

const input = "mt-1 h-9 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";

/** Team & access: require two-step sign-in for one person, or reset it when they've lost their phone. */
export function TwoFactorControls({ id, name, on, required, byLevel, isMe }: { id: string; name: string; on: boolean; required: boolean; byLevel: boolean; isMe: boolean }) {
  const [resetting, setResetting] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const first = name.split(" ")[0];
  return (
    <div className="space-y-2 text-[13px]">
      {!byLevel && !isMe && (
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-ink" checked={required} disabled={pending} onChange={(e) => { const v = e.target.checked; start(async () => { const r = await requireMemberTwoFactor({ userId: id, required: v }); if (r.ok) toast.success(v ? `${first} must use two-step sign-in${on ? "" : " (sets it up at next sign-in)"}` : `Two-step sign-in is optional for ${first}`); else toast.error(r.error); }); }} />
          Require two-step sign-in
        </label>
      )}
      {on && !isMe && <button type="button" onClick={() => setResetting(!resetting)} className="inline-flex items-center gap-1 underline underline-offset-4"><ShieldOff className="h-3.5 w-3.5" /> Reset two-step sign-in</button>}
      {resetting && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await resetMemberTwoFactor({ userId: id, reason }); if (r.ok) { toast.success(`${first} is signed out and sets up two-step sign-in again at next sign-in`); setResetting(false); setReason(""); } else toast.error(r.error); }); }}>
          <label className="min-w-56 flex-1 text-[12px] text-muted">Why (kept in the record)<input className={cn(input)} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. lost phone, checked by call" /></label>
          <button className="h-9 rounded-md bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-40" disabled={pending || reason.trim().length < 3}>Reset for {first}</button>
        </form>
      )}
      {resetting && <p className="text-[12px] text-muted">Only after checking it&apos;s really them (call them, or see them in person). They&apos;re signed out on every device and set up a new authenticator app at their next sign-in.</p>}
    </div>
  );
}
