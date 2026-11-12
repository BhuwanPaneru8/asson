import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store as storeCfg } from "./config";
import { getDeliveryRates } from "./delivery";
import { deliveryFee, rateFor } from "./delivery-shared";
import { allocateOrder, StockError, stockByLocation } from "./stock";
import { queueOrderNotice } from "./notifications";
import { withProvince } from "./validators";
import { formatOrderNumber, formatPrice } from "./utils";

// Ordering from another location at the till. When a size isn't on the shop's shelf, the cashier sees where else it
// is and orders it for the customer there and then: to collect at this shop later (the usual click-and-collect
// flow: packed, then handed over at this till) or delivered to their address (the normal courier flow). They pay
// now at the till (a tender on this shift, in the drawer count) or later (at collection, or cash on delivery). The
// order is confirmed straight away (the customer is standing there) and remembers the shop that took it.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class ShopOrderError extends Error {}

/** Where else each size is in stock: other locations that send orders (the ones an order can be filled from), most first. */
export async function stockElsewhere(variantIds: string[], hereStoreId: string) {
  const [by, stores] = await Promise.all([stockByLocation(variantIds), db.store.findMany({ where: { active: true, shipsOnline: true, id: { not: hereStoreId } }, select: { id: true, name: true } })]);
  const name = new Map(stores.map((s) => [s.id, s.name]));
  return new Map(variantIds.map((v) => [v, [...(by.get(v) ?? new Map()).entries()].filter(([sid, q]) => q > 0 && name.has(sid)).map(([sid, q]) => ({ storeId: sid, name: name.get(sid)!, quantity: q as number })).sort((a, b) => b.quantity - a.quantity)]));
}

export type ShopOrderInput = {
  clientRef: string;
  lines: { variantId: string; quantity: number }[];
  customer: { name: string; phone: string };
  fulfil: "PICKUP" | "DELIVERY";
  address?: { line1: string; city: string; district: string };
  pay: "NOW" | "LATER";
  tender?: { method: "CASH" | "ESEWA_QR" | "KHALTI_QR" | "FONEPAY_QR" | "CARD" | "BANK"; tendered?: number; reference?: string };
};

