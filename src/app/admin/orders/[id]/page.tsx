import { can } from "@/lib/permissions";
import { exchangeOptions } from "@/lib/exchanges";
import { StaffExchange } from "@/components/admin/exchange-forms";
import { codRiskFor } from "@/lib/cod-risk";
import { EntityHistory } from "@/components/admin/entity-history";
import Image from "next/image";
import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { db } from "@/lib/db";
import { transitionsFor } from "@/lib/order-status";
import { store } from "@/lib/config";
import { TENDER_LABEL } from "@/lib/pos";
import { addressLines, formatDateTime, formatOrderNumber, formatPrice } from "@/lib/utils";
import { Card, Pill, StatusPill } from "@/components/admin/ui";
import { OrderControls } from "@/components/admin/order-controls";
import { CallPanel } from "@/components/admin/call-panel";

type Addr = { fullName: string; phone: string; line1: string; line2?: string | null; city: string; district?: string; state: string; postalCode?: string | null; zone?: string };

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("orders");
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { items: true, tenders: true, pickupStore: { select: { name: true, address: true } }, allocations: { select: { orderItemId: true, quantity: true, pickedAt: true, store: { select: { id: true, name: true } } } }, events: { orderBy: { createdAt: "desc" } }, user: { select: { id: true, name: true, createdAt: true, _count: { select: { orders: true } } } } } });
  if (!order) notFound();
  const a = order.shippingAddress as Addr;
  const exchange = order.status === "DELIVERED" && order.channel === "ONLINE" ? await exchangeOptions(order.id) : null;

  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Orders</Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-semibold">{formatOrderNumber(order.number)}</h1>
          <StatusPill status={order.status} />
          <Pill tone={order.paymentStatus === "PAID" ? "success" : "neutral"}>{order.paymentMethod === "COD" ? "COD" : order.paymentMethod === "IN_STORE" ? "Store sale" : "Prepaid"} · {order.paymentStatus.toLowerCase()}</Pill>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/orders/${order.id}/slip`} target="_blank" className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-[13.5px] hover:border-ink"><Printer className="h-4 w-4" /> Packing slip</Link>
          {order.channel === "ONLINE" && <Link href={`/admin/orders/${order.id}/label`} target="_blank" className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-[13.5px] hover:border-ink"><Printer className="h-4 w-4" /> Shipping label</Link>}
        </div>
      </div>
      <p className="-mt-4 mb-6 text-[13.5px] text-muted">{order.channel === "STORE" ? `Sold in store ${formatDateTime(order.createdAt)}` : `Placed ${formatDateTime(order.createdAt)} · ${order.shippingMethod === "express" ? "Express" : "Standard"} delivery`}</p>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title={`Items (${order.items.reduce((s, i) => s + i.quantity, 0)})`}>
            <ul className="divide-y divide-line">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-cloud">{it.image && <Image src={it.image} alt="" fill sizes="48px" className="object-cover" />}</div>
                  <div className="min-w-0 flex-1 text-[14px]">
                    <Link href={`/admin/products/${it.productId}`} className="font-medium hover:underline">{it.name}</Link>
                    <p className="text-[12.5px] text-muted">{it.color} · {it.size} · SKU {it.sku}</p>
                    {order.allocations.some((x) => x.orderItemId === it.id) && (
                      <p className="mt-0.5 text-[12px] text-muted">
                        From {order.allocations.filter((x) => x.orderItemId === it.id).map((x) => `${x.store.name}${x.quantity < it.quantity ? ` ×${x.quantity}` : ""}${x.pickedAt ? " ✓ picked" : ""}`).join(" + ")}
                      </p>
                    )}
                  </div>
                  <p className="text-[13.5px] tabular-nums text-muted">{formatPrice(it.unitPrice)} × {it.quantity}</p>
                  <p className="w-24 text-right text-[14px] font-medium tabular-nums">{formatPrice(it.unitPrice * it.quantity)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line px-5 py-4 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatPrice(order.subtotal)}</dd></div>
              {order.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount ({order.couponCode})</dt><dd className="tabular-nums">−{formatPrice(order.discount)}</dd></div>}
              {order.pointsDiscount > 0 && <div className="flex justify-between"><dt className="text-muted">Points redeemed ({order.pointsRedeemed})</dt><dd className="tabular-nums">−{formatPrice(order.pointsDiscount)}</dd></div>}
              {order.pointsEarned > 0 && <div className="flex justify-between text-[13px] text-muted"><dt>Points earned</dt><dd>+{order.pointsEarned}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd className="tabular-nums">{formatPrice(order.shippingFee)}</dd></div>
              <div className="flex justify-between pt-1 text-[15px] font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatPrice(order.total)}</dd></div>
              {order.discountReason && <div className="flex justify-between text-[13px] text-muted"><dt>Discount reason</dt><dd>{order.discountReason}{order.discountApprovedById ? " · approved" : ""}</dd></div>}
              {order.tenders.map((t) => <div key={t.id} className="flex justify-between text-[13px] text-muted"><dt>{TENDER_LABEL[t.method]}{t.reference ? ` (${t.reference})` : ""}</dt><dd className="tabular-nums">{formatPrice(t.amount)}</dd></div>)}
            </dl>
          </Card>

          <Card title="Activity">
            <ol className="space-y-4 px-5 py-4">
              {order.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-[14px]">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.status ? "bg-ink" : "bg-line"}`} />
                  <div><p>{e.message}</p><p className="text-[12.5px] text-muted">{formatDateTime(e.createdAt)} · {e.actor}</p></div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          {order.status === "PENDING" && order.paymentMethod === "COD" && order.channel === "ONLINE" && <CallPanel orderId={order.id} phone={order.phone} attempts={order.callAttempts} outcome={order.callOutcome} risk={(await codRiskFor([order])).get(order.id) ?? null} />}
          <OrderControls orderId={order.id} status={order.status} next={transitionsFor(order.status, !!order.pickupStoreId).filter((s) => s !== "RETURNING" && order.status !== "RETURNING")} pickupAt={order.pickupStore?.name} paymentPending={order.paymentStatus === "PENDING" && order.paymentMethod === "ONLINE"} carrier={order.carrier} tracking={order.trackingNumber} />
          {exchange && !exchange.blocked && can(me.role, "care") && exchange.items.some((i) => i.left > 0 && i.sizes.length > 0) && <Card title="Size exchange for the customer"><StaffExchange orderId={order.id} items={exchange.items} /></Card>}
          {exchange && exchange.open.length > 0 && <p className="rounded-md bg-accent-soft/50 px-4 py-2.5 text-[13.5px]">Open exchange{exchange.open.length > 1 ? "s" : ""}: {exchange.open.join(", ")} · <Link href="/admin/fulfilment/exchanges" className="underline">Exchanges</Link></p>}
          <Card title="Customer">
            <div className="space-y-1 px-5 py-4 text-[14px]">
              {order.user ? <Link href={`/admin/customers?q=${encodeURIComponent(order.email)}`} className="font-medium hover:underline">{order.user.name}</Link> : <p className="font-medium">Guest checkout</p>}
              <p className="text-ink-soft">{order.email}</p>
              <p className="text-ink-soft">{store.phonePrefix} {order.phone}</p>
              {order.user && <p className="text-[12.5px] text-muted">{order.user._count.orders} orders total</p>}
            </div>
          </Card>
          <Card title={order.channel === "STORE" ? "Store sale" : order.pickupStore ? `Pickup at ${order.pickupStore.name}` : "Ship to"}>
            {order.pickupStore && a && <p className="px-5 pt-4 text-[14px] leading-relaxed text-ink-soft">Collected by <b>{a.fullName}</b> · {a.phone}<br /><span className="text-muted">{order.pickupStore.address}</span></p>}
            {order.pickupStore && <div className="h-4" />}
            {a && !order.pickupStore && <p className="px-5 py-4 text-[14px] leading-relaxed text-ink-soft">{a.fullName}<br />{addressLines(a).map((l) => <span key={l}>{l}<br /></span>)}{a.phone}</p>}
            {order.customerNote && <p className="border-t border-line px-5 py-3 text-[13.5px]"><span className="font-medium">Note:</span> {order.customerNote}</p>}
          </Card>
          <EntityHistory type="Order" id={order.id} />
        </div>
      </div>
    </>
  );
}
