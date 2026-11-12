import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { POLICIES, POLICIES_UPDATED } from "@/lib/policies";
import { getT } from "@/lib/i18n/server";
import { policyTitles } from "./titles";

export const metadata: Metadata = { title: "Policies", description: "Terms and conditions, privacy, shipping, returns, payments, rewards and cookies at Asson." };

export default async function PoliciesPage() {
  const { t, locale } = await getT();
  const titles = policyTitles(t);
  return (
    <div className="container-page py-10 md:py-14">
      <h1 className="font-display text-4xl md:text-5xl">{t("policies.title")}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{t("policies.intro")}</p>
      <p className="mt-2 text-[13px] text-muted">{t("policies.updated")} {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${POLICIES_UPDATED}T00:00:00Z`))}</p>
      {locale === "ne" && <p className="mt-4 max-w-2xl bg-cloud px-4 py-3 text-[14px] text-ink-soft">{t("policies.english")}</p>}
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {POLICIES.map((p) => (
          <li key={p.slug}>
            <Link href={`/policies/${p.slug}`} className="group flex h-full flex-col border border-line bg-white p-6 transition-colors hover:border-ink">
              <h2 className="font-display text-2xl">{titles[p.slug]}</h2>
              <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-ink-soft">{p.summary}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium">{t("policies.read")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
