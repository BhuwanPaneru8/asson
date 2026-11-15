"use client";

import { useState } from "react";
import Link from "next/link";
import { TwoFactorPanel } from "./two-factor-panel";
import { TotpSetup } from "./totp-setup";

type Props = { stage: "verify" | "setup" | "expired"; first: string; methods: { totp: boolean; sms: boolean; backup: boolean }; phone: string | null };

/**
 * The second-step screen. It keeps the stage it opened with: finishing set-up signs the person in (cookies
 * change, so the page re-renders as "timed out"), but the backup codes must stay on screen until they're saved.
 */
export function TwoFactorScreen(props: Props) {
  const [stage] = useState(props.stage);
  if (stage === "expired") {
    return (
      <section className="mx-auto max-w-md border border-line bg-white p-8 text-center">
        <h1 className="font-display text-3xl">Sign-in timed out</h1>
        <p className="mt-3 text-[15px] text-ink-soft">For your security the second step has to be done within 10 minutes of your password. Please sign in again.</p>
        <Link href="/admin/login" className="mt-6 inline-block text-[14px] font-medium underline underline-offset-4">Sign in</Link>
      </section>
    );
  }
  return (
    <section className="mx-auto w-full max-w-md">
      {stage === "verify" ? (
        <>
          <h1 className="font-display text-4xl">Two-step sign-in</h1>
          <p className="mb-8 mt-2 text-[15px] text-muted">Hi {props.first}. One more step to keep the business safe.</p>
          <TwoFactorPanel methods={props.methods} phone={props.phone} />
        </>
      ) : (
        <>
          <h1 className="font-display text-4xl">Set up two-step sign-in</h1>
          <p className="mb-8 mt-2 text-[15px] text-muted">Hi {props.first}. Your staff account needs a code from your phone as well as your password, so nobody else can sign in as you. It takes about a minute.</p>
          <TotpSetup mode="signin" />
        </>
      )}
    </section>
  );
}
