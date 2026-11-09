import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { onlinePaymentsEnabled } from "@/lib/payments";
import { getDeliveryRates } from "@/lib/delivery";
import { store } from "@/lib/config";
import { CheckoutForm } from "@/components/cart/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [cart, user, rates] = await Promise.all([getCart(), getCurrentUser(), getDeliveryRates()]);
  if (cart.lines.length === 0) redirect("/cart");
  const addresses = user ? await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }) : [];
  return (
    <CheckoutForm
      cart={cart}
      user={user && { name: user.name, email: user.email, phone: user.phone }}
      addresses={addresses.map((a) => ({ id: a.id, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, district: a.district, state: a.state, postalCode: a.postalCode, isDefault: a.isDefault }))}
      onlineEnabled={store.onlinePaymentsLive && onlinePaymentsEnabled()}
      rates={rates}
    />
  );
}
