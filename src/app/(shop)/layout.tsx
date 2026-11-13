import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { ShopProvider } from "@/components/site/shop-provider";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { getCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Suspense } from "react";
import { NavProgress } from "@/components/site/nav-progress";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [cart, user] = await Promise.all([getCart(), getCurrentUser()]);
  const wishlist = user ? (await db.wishlistItem.findMany({ where: { userId: user.id }, select: { productId: true } })).map((w) => w.productId) : [];
  return (
    <ShopProvider cart={cart} user={user && { id: user.id, name: user.name, email: user.email, role: user.role }} wishlist={wishlist}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:bg-ink focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      <Suspense fallback={null}><NavProgress /></Suspense>
      <Header />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
    </ShopProvider>
  );
}
