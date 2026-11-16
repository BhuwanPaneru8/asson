"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { CartView } from "@/lib/cart";

type User = { id: string; name: string; email: string; role: string; /** from their default (or latest) saved address, for delivery estimates */ district?: string } | null;

type Ctx = {
  cart: CartView;
  user: User;
  wishlist: Set<string>;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const ShopContext = createContext<Ctx | null>(null);

export function ShopProvider({ cart, user, wishlist, children }: { cart: CartView; user: User; wishlist: string[]; children: React.ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const wl = useMemo(() => new Set(wishlist), [wishlist]);
  const value = useMemo(() => ({ cart, user, wishlist: wl, cartOpen, openCart, closeCart }), [cart, user, wl, cartOpen, openCart, closeCart]);
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside ShopProvider");
  return ctx;
}