export async function createShopOrder(tx: Tx, cashier: Actor & { email: string }, shift: { id: string; storeId: string }, d: ShopOrderInput) {
  const existing = await tx.order.findUnique({ where: { clientRef: d.clientRef }, select: { id: true, number: true, total: true } });
  if (existing) return { ...existing, change: 0, duplicate: true }; // a double tap returns the first order
  const name = d.customer.name.trim().slice(0, 80), phone = d.customer.phone.trim();
  if (name.length < 2) throw new ShopOrderError("Enter the customer's name.");
  if (!/^9[678]\d{8}$/.test(phone)) throw new ShopOrderError("Enter the customer's 10-digit mobile number (for the SMS when it's ready).");
  const qty = new Map<string, number>();
  for (const l of d.lines) { if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new ShopOrderError("Quantities are whole units."); qty.set(l.variantId, (qty.get(l.variantId) ?? 0) + l.quantity); }
  if (!qty.size) throw new ShopOrderError("Add what the customer wants.");
  const variants = await tx.variant.findMany({ where: { id: { in: [...qty.keys()] } }, include: { product: { select: { id: true, name: true, slug: true, price: true, status: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } } } });
  if (variants.length !== qty.size) throw new ShopOrderError("An item no longer exists. Search again.");
  const off = variants.find((v) => v.product.status !== "ACTIVE");
  if (off) throw new ShopOrderError(`${off.product.name} isn't for sale.`);
  const shop = await tx.store.findUniqueOrThrow({ where: { id: shift.storeId }, select: { id: true, name: true, address: true, hours: true, phone: true, district: true, pickup: true } });

  const subtotal = variants.reduce((s, v) => s + v.product.price * qty.get(v.id)!, 0);
  let shippingFee = 0, district: string | null = null;
  let shippingAddress: Prisma.InputJsonValue;
  if (d.fulfil === "DELIVERY") {
    const a = d.address;
    if (!a || a.line1.trim().length < 3 || a.city.trim().length < 2 || !a.district) throw new ShopOrderError("Enter the delivery address: street, city and district.");
    const rate = rateFor(await getDeliveryRates(), a.district);
    if (!rate) throw new ShopOrderError(`We don't deliver to ${a.district} yet.`);
    shippingFee = deliveryFee("standard", rate, subtotal, false);
    district = a.district;
    shippingAddress = { ...withProvince({ fullName: name, phone, line1: a.line1.trim(), city: a.city.trim(), district: a.district }), country: storeCfg.country } as Prisma.InputJsonValue;
  } else {
    district = shop.district;
    shippingAddress = { pickup: true, storeId: shop.id, store: shop.name, storeAddress: shop.address, hours: shop.hours, storePhone: shop.phone, fullName: name, phone, country: storeCfg.country };
  }
  const total = subtotal + shippingFee;

  let change = 0;
  if (d.pay === "NOW") {
    const t = d.tender;
    if (!t) throw new ShopOrderError(`Take ${formatPrice(total)} now, or choose "pay later".`);
    if (t.method === "CASH") { const given = t.tendered ?? total; if (given < total) throw new ShopOrderError("Cash received is less than the total."); change = given - total; }
    else if (!t.reference?.trim()) throw new ShopOrderError("Enter the payment reference.");
  }
  const customer = await tx.user.findFirst({ where: { phone, role: "CUSTOMER" }, select: { id: true, email: true } });
  const paidNow = d.pay === "NOW";
  const where = d.fulfil === "PICKUP" ? `to collect here at ${shop.name}` : `for delivery to ${district}`;
  const o = await tx.order.create({
    data: {
      channel: "ONLINE", clientRef: d.clientRef, userId: customer?.id ?? null, email: customer?.email ?? "", phone,
      status: "CONFIRMED", paymentMethod: paidNow ? "IN_STORE" : "COD", paymentStatus: paidNow ? "PAID" : "PENDING",
      subtotal, discount: 0, shippingFee, total, shippingMethod: d.fulfil === "PICKUP" ? "pickup" : "standard", shippingAddress,
      pickupStoreId: d.fulfil === "PICKUP" ? shop.id : null, takenAtStoreId: shop.id, cashierId: cashier.id,
      // paid at this till: the money is on this shift (drawer count and closing)
      shiftId: paidNow ? shift.id : null,
      callOutcome: "CONFIRMED",
      items: { create: variants.map((v) => ({ variantId: v.id, productId: v.product.id, name: v.product.name, slug: v.product.slug, sku: v.sku, color: v.color, size: v.size, image: v.product.images[0]?.url ?? "", unitPrice: v.product.price, quantity: qty.get(v.id)!, unitCost: v.costPrice })) },
      ...(paidNow ? { tenders: { create: [{ method: d.tender!.method, amount: total, tendered: d.tender!.method === "CASH" ? d.tender!.tendered ?? total : null, reference: d.tender!.reference?.trim() || null }] } } : {}),
      events: { create: [{ status: "CONFIRMED", actor: cashier.email, message: `Ordered at ${shop.name} by ${cashier.name}, ${where}${paidNow ? `, paid ${formatPrice(total)} at the till` : ", to pay later"}` }] },
    },
    select: { id: true, number: true, total: true, items: { select: { id: true, variantId: true, quantity: true, name: true, size: true } } },
  });
  try {
    // from wherever has it, nearest to where it's going (this shop for a pickup)
    await allocateOrder(tx, { orderId: o.id, lines: o.items.map((i) => ({ orderItemId: i.id, variantId: i.variantId!, quantity: i.quantity, label: `${i.name} (${i.size})` })), toDistrict: district, actorId: cashier.id, note: `Ordered at ${shop.name}` });
  } catch (e) {
    if (e instanceof StockError) throw new ShopOrderError(`${e.message} It may have just sold: search again.`);
    throw e;
  }
  for (const v of variants) await tx.product.update({ where: { id: v.product.id }, data: { soldCount: { increment: qty.get(v.id)! } } });
  await queueOrderNotice(tx, o.id, "confirmed");
  await audit(tx, cashier, { action: "pos.order", entity: ["Order", o.id], summary: `${formatOrderNumber(o.number)} ordered at ${shop.name} for ${name}: ${formatPrice(total)}, ${where}${paidNow ? `, paid by ${d.tender!.method.toLowerCase()}` : ", pay later"}` });
  return { id: o.id, number: o.number, total: o.total, change, duplicate: false };
}
