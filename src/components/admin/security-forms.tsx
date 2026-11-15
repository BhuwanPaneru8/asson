"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { newBackupCodes, turnOffTwoFactor } from "@/actions/two-factor";
import { BackupCodes, TotpSetup } from "@/components/account/totp-setup";

const input = "mt-1.5 h-11 w-full rounded-md border border-line bg-white px-3 text-center text-[18px] tracking-[0.3em] tabular-nums outline-none focus:border-ink";
const button = "h-11 rounded-md px-4 text-[14px] font-medium disabled:opacity-40";

type Status = { enabledAt: string | null; backupLeft: number; required: "level" | "owner" | null; sms: boolean };

/** My account → Security: two-step sign-in on or off, backup codes. */
export function SecurityPanel({ status }: { status: Status }) {
  const router = useRouter();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [action, setAction] = useState<"codes" | "off" | null>(null);
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();

  if (!status.enabledAt) {
    return (
      <div className="space-y-4">
        <p className="text-[14px]">{status.required ? <strong className="font-medium text-danger">{status.required === "level" ? "Your level needs two-step sign-in." : "The owner requires two-step sign-in for you."}</strong> : "Two-step sign-in is off."} With it on, signing in needs a code from your phone as well as your password, so a stolen or guessed password isn&apos;t enough.</p>
        <TotpSetup mode="account" onFinished={() => router.refresh()} />
      </div>
    );
  }

  if (codes) return <BackupCodes codes={codes} doneLabel="Done" onDone={() => { setCodes(null); router.refresh(); }} />;

  const run = () => start(async () => {
    if (action === "codes") {
      const r = await newBackupCodes({ code });
      if (r.ok) { setCodes(r.codes); setAction(null); setCode(""); } else toast.error(r.error);
    } else {
      const r = await turnOffTwoFactor({ code });
      if (r.ok) { toast.success("Two-step sign-in is off"); setAction(null); setCode(""); } else toast.error(r.error);
    }
  });

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-[14.5px] font-medium text-success"><ShieldCheck className="h-5 w-5" /> Two-step sign-in is on (authenticator app)</p>
      <p className="text-[13.5px] text-muted">On since {new Date(status.enabledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {status.backupLeft} of 10 backup codes left{status.sms ? " · text message codes as a fallback" : ""}</p>
      {status.backupLeft <= 3 && <p className="text-[13.5px] text-warn">You&apos;re running low on backup codes. Make new ones and keep them safe.</p>}
      {action ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <label className="block text-[13px] font-medium text-ink-soft">{action === "codes" ? "To make new backup codes, type" : "To turn it off, type"} the code from your authenticator app
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className={input} autoFocus />
          </label>
          <div className="flex gap-2">
            <button disabled={pending || code.length !== 6} className={`${button} flex-1 ${action === "off" ? "bg-danger text-white" : "bg-ink text-white"}`}>{pending ? "Checking…" : action === "codes" ? "Make new backup codes" : "Turn off two-step sign-in"}</button>
            <button type="button" className={`${button} border border-line`} onClick={() => { setAction(null); setCode(""); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${button} border border-line`} onClick={() => setAction("codes")}>New backup codes</button>
          {!status.required && <button type="button" className={`${button} border border-line text-danger`} onClick={() => setAction("off")}>Turn off</button>}
        </div>
      )}
      {status.required && <p className="text-[12.5px] text-muted">{status.required === "level" ? "Managers and owners always use two-step sign-in." : "The owner requires it for your account."} Lost your phone? Sign in with a backup code, then set it up again from here after the owner resets it.</p>}
    </div>
  );
}
