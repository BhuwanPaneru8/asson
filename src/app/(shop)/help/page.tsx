import type { Metadata } from "next";
import Link from "next/link";
import { store, whatsappUrl } from "@/lib/config";
import { formatPrice } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";
import { localise, type T } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { CareForm } from "@/components/account/care-form";

export const metadata: Metadata = { title: "Help & FAQs" };

const Z = store.shipping.zones;
const days = (z: { etaMinDays: number; etaMaxDays: number }) => `${z.etaMinDays}–${z.etaMaxDays}`;

function faq(t: T, l: (s: string) => string) {
  return [
    { id: "shipping", title: t("footer.shipping"), items: [
      [t("help.q.everywhere"), t("help.a.everywhere")],
      [t("help.q.howLong"), t("help.a.howLong", { valley: l(Z.VALLEY.label), v: days(Z.VALLEY), outside: l(Z.OUTSIDE.label), o: days(Z.OUTSIDE), remote: l(Z.REMOTE.label), r: days(Z.REMOTE) })],
      [t("help.q.cost"), t("help.a.cost", { free: formatPrice(store.shipping.freeThreshold), valley: formatPrice(Z.VALLEY.fee), outside: formatPrice(Z.OUTSIDE.fee), remote: formatPrice(Z.REMOTE.fee), express: formatPrice(store.shipping.express.fee) })],
    ]},
    { id: "returns", title: t("footer.returns"), items: [
      [t("help.q.policy"), t("help.a.policy", { days: store.returnWindowDays })],
      [t("help.q.start"), t("help.a.start")],
      [t("help.q.refund"), t("help.a.refund")],
    ]},
    { id: "payments", title: t("help.payments"), items: [
      [t("help.q.methods"), store.onlinePaymentsLive ? t("help.a.methodsLive") : t("help.a.methods")],
      [t("help.q.cod"), t("help.a.cod", { amount: formatPrice(store.codMaxOrder) })],
      [t("help.q.vat"), t("help.a.vat")],
    ]},
  ];
}

const CATS = ["ORDER", "DELIVERY", "PAYMENT", "QUALITY", "EXCHANGE", "SERVICE", "OTHER"] as const;

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ order?: string; topic?: string }> }) {
  const { t, locale } = await getT();
  const sp = await searchParams;
  const user = await getCurrentUser();
  const me = user?.role === "CUSTOMER" ? user : null;
  const topic = CATS.find((c) => c === sp.topic?.toUpperCase()) ?? "ORDER";
  const FAQ = faq(t, (s) => localise(locale, s));
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="font-display text-5xl">{t("help.title")}</h1>
      <p className="mt-3 text-muted">{rich(t("help.intro"), { link: <a href="#contact" className="underline">{t("footer.contactUs")}</a> })}</p>
      <div className="mt-6 flex flex-wrap gap-2"><Link href="/track" className="border border-ink px-4 py-2 text-[14px] font-medium">{t("nav.track")}</Link><Link href="/account/orders" className="border border-line bg-white px-4 py-2 text-[14px]">{t("help.startReturn")}</Link><Link href="/size-guide" className="border border-line bg-white px-4 py-2 text-[14px]">{t("nav.sizeGuide")}</Link></div>
      {FAQ.map((s) => (
        <section key={s.id} id={s.id} className="mt-12 scroll-mt-24">
          <h2 className="mb-4 text-[20px] font-semibold">{s.title}</h2>
          <div className="divide-y divide-line border-y border-line">
            {s.items.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium">{q}<span className="text-muted transition-transform group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <section id="contact" className="mt-12 scroll-mt-24 bg-cloud p-6">
        <h2 className="text-[20px] font-semibold">{t("footer.contactUs")}</h2>
        <p className="mt-2 text-[14.5px] text-ink-soft">{rich(t("help.contactBody"), {
          phone: <a href={`tel:${store.phonePrefix}${store.supportPhone}`} className="underline hover:text-accent">{store.supportPhone}</a>,
          whatsapp: <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">{store.supportWhatsApp}</a>,
          email: <a href={`mailto:${store.supportEmail}`} className="underline hover:text-accent">{store.supportEmail}</a>,
        })}</p>
        <div id="write" className="mt-8 scroll-mt-24 border-t border-line pt-6">
          <h3 className="text-[17px] font-semibold">{t("care.title")}</h3>
          <p className="mt-1 text-[14px] text-ink-soft">{t("care.intro", { hours: store.care.replyHours.NORMAL })}</p>
          <CareForm defaults={{ name: me?.name ?? "", phone: me?.phone ?? "", email: me?.email ?? "", order: String(sp.order ?? "").slice(0, 20), category: topic }} />
        </div>
      </section>
      {/* old #privacy / #terms links still land here, then go on to the full policies */}
      <section id="policies" className="mt-12 scroll-mt-24">
        <h2 id="privacy" className="scroll-mt-24 text-[20px] font-semibold"><span id="terms" className="scroll-mt-24" />{t("policies.title")}</h2>
        <p className="mt-2 text-[14.5px] text-ink-soft">{t("help.privacyBody")}</p>
        <ul className="mt-4 grid gap-2 text-[14.5px] sm:grid-cols-2">
          {(["terms", "privacy", "shipping", "returns", "payments", "rewards", "cookies"] as const).map((s) => <li key={s}><Link href={`/policies/${s}`} className="underline underline-offset-4 hover:text-accent">{t(`policies.${s}`)}</Link></li>)}
        </ul>
      </section>
    </div>
  );
}
