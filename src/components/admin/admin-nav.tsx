"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserCog, LayoutDashboard, Package, Shirt, Boxes, Users, TicketPercent, MessageSquare, Store, Menu, X, Truck, ScanBarcode, Lock, KeyRound, LogOut, ClipboardList, Wallet, Banknote, MessageCircle, History, PackageCheck, ArrowLeftRight, MapPin, Activity, Lightbulb, ClipboardCheck, Receipt, Sparkles, RefreshCw, Network, Languages, Factory, Clock, UsersRound, HandCoins, ListChecks, Megaphone, Wrench, Headset, Frame, Gauge, Vault, Grid3x3, PackageOpen, CalendarDays, BadgePercent, PackageX, GraduationCap, BookOpen } from "lucide-react";
import { logout } from "@/actions/auth";
import { can, type Permission, type Subject } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type Group = "Learn" | "Sell" | "Orders" | "Stock" | "Shops & team" | "Money" | "Grow" | "Settings";
const NAV: { href: string; label: string; icon: typeof LayoutDashboard; perm: Permission; badgeKey?: "orders" | "stock"; group?: Group }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" },
  { href: "/admin/today", label: "Today", icon: ListChecks, perm: "self.time" },
  { href: "/admin/handbook", label: "Handbook", icon: BookOpen, perm: "self.time", group: "Learn" },
  { href: "/admin/training", label: "Training", icon: GraduationCap, perm: "self.time", group: "Learn" },
  { href: "/admin/pos", label: "Point of sale", icon: ScanBarcode, perm: "pos.sell", group: "Sell" },
  { href: "/admin/closing", label: "Daily closing", icon: Lock, perm: "closing", group: "Sell" },
  { href: "/admin/cash", label: "Cash", icon: Vault, perm: "closing", group: "Sell" },
  { href: "/admin/cod", label: "COD remittance", icon: Banknote, perm: "closing", group: "Sell" },
  { href: "/admin/orders", label: "Orders", icon: Package, perm: "orders", badgeKey: "orders", group: "Orders" },
  { href: "/admin/fulfilment", label: "Fulfilment", icon: PackageOpen, perm: "orders", group: "Orders" },
  { href: "/admin/picking", label: "Pick lists", icon: PackageCheck, perm: "orders", group: "Orders" },
  { href: "/admin/care", label: "Customer care", icon: Headset, perm: "care", group: "Orders" },
  { href: "/admin/notifications", label: "Notifications", icon: MessageCircle, perm: "orders", group: "Orders" },
  { href: "/admin/products", label: "Products", icon: Shirt, perm: "catalog.view", group: "Stock" },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, perm: "catalog.view", badgeKey: "stock", group: "Stock" },
  { href: "/admin/transfers", label: "Transfers", icon: ArrowLeftRight, perm: "transfers", group: "Stock" },
  { href: "/admin/replenishment", label: "Replenishment", icon: RefreshCw, perm: "transfers", group: "Stock" },
  { href: "/admin/bins", label: "Bins", icon: Grid3x3, perm: "stock.count", group: "Stock" },
  { href: "/admin/counts", label: "Stock counts", icon: ClipboardCheck, perm: "stock.count", group: "Stock" },
  { href: "/admin/damaged", label: "Damaged stock", icon: PackageX, perm: "inventory.adjust", group: "Stock" },
  { href: "/admin/purchasing", label: "Purchasing", icon: ClipboardList, perm: "purchasing", group: "Stock" },
  { href: "/admin/production", label: "Production", icon: Factory, perm: "production", group: "Stock" },
  { href: "/admin/network", label: "Network", icon: Network, perm: "insights", group: "Shops & team" },
  { href: "/admin/scorecard", label: "Shop scorecard", icon: Gauge, perm: "ops.manage", group: "Shops & team" },
  { href: "/admin/ops", label: "Shop operations", icon: Megaphone, perm: "ops.manage", group: "Shops & team" },
  { href: "/admin/people", label: "People", icon: UsersRound, perm: "people", group: "Shops & team" },
  { href: "/admin/rosters", label: "Rosters", icon: CalendarDays, perm: "people", group: "Shops & team" },
  { href: "/admin/visits", label: "Store visits", icon: ClipboardCheck, perm: "self.time", group: "Shops & team" },
  { href: "/admin/vm", label: "Visual merchandising", icon: Frame, perm: "self.time", group: "Shops & team" },
  { href: "/admin/issues", label: "Issues", icon: Wrench, perm: "self.time", group: "Shops & team" },
  { href: "/admin/time", label: "My time", icon: Clock, perm: "self.time", group: "Shops & team" },
  { href: "/admin/payables", label: "Payables", icon: Receipt, perm: "purchasing", group: "Money" },
  { href: "/admin/finance", label: "Finance", icon: Wallet, perm: "finance", group: "Money" },
  { href: "/admin/payroll", label: "Payroll", icon: HandCoins, perm: "payroll", group: "Money" },
  { href: "/admin/insights", label: "Insights", icon: Lightbulb, perm: "insights", group: "Grow" },
  { href: "/admin/customers", label: "Customers", icon: Users, perm: "customers", group: "Grow" },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent, perm: "coupons", group: "Grow" },
  { href: "/admin/markdowns", label: "Markdowns", icon: BadgePercent, perm: "catalog.edit", group: "Grow" },
  { href: "/admin/lookbook", label: "Lookbook", icon: Sparkles, perm: "catalog.edit", group: "Grow" },
  { href: "/admin/nepali", label: "Nepali names", icon: Languages, perm: "catalog.edit", group: "Grow" },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquare, perm: "reviews", group: "Grow" },
  { href: "/admin/team", label: "Team & access", icon: UserCog, perm: "team.manage", group: "Settings" },
  { href: "/admin/locations", label: "Locations", icon: MapPin, perm: "locations", group: "Settings" },
  { href: "/admin/delivery", label: "Delivery rates", icon: Truck, perm: "delivery", group: "Settings" },
  { href: "/admin/activity", label: "Activity log", icon: History, perm: "audit", group: "Settings" },
  { href: "/admin/system", label: "System", icon: Activity, perm: "system", group: "Settings" },
];

