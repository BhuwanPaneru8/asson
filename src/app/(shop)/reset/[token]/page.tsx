import type { Metadata } from "next";
import Link from "next/link";
import { resetFor } from "@/lib/team";
import { getT } from "@/lib/i18n/server";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

/** A customer arrives from customer care's one-time link and chooses a new password. */
export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [r, { t }] = await Promise.all([resetFor(token), getT()]);
  return (
    <div className="container-page flex justify-center py-12 md:py-16">
      <div className="w-full max-w-md border border-line bg-white p-8">
        {!r ? (
          <>
            <h1 className="font-display text-3xl">{t("reset.expired")}</h1>
            <p className="mt-3 text-[15px] text-ink-soft">{t("reset.expiredBody")}</p>
            <Link href="/login" className="mt-6 inline-block text-[14px] underline underline-offset-4">{t("auth.signInInstead")}</Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl">{t("reset.title")}</h1>
            <p className="mt-2 text-[15px] text-ink-soft">{t("reset.body", { name: r.name.split(" ")[0] })}</p>
            <ResetForm token={token} />
          </>
        )}
      </div>
    </div>
  );
}
