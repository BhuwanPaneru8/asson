import Link from "next/link";
import { MessageCircle, Phone, Mail, MapPin } from "lucide-react";
import { store, whatsappUrl } from "@/lib/config";
import { getProductRail } from "@/lib/catalog";
import { Logo } from "./logo";
import { NewsletterForm } from "./newsletter";
import { BackToTop } from "./back-to-top";
import { CookieSettingsButton } from "./marketing";
import { InstallAppButton } from "./app-install";
import { marketingIds } from "@/lib/marketing";
import { anyTracker } from "@/lib/marketing-shared";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";

const cols: { title: MessageKey; links: [MessageKey, string][] }[] = [
  { title: "footer.shop", links: [["g.men", "/c/men"], ["g.women", "/c/women"], ["g.kids", "/c/kids"], ["nav.newIn", "/shop?sort=new"], ["nav.sale", "/shop?sale=1"], ["nav.lookbook", "/lookbook"]] },
  { title: "footer.help", links: [["footer.track", "/track"], ["footer.shipping", "/policies/shipping"], ["footer.returns", "/policies/returns"], ["nav.sizeGuide", "/size-guide"], ["footer.contactUs", "/help#contact"]] },
  { title: "footer.company", links: [["footer.about", "/about"], ["footer.stores", "/stores"], ["footer.orders", "/account/orders"], ["nav.wishlist", "/account/wishlist"]] },
];

const heading = "text-[12px] font-semibold uppercase tracking-[0.14em] text-muted";
const link = "inline-flex min-h-7 items-center text-ink-soft transition-colors hover:text-accent";

export async function Footer() {
  const [sale, { t }] = await Promise.all([getProductRail("sale", 1), getT()]);
  const columns = cols.map((c) => ({ ...c, links: c.links.filter(([label]) => label !== "nav.sale" || sale.length > 0) }));
  return (
    <footer className="mt-24 border-t border-line bg-cloud/50">
      <div className="container-page grid gap-x-8 gap-y-2 py-14 md:grid-cols-12 md:gap-y-10 md:py-16 [&>*]:min-w-0">
        <div className="mb-8 md:col-span-4 md:mb-0">
          <Logo />
          <p className="mt-4 max-w-xs text-[14.5px] leading-relaxed text-ink-soft">{store.tagline} {t("footer.districts")}</p>
          <div className="mt-6 max-w-sm"><NewsletterForm /></div>
        </div>

        {/* phones: each column folds, so the footer is a short list instead of a long scroll */}
        {columns.map((c) => (
          <div key={c.title} className="md:col-span-2">
            <details className="group border-b border-line md:hidden">
              <summary className={`flex cursor-pointer list-none items-center justify-between py-3.5 ${heading} [&::-webkit-details-marker]:hidden`}>
                {t(c.title)}
                <span className="text-[20px] font-normal leading-none text-muted transition-transform duration-200 group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <ul className="space-y-0.5 pb-4 text-[14.5px]">
                {c.links.map(([label, href]) => <li key={href}><Link href={href} className={link}>{t(label)}</Link></li>)}
              </ul>
            </details>
            <div className="hidden md:block">
              <p className={`mb-3 ${heading}`}>{t(c.title)}</p>
              <ul className="space-y-0.5 text-[14.5px]">
                {c.links.map(([label, href]) => <li key={href}><Link href={href} className={link}>{t(label)}</Link></li>)}
              </ul>
            </div>
          </div>
        ))}

        <div className="mt-6 md:col-span-2 md:mt-0">
          <p className={`mb-3 ${heading}`}>{t("footer.contact")}</p>
          <ul className="space-y-0.5 text-[14.5px]">
            <li><a href={`tel:${store.phonePrefix}${store.supportPhone}`} className={`${link} gap-2`}><Phone className="h-4 w-4 text-muted" strokeWidth={1.6} />{store.supportPhone}</a></li>
            <li><a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className={`${link} gap-2`}><MessageCircle className="h-4 w-4 text-muted" strokeWidth={1.6} />WhatsApp</a></li>
            <li><a href={`mailto:${store.supportEmail}`} className={`${link} gap-2 break-all`}><Mail className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.6} />{store.supportEmail}</a></li>
            <li><Link href="/stores" className={`${link} gap-2`}><MapPin className="h-4 w-4 text-muted" strokeWidth={1.6} />{t("footer.stores")}</Link></li>
          </ul>
          <p className="mt-3 text-[13px] text-muted">{t("footer.hours")}</p>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-4 py-6 text-[13px] text-muted md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {store.name}. {t("footer.rights")}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/policies/terms" className="hover:text-ink">{t("footer.terms")}</Link>
            <Link href="/policies/privacy" className="hover:text-ink">{t("footer.privacy")}</Link>
            <Link href="/policies" className="hover:text-ink">{t("footer.policies")}</Link>
            <InstallAppButton className="hover:text-ink" />
            {anyTracker(marketingIds()) && <CookieSettingsButton label={t("footer.cookieSettings")} />}
            <span>{t("footer.payWith")} {store.onlinePaymentsLive ? `eSewa · Khalti · ${t("pay.cod")}` : t("pay.cod")}</span>
            <BackToTop label={t("footer.backToTop")} />
          </div>
        </div>
      </div>
    </footer>
  );
}
