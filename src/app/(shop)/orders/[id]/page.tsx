import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Package, Store, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewOrder } from "@/lib/order-access";
import { exchangeOptions } from "@/lib/exchanges";
import { BuyAgain, OrderChange } from "@/components/account/order-change";
import { CUSTOMER_CANCELLABLE } from "@/lib/orders";
import { store } from "@/lib/config";
import { addressLines, formatDate, formatOrderNumber, formatPrice, now } from "@/lib/utils";
import { OrderProgress } from "@/components/account/order-timeline";
import { OrderActions } from "@/components/account/order-actions";
import { Badge } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";
import { TrackOnView } from "@/components/site/marketing";
import { rupees } from "@/lib/marketing-shared";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

type Addr = { pickup?: boolean; store?: string; storeAddress?: string; hours?: string | null; storePhone?: string | null; fullName: string; phone: string; line1: string; line2?: string | null; city: string; district?: string; state: string; postalCode?: string | null; zone?: string; etaMaxDays?: number };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const [{ id }, { placed }, user, { t }] = await Promise.all([params, searchParams, getCurrentUser(), getT()]);
  const order = await db.order.findUnique({ where: { id }, include: { items: true, events: { orderBy: { createdAt: "asc" } } } });
  // Account orders are private to their owner (and staff); guest orders are reachable via their unguessable link.
  if (!order || !canViewOrder(order, user)) notFound();

  const a = order.shippingAddress as Addr;
  const invoiced = !!(await db.taxInvoice.findUnique({ where: { orderId: order.id }, select: { id: true } }));
  const pickup = !!order.pickupStoreId;
  const deliveredAt = order.events.find((e) => e.status === "DELIVERED")?.createdAt;
  const ex = order.status === "DELIVERED" && order.channel === "ONLINE" ? await exchangeOptions(order.id) : null;
  const exchanged = !!ex && (ex.order.exchangeFor != null || (await db.exchange.count({ where: { orderId: order.id, status: { not: "CANCELLED" } } })) > 0);
  // before packing the customer can change it themselves (not shop sales or exchange replacements)
  const mine = !order.userId || order.userId === user?.id; // staff looking at someone's order use the admin page
  const changeable = mine && order.channel === "ONLINE" && (order.status === "PENDING" || order.status === "CONFIRMED") && !(await db.exchange.count({ where: { replacementId: order.id } }));
  const swapTo = changeable ? await db.variant.findMany({ where: { productId: { in: order.items.map((i) => i.productId) }, stock: { gt: 0 }, product: { status: "ACTIVE" } }, orderBy: { position: "asc" }, select: { id: true, productId: true, color: true, size: true } }) : [];
  const canReturn = order.status === "DELIVERED" && !exchanged && !!deliveredAt && now() - deliveredAt.getTime() < store.returnWindowDays * 86400000;
  const etaDays = a?.etaMaxDays ?? (order.shippingMethod === "express" ? 1 : a?.zone === "VALLEY" ? 2 : a?.zone === "REMOTE" ? 10 : 5);
  const eta = new Date(order.createdAt); eta.setDate(eta.getDate() + etaDays);

  return (
    <div className="container-page max-w-5xl py-8 md:py-12">
      {/* reported once per order, and only just after it was placed (an old ?placed=1 link doesn't count it again) */}
      {placed && now() - order.createdAt.getTime() < 60 * 60_000 && (
        <TrackOnView
          once={`asson_purchase_${order.id}`}
          event={{ name: "purchase", orderId: order.id, value: rupees(order.total), items: order.items.filter((i) => i.productId).map((i) => ({ id: i.productId!, name: i.name, price: rupees(i.unitPrice), quantity: i.quantity })) }}
        />
      )}
      {placed && (
        <div className="mb-10 flex flex-col items-center text-center">
          <CheckCircle2 className="h-14 w-14 text-success" strokeWidth={1.3} />
          <h1 className="mt-4 font-display text-4xl">{a?.fullName ? t("ord.thanksName", { name: a.fullName.split(" ")[0] }) : t("ord.thanks")}</h1>
          <p className="mt-2 max-w-md text-[15px] text-muted">{rich(t("ord.confirmed", { email: order.email }), { number: <b className="text-ink">{formatOrderNumber(order.number)}</b> })}</p>
          {!order.userId && <p className="mt-3 max-w-md text-[13.5px] text-muted">{rich(t("ord.guest"), { link: <Link href="/register" className="underline">{t("ord.createAccount")}</Link> })}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {!placed && <h1 className="font-display text-3xl">{t("ord.title", { number: formatOrderNumber(order.number) })}</h1>}
          <p className="mt-1 text-[14px] text-muted">{t("ord.placedOn", { date: formatDate(order.createdAt), n: order.items.reduce((s, i) => s + i.quantity, 0) })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={order.status === "CANCELLED" ? "danger" : order.status === "DELIVERED" ? "success" : "neutral"}>{t(pickup && order.status === "PACKED" ? "status.readyForPickup" : pickup && order.status === "DELIVERED" ? "status.collected" : `status.${order.status}`)}</Badge>
          <Badge tone={order.paymentStatus === "PAID" ? "success" : order.paymentStatus === "REFUNDED" ? "warn" : "neutral"}>{order.paymentMethod === "COD" ? (pickup ? t("co.payAtShop") : t("pay.cod")) : t("ord.prepaid")} · {t(`paystatus.${order.paymentStatus}`)}</Badge>
        </div>
      </div>

      <div className="mt-8 border border-line bg-white p-5 md:p-8">
        <OrderProgress status={order.status} events={order.events} pickup={pickup} t={t} />
        {pickup && order.status === "PACKED" && (
          <p className="mt-6 flex items-center gap-2 text-[14px]"><Store className="h-4 w-4 shrink-0" /> <span>{rich(order.paymentStatus !== "PAID" ? t("ord.readyAtPay", { amount: formatPrice(order.total) }) : t("ord.readyAt"), { store: <b>{a.store}</b> })}</span></p>
        )}
        {pickup && ["PENDING", "CONFIRMED"].includes(order.status) && (
          <p className="mt-6 flex items-center gap-2 text-[14px]"><Store className="h-4 w-4 shrink-0" /> <span>{rich(t("ord.willText"), { store: <b>{a.store}</b> })}</span></p>
        )}
        {!pickup && !["DELIVERED", "CANCELLED", "RETURNED", "RETURN_REQUESTED"].includes(order.status) && (
          <p className="mt-6 flex items-center gap-2 text-[14px]"><Truck className="h-4 w-4" /> <span>{rich(t("ord.eta"), { date: <b>{formatDate(eta)}</b> })}</span></p>
        )}
        {order.trackingNumber && <p className="mt-2 flex items-center gap-2 text-[14px] text-muted"><Package className="h-4 w-4" /> {order.carrier} · AWB {order.trackingNumber}</p>}
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-12">
        <div className="md:col-span-7">
          <h2 className="mb-4 text-[16px] font-semibold">{t("ord.items")}</h2>
          <ul className="divide-y divide-line border-y border-line">
            {order.items.map((it) => (
              <li key={it.id} className="flex gap-4 py-4">
                <Link href={`/p/${it.slug}`} className="relative h-24 w-[72px] shrink-0 bg-cloud">{it.image && <Image src={it.image} alt="" fill sizes="72px" className="object-cover" />}</Link>
                <div className="flex-1 text-[14px]">
                  <Link href={`/p/${it.slug}`} className="font-medium hover:text-accent">{it.name}</Link>
                  <p className="text-muted">{t("ord.itemLine", { color: it.color, size: it.size, qty: it.quantity })}</p>
                  {order.status === "DELIVERED" && <Link href={`/p/${it.slug}#reviews`} className="mt-1 inline-block text-[13px] underline underline-offset-4">{t("ord.review")}</Link>}
                </div>
                <p className="text-[14px] font-medium">{formatPrice(it.unitPrice * it.quantity)}</p>
              </li>
            ))}
          </ul>
          {ex && ex.open.length > 0 && <p className="mt-6 bg-accent-soft/50 p-3 text-[14px]">{t("ex.open", { ref: ex.open.join(", ") })}</p>}
          {changeable && <div className="mt-6"><OrderChange orderId={order.id} paid={order.paymentStatus === "PAID"} addr={pickup ? null : { fullName: a.fullName, phone: a.phone, line1: a.line1, city: a.city, district: a.district ?? "" }}
            items={order.items.map((i) => ({ id: i.id, name: i.name, color: i.color, size: i.size, quantity: i.quantity, sizes: swapTo.filter((v) => v.productId === i.productId && v.id !== i.variantId).map((v) => ({ variantId: v.id, label: `${v.color} ${v.size}` })) }))} /></div>}
          {mine && ["DELIVERED", "CANCELLED", "RETURNED"].includes(order.status) && order.channel === "ONLINE" && <div className="mt-6"><BuyAgain orderId={order.id} /></div>}
          {invoiced && <p className="mt-6"><Link href={`/orders/${order.id}/invoice`} className="text-[14px] underline underline-offset-4">{t("ord.invoice")}</Link></p>}
          <div className="mt-6"><OrderActions orderId={order.id} canCancel={CUSTOMER_CANCELLABLE.includes(order.status)} canReturn={canReturn} exchange={ex && !ex.blocked ? ex.items : []} /></div>
        </div>
        <div className="space-y-6 md:col-span-5">
          <div className="border border-line bg-white p-5">
            <h3 className="mb-2 text-[14px] font-semibold">{pickup ? t("ord.pickupAt") : t("co.address")}</h3>
            {pickup && <p className="text-[14px] leading-relaxed text-ink-soft"><b className="text-ink">{a.store}</b><br />{a.storeAddress}{a.hours && <><br />{a.hours}</>}{a.storePhone && <><br />{a.storePhone}</>}<br /><span className="text-muted">{t("ord.collecting", { name: a.fullName })}</span></p>}
            {!pickup && a && <p className="text-[14px] leading-relaxed text-ink-soft">{a.fullName}<br />{addressLines(a).map((l) => <span key={l}>{l}<br /></span>)}{a.phone}</p>}
          </div>
          <div className="border border-line bg-white p-5">
            <h3 className="mb-3 text-[14px] font-semibold">{t("ord.paySummary")}</h3>
            <dl className="space-y-2 text-[14px]">
              <div className="flex justify-between"><dt>{t("bag.subtotal")}</dt><dd>{formatPrice(order.subtotal)}</dd></div>
              {order.discount > 0 && <div className="flex justify-between text-success"><dt>{order.couponCode ? t("ord.discountCode", { code: order.couponCode }) : t("sum.discount")}</dt><dd>−{formatPrice(order.discount)}</dd></div>}
              {order.pointsDiscount > 0 && <div className="flex justify-between text-success"><dt>{t("ord.points", { n: order.pointsRedeemed })}</dt><dd>−{formatPrice(order.pointsDiscount)}</dd></div>}
              <div className="flex justify-between"><dt>{pickup ? t("sum.pickup") : t("sum.delivery")}</dt><dd>{order.shippingFee ? formatPrice(order.shippingFee) : t("ship.free")}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold"><dt>{t("sum.total")}</dt><dd>{formatPrice(order.total)}</dd></div>
            </dl>
          </div>
          <p className="text-[13px] text-muted"><Link href={`/help?order=${formatOrderNumber(order.number)}#write`} className="font-medium text-ink underline underline-offset-4">{t("care.problemWithOrder")}</Link> {t("ord.help", { phone: store.supportPhone, email: store.supportEmail })}</p>
        </div>
      </div>
      {placed && <div className="mt-12 text-center"><Link href="/shop" className={buttonClass("secondary")}>{t("bag.continue")}</Link></div>}
    </div>
  );
}
