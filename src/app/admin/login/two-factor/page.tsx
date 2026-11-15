import type { Metadata } from "next";
import { backupCodesLeft, methodsFor, pendingSignIn } from "@/lib/two-factor";
import { TwoFactorScreen } from "@/components/account/two-factor-screen";
import { Logo } from "@/components/site/logo";

export const metadata: Metadata = { title: "Two-step sign-in", robots: { index: false } };

/** The second step for staff, straight after the password: a code, or setting up the authenticator app first. */
export default async function TwoFactorPage() {
  const p = await pendingSignIn();
  const methods = p ? methodsFor(p.user, await backupCodesLeft(p.user.id)) : { totp: false, sms: false, backup: false };
  const phone = p?.user.phone ? `${p.user.phone.slice(0, 3)}••••${p.user.phone.slice(-3)}` : null;
  return (
    <main id="main" className="min-h-screen bg-[#f6f5f2] px-4 py-12">
      <div className="mb-8 text-center"><Logo /></div>
      <TwoFactorScreen stage={p ? p.stage : "expired"} first={p ? p.user.name.split(" ")[0] : ""} methods={methods} phone={phone} />
    </main>
  );
}
