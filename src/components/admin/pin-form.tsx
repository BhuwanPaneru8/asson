"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setApprovalPin } from "@/actions/pos";

const input = "mt-1.5 h-11 w-full rounded-md border border-line bg-white px-3 text-[15px] outline-none focus:border-ink";

export function PinForm() {
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setApprovalPin(password, pin); if (r.ok) { toast.success("PIN saved"); setPassword(""); setPin(""); } else toast.error(r.error); }); }}>
      <label className="block text-[13px] font-medium text-ink-soft">Your account password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={input} /></label>
      <label className="block text-[13px] font-medium text-ink-soft">New PIN (4–6 digits)<input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="off" className={`${input} tracking-[0.4em]`} /></label>
      <button disabled={pending || !password || pin.length < 4} className="h-11 w-full rounded-md bg-ink text-[14px] font-medium text-white disabled:opacity-40">{pending ? "Saving…" : "Save PIN"}</button>
    </form>
  );
}
