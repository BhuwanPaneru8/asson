"use client";

import { useState, useTransition } from "react";
import { sendTwoFactorSms, verifyTwoFactor } from "@/actions/two-factor";
import { cn } from "@/lib/utils";

type Method = "totp" | "sms" | "backup";
const input = "h-12 w-full border border-line bg-white px-3.5 text-[15px] outline-none focus:border-ink";
const primary = "flex h-12 w-full items-center justify-center bg-ink text-[15px] font-medium text-white transition-opacity disabled:opacity-40";
const linkBtn = "text-[14px] font-medium underline underline-offset-4 hover:text-accent disabled:opacity-50";

/** The second step after the password: a code from the authenticator app, or a text message code, or a backup code. */
export function TwoFactorPanel({ methods, phone }: { methods: { totp: boolean; sms: boolean; backup: boolean }; phone: string | null }) {
  const [method, setMethod] = useState<Method>("totp");
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(false);
  const [testCode, setTestCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const use = (m: Method) => { setMethod(m); setCode(""); setError(null); };
  const askSms = () => start(async () => {
    setError(null);
    const r = await sendTwoFactorSms();
    if (!r.ok) { setError(r.error); return; }
    setTestCode(r.testCode ?? null);
    use("sms");
  });
  const ready = method === "backup" ? code.replace(/[^a-z0-9]/gi, "").length === 10 : code.length === 6;

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault(); setError(null);
      start(async () => { const r = await verifyTwoFactor({ method, code, trust }); if (r && !r.ok) setError(r.error); });
    }}>
      <p className="text-[14.5px] text-ink-soft">
        {method === "totp" && "Open your authenticator app and type the 6-digit code for Asson."}
        {method === "sms" && `We've texted a 6-digit code to ${phone ?? "your phone"}.`}
        {method === "backup" && "Type one of your backup codes. Each one works once."}
      </p>
      {method === "sms" && testCode && <p className="border border-warn/40 bg-warn/10 px-3 py-2 text-[13px] text-ink-soft">Test mode: your code is {testCode}</p>}
      <div>
        <label htmlFor="second-code" className="mb-1.5 block text-[13px] font-medium text-ink-soft">{method === "backup" ? "Backup code" : "Code"}</label>
        {method === "backup"
          ? <input id="second-code" className={cn(input, "font-mono tracking-wider")} value={code} onChange={(e) => setCode(e.target.value.slice(0, 12))} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="xxxxx-xxxxx" autoFocus />
          : <input id="second-code" className={cn(input, "text-center text-[22px] tracking-[0.4em] tabular-nums")} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus />}
      </div>
      <label className="flex items-center gap-2.5 text-[14px] text-ink-soft">
        <input type="checkbox" className="h-4 w-4 accent-ink" checked={trust} onChange={(e) => setTrust(e.target.checked)} /> Trust this device for 30 days
      </label>
      {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
      <button className={primary} disabled={pending || !ready}>{pending ? "Checking…" : "Verify"}</button>
      <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
        {method !== "totp" && <button type="button" className={linkBtn} onClick={() => use("totp")}>Use my authenticator app</button>}
        {methods.sms && method !== "sms" && <button type="button" className={linkBtn} disabled={pending} onClick={askSms}>Text me a code instead</button>}
        {method === "sms" && <button type="button" className={cn(linkBtn, "text-muted")} disabled={pending} onClick={askSms}>Send another code</button>}
        {methods.backup && method !== "backup" && <button type="button" className={cn(linkBtn, "text-muted")} onClick={() => use("backup")}>Use a backup code</button>}
      </div>
      <p className="text-[12.5px] text-muted">Only tick &quot;trust this device&quot; on your own phone or computer, never on a shared till. Lost your phone and your backup codes? Ask the owner to reset two-step sign-in.</p>
    </form>
  );
}
