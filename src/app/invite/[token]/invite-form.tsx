"use client";

import { useState, useTransition } from "react";
import { setPasswordFromInvite } from "@/actions/invite";

const input = "h-11 w-full border border-line bg-white px-3 text-[15px] outline-none focus:border-ink";

export function InviteForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => { const r = await setPasswordFromInvite({ token, password, confirm }); if (r && !r.ok) setError(r.error); }); }}>
      <label className="block text-[13px] font-medium text-ink-soft">New password
        <input id="password" type="password" autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-hint" />
      </label>
      <p id="pw-hint" className="-mt-2 text-[12.5px] text-muted">8+ characters, with a letter and a number</p>
      <label className="block text-[13px] font-medium text-ink-soft">The same password again
        <input id="confirm" type="password" autoComplete="new-password" className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
      <button className="h-12 w-full bg-ink text-[15px] font-medium text-white disabled:opacity-40" disabled={pending || password.length < 8 || !confirm}>{pending ? "Setting up…" : "Set password and sign in"}</button>
    </form>
  );
}
