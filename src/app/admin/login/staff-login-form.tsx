"use client";

import { useState, useTransition } from "react";
import { signInWithPassword } from "@/actions/auth";
import { PasswordField } from "@/components/account/password-field";

const input = "h-12 w-full border border-line bg-white px-3.5 text-[15px] outline-none transition-colors focus:border-ink";

/** Email or mobile, and password. Every attempt is checked (and recorded) on the server. */
export function StaffLoginForm({ next }: { next: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await signInWithPassword({ identifier, password, remember, next, area: "staff" });
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <div>
        <label htmlFor="staff-identifier" className="mb-1.5 block text-[13px] font-medium text-ink-soft">Email or mobile number</label>
        <input id="staff-identifier" className={input} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} autoFocus />
      </div>
      <PasswordField id="staff-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
      <label className="flex items-center gap-2.5 text-[14px] text-ink-soft">
        <input type="checkbox" className="h-4 w-4 accent-ink" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in on this device
      </label>
      {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
      <button className="flex h-12 w-full items-center justify-center bg-ink text-[15px] font-medium text-white disabled:opacity-40" disabled={pending || identifier.trim().length < 5 || !password}>
        {pending ? "Please wait…" : "Sign in"}
      </button>
      <button type="button" className="text-[14px] font-medium text-muted underline underline-offset-4 hover:text-ink" onClick={() => setForgot((f) => !f)} aria-expanded={forgot}>
        Forgot your password?
      </button>
      {forgot && <p className="text-[13.5px] leading-relaxed text-ink-soft">Ask the owner for a new sign-in link from Team &amp; access. For security, staff passwords are never reset by SMS or email.</p>}
    </form>
  );
}
