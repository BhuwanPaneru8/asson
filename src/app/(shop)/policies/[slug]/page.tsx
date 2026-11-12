import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { POLICIES, policy } from "@/lib/policies";
import { store, whatsappUrl } from "@/lib/config";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";
import { PolicyView } from "@/components/site/policy-view";
import { policyTitles } from "../titles";

export function generateStaticParams() {
  return POLICIES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = policy((await params).slug);
  return p ? { title: p.title, description: p.summary } : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = policy((await params).slug);
  if (!p) notFound();
  const { t, locale } = await getT();
  return (
    <PolicyView
      p={p}
      labels={{
        all: t("policies.title"),
        onThisPage: t("policies.onThisPage"),
        updated: t("policies.updated"),
        english: locale === "ne" ? t("policies.english") : null,
        titles: policyTitles(t),
        questions: rich(t("policies.questions"), {
          phone: <a href={`tel:${store.phonePrefix}${store.supportPhone}`} className="font-medium underline underline-offset-4">{store.supportPhone}</a>,
          whatsapp: <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">WhatsApp</a>,
          email: <a href={`mailto:${store.supportEmail}`} className="font-medium underline underline-offset-4">{store.supportEmail}</a>,
        }),
      }}
    />
  );
}
