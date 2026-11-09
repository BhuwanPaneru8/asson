"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, Menu, ShoppingBag, User, ChevronRight } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { useShop } from "./shop-provider";
import type { NavCollection, NavItem } from "./mega-nav";

export function HeaderActions() {
  const { cart, user, openCart, wishlist } = useShop();
  return (
    <div className="flex items-center">
      <Link href={user ? "/account" : "/login"} className="hidden p-2.5 hover:bg-cloud sm:inline-flex" aria-label={user ? "Your account" : "Sign in"}>
        <User className="h-[21px] w-[21px]" strokeWidth={1.6} />
      </Link>
      <Link href="/account/wishlist" className="relative hidden p-2.5 hover:bg-cloud sm:inline-flex" aria-label="Wishlist">
        <Heart className="h-[21px] w-[21px]" strokeWidth={1.6} />
        {wishlist.size > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />}
      </Link>
      <button onClick={openCart} className="relative p-2.5 hover:bg-cloud" aria-label={`Bag, ${cart.count} items`}>
        <ShoppingBag className="h-[21px] w-[21px]" strokeWidth={1.6} />
        {cart.count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 text-[10.5px] font-semibold text-white">
            {cart.count > 99 ? "99+" : cart.count}
          </span>
        )}
      </button>
    </div>
  );
}

export function MobileNavButton({ nav, collections, hasSale = true, hasLooks = false }: { nav: NavItem[]; collections: NavCollection[]; hasSale?: boolean; hasLooks?: boolean }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const { user } = useShop();
  const close = () => { setOpen(false); setSection(null); };
  const current = nav.find((n) => n.slug === section);

  return (
    <>
      <button className="-ml-2 p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu className="h-6 w-6" strokeWidth={1.6} />
      </button>
      <Sheet open={open} onClose={close} side="left" title={current ? <button onClick={() => setSection(null)} className="text-muted">← All</button> : "Menu"}>
        {!current ? (
          <div className="flex flex-col">
            {nav.map((n) => (
              <button key={n.slug} onClick={() => setSection(n.slug)} className="flex items-center justify-between border-b border-line px-5 py-4 text-left text-[17px] font-medium">
                {n.name} <ChevronRight className="h-5 w-5 text-muted" />
              </button>
            ))}
            <Link onClick={close} href="/shop?sort=new" className="border-b border-line px-5 py-4 text-[17px] font-medium">New In</Link>
            {hasLooks && <Link onClick={close} href="/lookbook" className="border-b border-line px-5 py-4 text-[17px] font-medium">Lookbook</Link>}
            {hasSale && <Link onClick={close} href="/shop?sale=1" className="border-b border-line px-5 py-4 text-[17px] font-medium text-accent">Sale</Link>}
            <div className="px-5 py-6">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Collections</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {collections.map((c) => <Link key={c.slug} onClick={close} href={`/collections/${c.slug}`} className="text-[15px] text-ink-soft">{c.name}</Link>)}
              </div>
            </div>
            <div className="mt-auto space-y-3 border-t border-line px-5 py-6 text-[15px]">
              <Link onClick={close} href={user ? "/account" : "/login"} className="flex items-center gap-3"><User className="h-5 w-5" strokeWidth={1.6} /> {user ? `Hi, ${user.name.split(" ")[0]}` : "Sign in / Create account"}</Link>
              <Link onClick={close} href="/account/wishlist" className="flex items-center gap-3"><Heart className="h-5 w-5" strokeWidth={1.6} /> Wishlist</Link>
              <Link onClick={close} href="/track" className="block pl-8 text-muted">Track an order</Link>
              <Link onClick={close} href="/help" className="block pl-8 text-muted">Help & returns</Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <Link onClick={close} href={`/c/${current.slug}`} className="border-b border-line px-5 py-4 text-[17px] font-semibold">All {current.name}</Link>
            {current.children.map((c) => (
              <Link key={c.slug} onClick={close} href={`/c/${c.slug}`} className="border-b border-line px-5 py-4 text-[16px]">{c.name}</Link>
            ))}
            <Link onClick={close} href={`/c/${current.slug}?sort=new`} className="border-b border-line px-5 py-4 text-[16px] text-muted">New arrivals</Link>
            {hasSale && <Link onClick={close} href={`/c/${current.slug}?sale=1`} className="border-b border-line px-5 py-4 text-[16px] text-accent">Sale</Link>}
          </div>
        )}
      </Sheet>
    </>
  );
}
