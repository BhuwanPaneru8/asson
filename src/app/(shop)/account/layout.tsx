import { requireUser } from "@/lib/auth";
import { AccountNav } from "@/components/account/account-nav";
import { getT } from "@/lib/i18n/server";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t } = await getT();
  return (
    <div className="container-page py-8 md:py-12">
      <div className="mb-8">
        <p className="text-[13px] text-muted">{t("acc.my")}</p>
        <h1 className="font-display text-4xl">{t("nav.hi", { name: user.name.split(" ")[0] })}</h1>
      </div>
      <div className="grid gap-8 md:grid-cols-12">
        <aside className="min-w-0 md:col-span-3"><AccountNav /></aside>
        <div className="min-w-0 md:col-span-9">{children}</div>
      </div>
    </div>
  );
}
