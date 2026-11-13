import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { isBot, recordFunnel } from "@/lib/funnel";
import { getCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { onlinePaymentsEnabled } from "@/lib/payments";
import { getDeliveryRates } from "@/lib/delivery";
import { store } from "@/lib/config";
import { CheckoutForm } from "@/components/cart/checkout-form";
import { stockByLocation } from "@/lib/stock";
import { TrackOnView } from "@/components/site/marketing";
import { rupees } from "@/lib/marketing-shared";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [cart, user, rates] = await Promise.all([getCart(), getCurrentUser(), getDeliveryRates()]);
  if (cart.lines.length === 0) redirect("/cart");
  if (!isBot((await headers()).get("user-agent"))) after(() => recordFunnel("checkout"));
  // click-and-collect points, and whether this whole bag is already on that shop's shelf
  const [shops, here] = await Promise.all([
    db.store.findMany({ where: { active: true, pickup: true, kind: "SHOP" }, select: { id: true, name: true, address: true, hours: true }, orderBy: [{ priority: "asc" }, { name: "asc" }] }),
    stockByLocation(cart.lines.map((l) => l.variantId)),
  ]);
  const pickupPoints = shops.map((s) => ({ ...s, readyNow: cart.lines.every((l) => (here.get(l.variantId)?.get(s.id) ?? 0) >= l.quantity) }));
  const addresses = user ? await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }) : [];
  const items = cart.lines.map((l) => ({ id: l.productId, name: l.name, price: rupees(l.unitPrice), quantity: l.quantity }));
  return (
    <>
    <TrackOnView event={{ name: "begin_checkout", items, value: rupees(cart.subtotal) }} />
    <CheckoutForm
      cart={cart}
      user={user && { name: user.name, email: user.email, phone: user.phone }}
      addresses={addresses.map((a) => ({ id: a.id, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, district: a.district, state: a.state, postalCode: a.postalCode, isDefault: a.isDefault }))}
      onlineEnabled={store.onlinePaymentsLive && onlinePaymentsEnabled()}
      rates={rates}
      pickupPoints={pickupPoints}
      initialCode={(await cookies()).get("asson_ref")?.value}
    />
    </>
  );
}
