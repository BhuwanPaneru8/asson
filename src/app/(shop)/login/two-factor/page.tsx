import type { Metadata } from "next";
import Link from "next/link";
import { backupCodesLeft, methodsFor, pendingSignIn } from "@/lib/two-factor";
import { TwoFactorPanel } from "@/components/account/two-factor-panel";
import { TotpSetup } from "@/components/account/totp-setup";

export const metadata: Metadata = { title: "Two-step sign-in", robots: { index: false } };

/** The second step for staff, straight after the password: a code, or setting up the authenticator app first. */
export default async function TwoFactorPage() {
  const p = await pendingSignIn();
  if (!p) {
    return (
      <div className="container-page py-16">
        <section className="mx-auto max-w-md border border-line bg-white p-8 text-center">
          <h1 className="font-display text-3xl">Sign-in timed out</h1>
          <p className="mt-3 text-[15px] text-ink-soft">For your security the second step has to be done within 10 minutes of your password. Please sign in again.</p>
          <Link href="/login?next=/admin" className="mt-6 inline-block text-[14px] font-medium underline underline-offset-4">Sign in</Link>
        </section>
      </div>
    );
  }
  const first = p.user.name.split(" ")[0];
  const phone = p.user.phone ? `${p.user.phone.slice(0, 3)}••••${p.user.phone.slice(-3)}` : null;
  return (
    <div className="container-page py-10 md:py-16">
      <section className="mx-auto w-full max-w-md">
        {p.stage === "verify" ? (
          <>
            <h1 className="font-display text-4xl">Two-step sign-in</h1>
            <p className="mb-8 mt-2 text-[15px] text-muted">Hi {first}. One more step to keep the business safe.</p>
            <TwoFactorPanel methods={methodsFor(p.user, await backupCodesLeft(p.user.id))} phone={phone} />
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl">Set up two-step sign-in</h1>
            <p className="mb-8 mt-2 text-[15px] text-muted">Hi {first}. Your staff account needs a code from your phone as well as your password, so nobody else can sign in as you. It takes about a minute.</p>
            <TotpSetup mode="signin" />
          </>
        )}
      </section>
    </div>
  );
}
