"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Package, Shirt, Boxes, Users, TicketPercent, MessageSquare, Store, Menu, X, Truck, ScanBarcode, Lock, KeyRound, LogOut, ClipboardList, Wallet, Banknote, MessageCircle, History, PackageCheck, ArrowLeftRight, MapPin, Activity, Lightbulb, ClipboardCheck, Receipt, Sparkles, RefreshCw, Network, Languages, Factory, Clock, UsersRound, HandCoins, ListChecks, Megaphone, Wrench, Headset, Frame, Gauge, Vault, Grid3x3, PackageOpen, CalendarDays } from "lucide-react";
import { logout } from "@/actions/auth";
import { can, type Permission, type Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; perm: Permission; badgeKey?: "orders" | "stock" }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" },
  { href: "/admin/network", label: "Network", icon: Network, perm: "insights" },
  { href: "/admin/pos", label: "Point of sale", icon: ScanBarcode, perm: "pos.sell" },
  { href: "/admin/orders", label: "Orders", icon: Package, perm: "orders", badgeKey: "orders" },
  { href: "/admin/fulfilment", label: "Fulfilment", icon: PackageOpen, perm: "orders" },
  { href: "/admin/picking", label: "Pick lists", icon: PackageCheck, perm: "orders" },
  { href: "/admin/closing", label: "Daily closing", icon: Lock, perm: "closing" },
  { href: "/admin/cash", label: "Cash", icon: Vault, perm: "closing" },
  { href: "/admin/cod", label: "COD remittance", icon: Banknote, perm: "closing" },
  { href: "/admin/care", label: "Customer care", icon: Headset, perm: "care" },
  { href: "/admin/notifications", label: "Notifications", icon: MessageCircle, perm: "orders" },
  { href: "/admin/products", label: "Products", icon: Shirt, perm: "catalog.view" },
  { href: "/admin/lookbook", label: "Lookbook", icon: Sparkles, perm: "catalog.edit" },
  { href: "/admin/nepali", label: "Nepali names", icon: Languages, perm: "catalog.edit" },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, perm: "catalog.view", badgeKey: "stock" },
  { href: "/admin/production", label: "Production", icon: Factory, perm: "production" },
  { href: "/admin/scorecard", label: "Shop scorecard", icon: Gauge, perm: "ops.manage" },
  { href: "/admin/ops", label: "Shop operations", icon: Megaphone, perm: "ops.manage" },
  { href: "/admin/people", label: "People", icon: UsersRound, perm: "people" },
  { href: "/admin/rosters", label: "Rosters", icon: CalendarDays, perm: "people" },
  { href: "/admin/payroll", label: "Payroll", icon: HandCoins, perm: "payroll" },
  { href: "/admin/today", label: "Today", icon: ListChecks, perm: "self.time" },
  { href: "/admin/visits", label: "Store visits", icon: ClipboardCheck, perm: "self.time" },
  { href: "/admin/vm", label: "Visual merchandising", icon: Frame, perm: "self.time" },
  { href: "/admin/issues", label: "Issues", icon: Wrench, perm: "self.time" },
  { href: "/admin/time", label: "My time", icon: Clock, perm: "self.time" },
  { href: "/admin/transfers", label: "Transfers", icon: ArrowLeftRight, perm: "transfers" },
  { href: "/admin/replenishment", label: "Replenishment", icon: RefreshCw, perm: "transfers" },
  { href: "/admin/bins", label: "Bins", icon: Grid3x3, perm: "stock.count" },
  { href: "/admin/counts", label: "Stock counts", icon: ClipboardCheck, perm: "stock.count" },
  { href: "/admin/locations", label: "Locations", icon: MapPin, perm: "locations" },
  { href: "/admin/purchasing", label: "Purchasing", icon: ClipboardList, perm: "purchasing" },
  { href: "/admin/payables", label: "Payables", icon: Receipt, perm: "purchasing" },
  { href: "/admin/insights", label: "Insights", icon: Lightbulb, perm: "insights" },
  { href: "/admin/finance", label: "Finance", icon: Wallet, perm: "finance" },
  { href: "/admin/customers", label: "Customers & team", icon: Users, perm: "customers" },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent, perm: "coupons" },
  { href: "/admin/delivery", label: "Delivery rates", icon: Truck, perm: "delivery" },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquare, perm: "reviews" },
  { href: "/admin/activity", label: "Activity log", icon: History, perm: "audit" },
  { href: "/admin/system", label: "System", icon: Activity, perm: "system" },
];

export function AdminNav({ badges, role }: { badges: { orders: number; stock: number }; role: Role }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.filter((n) => can(role, n.perm)).map(({ href, label, icon: Icon, badgeKey }) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        const badge = badgeKey ? badges[badgeKey as keyof typeof badges] : 0;
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-[14px]", active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}>
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            <span className="flex-1">{label}</span>
            {badge > 0 && <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", badgeKey === "stock" ? "bg-warn text-white" : "bg-white text-ink")}>{badge}</span>}
          </Link>
        );
      })}
      {can(role, "approve.discount") && <Link href="/admin/me" onClick={() => setOpen(false)} className={cn("mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-[14px]", path === "/admin/me" ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}><KeyRound className="h-4 w-4" /> My approval PIN</Link>}
      <Link href="/" className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-[14px] text-white/65 hover:bg-white/5 hover:text-white"><Store className="h-4 w-4" /> View store</Link>
      <form action={logout}>
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[14px] text-white/65 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button>
      </form>
    </nav>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-ink lg:flex">
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
