import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Package, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewOrder } from "@/lib/order-access";
import { CUSTOMER_CANCELLABLE, STATUS_LABEL } from "@/lib/orders";
import { store } from "@/lib/config";
import { addressLines, formatDate, formatOrderNumber, formatPrice, now } from "@/lib/utils";
import { OrderProgress } from "@/components/account/order-timeline";
import { OrderActions } from "@/components/account/order-actions";
import { Badge } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

type Addr = { fullName: string; phone: string; line1: string; line2?: string | null; city: string; district?: string; state: string; postalCode?: string | null; zone?: string; etaMaxDays?: number };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const [{ id }, { placed }, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const order = await db.order.findUnique({ where: { id }, include: { items: true, events: { orderBy: { createdAt: "asc" } } } });
  // Account orders are private to their owner (and staff); guest orders are reachable via their unguessable link.
  if (!order || !canViewOrder(order, user)) notFound();

  const a = order.shippingAddress as Addr;
  const deliveredAt = order.events.find((e) => e.status === "DELIVERED")?.createdAt;
  const canReturn = order.status === "DELIVERED" && !!deliveredAt && now() - deliveredAt.getTime() < store.returnWindowDays * 86400000;
  const etaDays = a?.etaMaxDays ?? (order.shippingMethod === "express" ? 1 : a?.zone === "VALLEY" ? 2 : a?.zone === "REMOTE" ? 10 : 5);
  const eta = new Date(order.createdAt); eta.setDate(eta.getDate() + etaDays);

  return (
    <div className="container-page max-w-5xl py-8 md:py-12">
      {placed && (
        <div className="mb-10 flex flex-col items-center text-center">
          <CheckCircle2 className="h-14 w-14 text-success" strokeWidth={1.3} />
          <h1 className="mt-4 font-display text-4xl">Thank you{a?.fullName ? `, ${a.fullName.split(" ")[0]}` : ""}!</h1>
          <p className="mt-2 max-w-md text-[15px] text-muted">Your order <b className="text-ink">{formatOrderNumber(order.number)}</b> is confirmed. We&apos;ve sent the details to {order.email}.</p>
          {!order.userId && <p className="mt-3 max-w-md text-[13.5px] text-muted">Bookmark this page to track your order, or <Link href="/register" className="underline">create an account</Link> to keep all your orders in one place.</p>}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {!placed && <h1 className="font-display text-3xl">Order {formatOrderNumber(order.number)}</h1>}
          <p className="mt-1 text-[14px] text-muted">Placed on {formatDate(order.createdAt)} · {order.items.reduce((s, i) => s + i.quantity, 0)} items</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={order.status === "CANCELLED" ? "danger" : order.status === "DELIVERED" ? "success" : "neutral"}>{STATUS_LABEL[order.status]}</Badge>
          <Badge tone={order.paymentStatus === "PAID" ? "success" : order.paymentStatus === "REFUNDED" ? "warn" : "neutral"}>{order.paymentMethod === "COD" ? "Cash on delivery" : "Prepaid"} · {order.paymentStatus.toLowerCase()}</Badge>
        </div>
      </div>

      <div className="mt-8 border border-line bg-white p-5 md:p-8">
        <OrderProgress status={order.status} events={order.events} />
        {!["DELIVERED", "CANCELLED", "RETURNED", "RETURN_REQUESTED"].includes(order.status) && (
          <p className="mt-6 flex items-center gap-2 text-[14px]"><Truck className="h-4 w-4" /> Estimated delivery by <b>{formatDate(eta)}</b></p>
        )}
        {order.trackingNumber && <p className="mt-2 flex items-center gap-2 text-[14px] text-muted"><Package className="h-4 w-4" /> {order.carrier} · AWB {order.trackingNumber}</p>}
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-12">
        <div className="md:col-span-7">
          <h2 className="mb-4 text-[16px] font-semibold">Items</h2>
          <ul className="divide-y divide-line border-y border-line">
            {order.items.map((it) => (
              <li key={it.id} className="flex gap-4 py-4">
                <Link href={`/p/${it.slug}`} className="relative h-24 w-[72px] shrink-0 bg-cloud">{it.image && <Image src={it.image} alt="" fill sizes="72px" className="object-cover" />}</Link>
                <div className="flex-1 text-[14px]">
                  <Link href={`/p/${it.slug}`} className="font-medium hover:text-accent">{it.name}</Link>
                  <p className="text-muted">{it.color} · Size {it.size} · Qty {it.quantity}</p>
                  {order.status === "DELIVERED" && <Link href={`/p/${it.slug}#reviews`} className="mt-1 inline-block text-[13px] underline underline-offset-4">Write a review</Link>}
                </div>
                <p className="text-[14px] font-medium">{formatPrice(it.unitPrice * it.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6"><OrderActions orderId={order.id} canCancel={CUSTOMER_CANCELLABLE.includes(order.status)} canReturn={canReturn} /></div>
        </div>
        <div className="space-y-6 md:col-span-5">
          <div className="border border-line bg-white p-5">
            <h3 className="mb-2 text-[14px] font-semibold">Delivery address</h3>
            {a && <p className="text-[14px] leading-relaxed text-ink-soft">{a.fullName}<br />{addressLines(a).map((l) => <span key={l}>{l}<br /></span>)}{a.phone}</p>}
          </div>
          <div className="border border-line bg-white p-5">
            <h3 className="mb-3 text-[14px] font-semibold">Payment summary</h3>
            <dl className="space-y-2 text-[14px]">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
              {order.discount > 0 && <div className="flex justify-between text-success"><dt>Discount {order.couponCode && `(${order.couponCode})`}</dt><dd>−{formatPrice(order.discount)}</dd></div>}
              {order.pointsDiscount > 0 && <div className="flex justify-between text-success"><dt>Asson points ({order.pointsRedeemed})</dt><dd>−{formatPrice(order.pointsDiscount)}</dd></div>}
              <div className="flex justify-between"><dt>Delivery</dt><dd>{order.shippingFee ? formatPrice(order.shippingFee) : "Free"}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold"><dt>Total</dt><dd>{formatPrice(order.total)}</dd></div>
            </dl>
          </div>
          <p className="text-[13px] text-muted">Need help? Call {store.supportPhone} or email {store.supportEmail} with your order number.</p>
        </div>
      </div>
      {placed && <div className="mt-12 text-center"><Link href="/shop" className={buttonClass("secondary")}>Continue shopping</Link></div>}
    </div>
  );
}