/** The staff menu: only what this person's job lets them use, in sections (a section with nothing in it is hidden). */
export function AdminNav({ badges, who }: { badges: { orders: number; stock: number }; who: Subject }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const role = who;
  const mine = NAV.filter((n) => can(who, n.perm));
  const links = (
    <nav className="flex flex-col gap-0.5 p-3" aria-label="Staff menu">
      {mine.map(({ href, label, icon: Icon, badgeKey, group }, i) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        const badge = badgeKey ? badges[badgeKey as keyof typeof badges] : 0;
        const heading = group && group !== mine[i - 1]?.group ? group : null;
        return (
          <div key={href} className="contents">
          {heading && <p className="mb-1 mt-4 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/40">{heading}</p>}
          <Link href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-[14px]", active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}>
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            <span className="flex-1">{label}</span>
            {badge > 0 && <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", badgeKey === "stock" ? "bg-warn text-white" : "bg-white text-ink")}>{badge}</span>}
          </Link>
          </div>
        );
      })}
      <Link href="/admin/me" onClick={() => setOpen(false)} className={cn("mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-[14px]", path === "/admin/me" ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}><KeyRound className="h-4 w-4" /> My account &amp; security</Link>
      <Link href="/" className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-[14px] text-white/65 hover:bg-white/5 hover:text-white"><Store className="h-4 w-4" /> View store</Link>
      <form action={logout}>
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[14px] text-white/65 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button>
      </form>
    </nav>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto overscroll-contain bg-ink lg:flex">
        <div className="flex h-14 items-center px-6 font-display text-xl text-white">asson<span className="text-accent">.</span> <span className="ml-2 font-sans text-[11px] uppercase tracking-widest text-white/50">Admin</span></div>
        {links}
      </aside>
      <div className="flex h-14 items-center gap-3 bg-ink px-4 text-white lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <span className="font-display text-lg">asson<span className="text-accent">.</span> Admin</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-ink animate-slide-in-left">
            <div className="flex h-14 items-center justify-between px-5 text-white"><span className="font-display text-lg">Admin</span><button onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
            {links}
          </div>
        </div>
      )}
    </>
  );
}
