"use client";

import { useState, useTransition } from "react";
import { Copy, Printer, ShieldCheck } from "lucide-react";
import { beginTotpSetup, finishTotpSetup } from "@/actions/two-factor";
import { cn } from "@/lib/utils";

const input = "h-12 w-full border border-line bg-white px-3.5 text-center text-[22px] tracking-[0.4em] tabular-nums outline-none focus:border-ink";
const primary = "flex h-12 w-full items-center justify-center bg-ink text-[15px] font-medium text-white transition-opacity disabled:opacity-40";

/** The QR code an authenticator app scans (drawn from the server's module grid, no image or script needed). */
export function QrCode({ size, cells, label }: { size: number; cells: string; label: string }) {
  let d = "";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (cells[y * size + x] === "1") d += `M${x + 4} ${y + 4}h1v1h-1z`;
  return (
    <svg viewBox={`0 0 ${size + 8} ${size + 8}`} role="img" aria-label={label} className="h-52 w-52 bg-white" shapeRendering="crispEdges">
      <path d={d} fill="#000" />
    </svg>
  );
}

/** Backup codes, shown once: copy or print them, then confirm they're kept somewhere safe. */
export function BackupCodes({ codes, onDone, doneLabel }: { codes: string[]; onDone: () => void; doneLabel: string }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-[14.5px] text-ink-soft">If you lose your phone, each of these codes signs you in once. <strong className="font-medium text-ink">They are shown only now.</strong> Print them or write them down and keep them somewhere safe, away from your phone.</p>
      <ol aria-label="Backup codes" className="grid grid-cols-2 gap-x-6 gap-y-1.5 border border-line bg-cloud px-5 py-4 font-mono text-[15px] tabular-nums print:border-0">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ol>
      <div className="flex flex-wrap gap-4 print:hidden">
        <button type="button" className="inline-flex items-center gap-1.5 text-[14px] font-medium underline underline-offset-4" onClick={() => { void navigator.clipboard?.writeText(codes.join("\n")).then(() => setCopied(true)).catch(() => {}); }}><Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}</button>
        <button type="button" className="inline-flex items-center gap-1.5 text-[14px] font-medium underline underline-offset-4" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
      </div>
      <label className="flex items-start gap-2.5 text-[14px] print:hidden">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-ink" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I&apos;ve saved my backup codes
      </label>
      <button type="button" className={cn(primary, "print:hidden")} disabled={!saved} onClick={onDone}>{doneLabel}</button>
    </div>
  );
}

type Started = { secret: string; uri: string; qr: { size: number; cells: string } };

/**
 * Setting up an authenticator app: install one, scan the QR code (or type the key), type the code it shows,
 * then keep the backup codes. Used straight after the password (when it's required) and from My account.
 */
export function TotpSetup({ mode, onFinished }: { mode: "signin" | "account"; onFinished?: () => void }) {
  const [started, setStarted] = useState<Started | null>(null);
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(false);
  const [done, setDone] = useState<{ codes: string[]; next: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-[15px] font-medium text-success"><ShieldCheck className="h-5 w-5" /> Two-step sign-in is on</p>
        <h2 className="font-display text-2xl">Your backup codes</h2>
        <BackupCodes codes={done.codes} doneLabel={mode === "signin" ? "Continue" : "Done"} onDone={() => (mode === "signin" ? window.location.assign(done.next) : onFinished?.())} />
      </div>
    );
  }

  if (!started) {
    return (
      <div className="space-y-4">
        <ol className="list-decimal space-y-2 pl-5 text-[14.5px] text-ink-soft">
          <li>Install an authenticator app on your phone: Google Authenticator, Microsoft Authenticator or similar (free).</li>
          <li>Scan the QR code we show you with the app.</li>
          <li>Type the 6-digit code the app shows.</li>
        </ol>
        {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
        <button type="button" className={primary} disabled={pending} onClick={() => start(async () => { setError(null); const r = await beginTotpSetup(); if (r.ok) setStarted(r); else setError(r.error); })}>{pending ? "Please wait…" : "Set up authenticator app"}</button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault(); setError(null);
      start(async () => { const r = await finishTotpSetup({ code, trust }); if (r.ok) setDone(r); else setError(r.error); });
    }}>
      <div className="flex justify-center border border-line bg-white p-3"><QrCode size={started.qr.size} cells={started.qr.cells} label="QR code for your authenticator app" /></div>
      <details className="text-[13.5px] text-ink-soft">
        <summary className="cursor-pointer font-medium text-ink">Can&apos;t scan it? Enter this key instead</summary>
        <p className="mt-2 break-all border border-line bg-cloud px-3 py-2 font-mono text-[14px] tracking-wider" data-testid="totp-secret">{started.secret}</p>
        <p className="mt-1.5 text-muted">Time-based, 6 digits. On a phone, <a href={started.uri} className="underline underline-offset-2">open it in your app</a>.</p>
      </details>
      <div>
        <label htmlFor="setup-code" className="mb-1.5 block text-[13px] font-medium text-ink-soft">Code from the app</label>
        <input id="setup-code" className={input} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
      </div>
      {mode === "signin" && (
        <label className="flex items-center gap-2.5 text-[14px] text-ink-soft">
          <input type="checkbox" className="h-4 w-4 accent-ink" checked={trust} onChange={(e) => setTrust(e.target.checked)} /> Trust this device for 30 days
        </label>
      )}
      {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
      <button className={primary} disabled={pending || code.length !== 6}>{pending ? "Checking…" : "Turn on two-step sign-in"}</button>
    </form>
  );
}
