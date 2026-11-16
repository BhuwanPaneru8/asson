import Link from "next/link";
import { Lock, Phone } from "lucide-react";
import { Logo } from "./logo";
import { store } from "@/lib/config";
import { getT } from "@/lib/i18n/server";

/** The checkout's own header: the logo (the way back to the shop), "Secure checkout" and the help number. */
export async function CheckoutHeader() {
  const { t } = await getT();
  return (
    <header className="border-b border-line bg-paper">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <p className="hidden items-center gap-1.5 text-[13.5px] font-medium sm:flex"><Lock className="h-4 w-4" aria-hidden /> {t("co.secure")}</p>
        <a href={`tel:${store.phonePrefix}${store.supportPhone}`} className="flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink">
          <Phone className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">{t("co.needHelp")}</span> <span className="font-medium text-ink">{store.supportPhone}</span>
        </a>
      </div>
    </header>
  );
}

/** The checkout's footer: just the policies a shopper may want to read before paying. */
export async function CheckoutFooter() {
  const { t } = await getT();
  const links: [string, string][] = [["/policies/returns", t("co.footReturns")], ["/policies/privacy", t("policies.privacy")], ["/policies/terms", t("policies.terms")]];
  return (
    <footer className="mt-16 border-t border-line">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-6 text-[13px] text-muted">
        <nav aria-label={t("co.footNav")} className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map(([href, label]) => <Link key={href} href={href} target="_blank" className="hover:text-ink">{label}</Link>)}
        </nav>
        <p>© {new Date().getFullYear()} {store.name}</p>
      </div>
    </footer>
  );
}
