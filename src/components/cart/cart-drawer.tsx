"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useShop } from "@/components/site/shop-provider";
import { formatPrice } from "@/lib/utils";
import { CartLine, FreeShippingBar } from "./cart-line";

export function CartDrawer() {
  const { cart, cartOpen, closeCart } = useShop();
  const blocked = cart.lines.some((l) => !l.available);
  return (
    <Sheet
      open={cartOpen}
      onClose={closeCart}
      title={<>Your bag <span className="font-normal text-muted">({cart.count})</span></>}
      footer={
        cart.lines.length > 0 && (
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between text-[15px]">
              <span>Subtotal</span>
              <span className="font-semibold">{formatPrice(cart.subtotal)}</span>
            </div>
            <p className="text-[12.5px] text-muted">Delivery and discounts calculated at checkout. Prices include 13% VAT.</p>
            <Link href="/checkout" onClick={closeCart} aria-disabled={blocked} className={buttonClass("primary", "lg", `w-full ${blocked ? "pointer-events-none opacity-40" : ""}`)}>
              Checkout
            </Link>
            <Link href="/cart" onClick={closeCart} className={buttonClass("secondary", "md", "w-full")}>View bag</Link>
          </div>
        )
      }
    >
      {cart.lines.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-10 w-10" strokeWidth={1.2} />} title="Your bag is empty" body="Find something you love — new arrivals land every week." action={<Link href="/shop?sort=new" onClick={closeCart} className={buttonClass()}>Shop new arrivals</Link>} />
      ) : (
        <div>
          <div className="border-b border-line bg-cloud/60 px-5 py-4"><FreeShippingBar subtotal={cart.subtotal} /></div>
          <div className="divide-y divide-line px-5">
            {cart.lines.map((l) => <div key={l.id} className="py-5"><CartLine line={l} onNavigate={closeCart} compact /></div>)}
          </div>
        </div>
      )}
    </Sheet>
  );
}
