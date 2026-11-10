import Link from "next/link";
import { store, whatsappUrl } from "@/lib/config";
import { getProductRail } from "@/lib/catalog";
import { Logo } from "./logo";
import { NewsletterForm } from "./newsletter";
import { LanguageSwitch } from "./language-switch";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";

const cols: { title: MessageKey; links: [MessageKey, string][] }[] = [
  { title: "footer.shop", links: [["g.men", "/c/men"], ["g.women", "/c/women"], ["g.kids", "/c/kids"], ["nav.newIn", "/shop?sort=new"], ["nav.sale", "/shop?sale=1"]] },
  { title: "footer.help", links: [["footer.track", "/track"], ["footer.shipping", "/help#shipping"], ["footer.returns", "/help#returns"], ["nav.sizeGuide", "/size-guide"], ["footer.contactUs", "/help#contact"]] },
  { title: "footer.account", links: [["nav.signIn", "/login"], ["footer.createAccount", "/register"], ["footer.orders", "/account/orders"], ["nav.wishlist", "/account/wishlist"]] },
];

export async function Footer() {
  const [rail, { t }] = await Promise.all([getProductRail("sale", 1), getT()]);
  const hasSale = rail.length > 0;
  const columns = cols.map((c) => ({ ...c, links: c.links.filter(([label]) => label !== "nav.sale" || hasSale) }));
  return (
    <footer className="mt-24 border-t border-line bg-cloud/50">
      <div className="container-page grid gap-10 py-16 md:grid-cols-12 md:gap-8 [&>*]:min-w-0">
        <div className="md:col-span-4">
          <Logo />
          <p className="mt-4 max-w-xs text-[14.5px] text-ink-soft">{store.tagline} {t("footer.districts")}</p>
          <LanguageSwitch className="mt-4 text-[14px]" />
          <div className="mt-6"><NewsletterForm /></div>
        </div>
        {columns.map((c) => (
          <div key={c.title} className="md:col-span-2">
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{t(c.title)}</p>
            <ul className="space-y-2.5 text-[14.5px]">
              {c.links.map(([label, href]) => <li key={href}><Link href={href} className="text-ink-soft hover:text-accent">{t(label)}</Link></li>)}
            </ul>
          </div>
        ))}
        <div className="md:col-span-2">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{t("footer.contact")}</p>
          <p className="text-[14.5px] text-ink-soft"><a href={`tel:${store.phonePrefix}${store.supportPhone}`} className="hover:text-accent">{store.supportPhone}</a><br /><a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="hover:text-accent">WhatsApp {store.supportWhatsApp}</a><br />{t("footer.hours")}</p>
          <p className="mt-2 break-all text-[14.5px] text-ink-soft"><a href={`mailto:${store.supportEmail}`} className="hover:text-accent">{store.supportEmail}</a></p>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-6 text-[13px] text-muted md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {store.name}. {t("footer.rights")}</p>
          <div className="flex gap-5"><Link href="/help#privacy">{t("footer.privacy")}</Link><Link href="/help#terms">{t("footer.terms")}</Link><span>{store.onlinePaymentsLive ? `eSewa · Khalti · ${t("pay.cod")}` : t("pay.cod")}</span></div>
        </div>
      </div>
    </footer>
  );
}
