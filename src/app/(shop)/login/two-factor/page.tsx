import type { Metadata } from "next";
import { backupCodesLeft, methodsFor, pendingSignIn } from "@/lib/two-factor";
import { TwoFactorScreen } from "@/components/account/two-factor-screen";

export const metadata: Metadata = { title: "Two-step sign-in", robots: { index: false } };

/** The second step for staff, straight after the password: a code, or setting up the authenticator app first. */
export default async function TwoFactorPage() {
  const p = await pendingSignIn();
  const methods = p ? methodsFor(p.user, await backupCodesLeft(p.user.id)) : { totp: false, sms: false, backup: false };
  const phone = p?.user.phone ? `${p.user.phone.slice(0, 3)}••••${p.user.phone.slice(-3)}` : null;
  return (
    <div className="container-page py-10 md:py-16">
      <TwoFactorScreen stage={p ? p.stage : "expired"} first={p ? p.user.name.split(" ")[0] : ""} methods={methods} phone={phone} />
    </div>
  );
}
