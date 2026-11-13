import Link from "next/link";
import { Heart, Package, Sparkles } from "lucide-react";
import { store, whatsappUrl } from "@/lib/config";
import { googleEnabled } from "@/lib/google";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";
import { AuthPanel } from "./auth-panel";

/** The sign-in page: the one-step panel, with why it's worth having an account beside it on wider screens. */
export async function SignInScreen({ next, title }: { next?: string; title: "signIn" | "create" }) {
  const { t } = await getT();
  const dest = next?.startsWith("/") && !next.startsWith("//") ? next : "/account";
  return (
    <div className="container-page grid items-start gap-10 py-10 md:py-16 lg:grid-cols-2 lg:gap-16">
      <section className="mx-auto w-full max-w-md lg:order-2">
        <h1 className="font-display text-4xl">{title === "create" ? t("auth.create") : t("auth.welcome")}</h1>
        <p className="mb-8 mt-2 text-[15px] text-muted">{t("auth.loginBody")}</p>
        <AuthPanel next={dest} google={googleEnabled()} support={{ phone: store.supportPhone, whatsapp: whatsappUrl() }} />
        <p className="mt-8 border-t border-line pt-5 text-[13.5px] text-muted">{rich(t("auth.guest"), { link: <Link href="/checkout" className="underline underline-offset-4">{t("auth.guestLink")}</Link> })}</p>
      </section>
      <aside className="hidden bg-cloud p-10 lg:order-1 lg:block">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">{store.name}</p>
        <p className="mt-3 font-display text-3xl leading-tight">{store.tagline}</p>
        <ul className="mt-8 space-y-5 text-[15px]">
          {([[Package, "auth.why1"], [Heart, "auth.why2"], [Sparkles, "auth.why3"]] as const).map(([Icon, k]) => (
            <li key={k} className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center bg-white"><Icon className="h-5 w-5" strokeWidth={1.6} /></span>{t(k)}</li>
          ))}
        </ul>
        <p className="mt-8 text-[13.5px] text-muted">{t("auth.createBody")}</p>
      </aside>
    </div>
  );
}
