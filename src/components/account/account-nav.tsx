"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, MapPin, Heart, User, LayoutDashboard, LogOut, Home } from "lucide-react";
import { logout } from "@/actions/auth";
import { cn } from "@/lib/utils";
import { useT } from "@/components/site/i18n-provider";
import type { MessageKey } from "@/lib/i18n";

const items: { href: string; label: MessageKey; icon: typeof Home }[] = [
  { href: "/account", label: "acc.overview", icon: Home },
  { href: "/account/orders", label: "footer.orders", icon: Package },
  { href: "/account/wishlist", label: "nav.wishlist", icon: Heart },
  { href: "/account/addresses", label: "acc.addresses", icon: MapPin },
  { href: "/account/profile", label: "acc.profile", icon: User },
];

export function AccountNav({ isStaff }: { isStaff: boolean }) {
  const path = usePathname();
  const { t } = useT();
  return (
    <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/account" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={cn("flex shrink-0 items-center gap-3 px-3 py-2.5 text-[14.5px]", active ? "bg-ink text-white" : "hover:bg-cloud")}>
            <Icon className="h-4 w-4" strokeWidth={1.8} /> {t(label)}
          </Link>
        );
      })}
      {isStaff && <Link href="/admin" className="flex shrink-0 items-center gap-3 px-3 py-2.5 text-[14.5px] text-accent hover:bg-cloud"><LayoutDashboard className="h-4 w-4" /> {t("acc.admin")}</Link>}
      <form action={logout} className="shrink-0 md:mt-4 md:border-t md:border-line md:pt-4">
        <button className="flex w-full items-center gap-3 px-3 py-2.5 text-[14.5px] text-muted hover:bg-cloud hover:text-ink"><LogOut className="h-4 w-4" /> {t("acc.signOut")}</button>
      </form>
    </nav>
  );
}
