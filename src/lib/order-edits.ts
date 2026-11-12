import "server-only";
import type { Prisma } from "@prisma/client";
import { audit, type AuditActor } from "./audit";
import { getDeliveryRates } from "./delivery";
import { deliveryFee, rateFor } from "./delivery-shared";
import { allocateOrder, moveStock, StockError } from "./stock";
import { queueOrderNotice } from "./notifications";
import { addressFields, withProvince } from "./validators";
import { formatOrderNumber, formatPrice } from "./utils";

// Changing an order before it's packed, when the customer calls: a new address or phone, a different size, fewer
// items. Stock follows exactly: units taken off the order go back to the location that reserved them (even if
// already picked, they're put back), and a new size is reserved like a new order. Money is recalculated for unpaid
// orders (discount scaled with the goods, delivery fee for the district and threshold). A paid order keeps its
// total: its size can be swapped (same price) and its address changed (delivery fee unchanged), but taking items
// off would need a refund, so it's cancelled instead.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class EditError extends Error {}

const EDITABLE = ["PENDING", "CONFIRMED"] as const;

async function load(tx: Tx, orderId: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  if (!row) throw new EditError("Order not found.");
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { allocations: true } }, exchangeFor: { select: { id: true } } } });
  if (o.channel !== "ONLINE") throw new EditError("Shop sales are changed at the till (return or exchange).");
  if (!(EDITABLE as readonly string[]).includes(o.status)) throw new EditError(`${formatOrderNumber(o.number)} is ${o.status.toLowerCase().replace(/_/g, " ")}: only orders not yet packed can be changed.`);
  if (o.exchangeFor) throw new EditError("This is an exchange's replacement: change the exchange instead.");
  return o;
}
type Loaded = Awaited<ReturnType<typeof load>>;

/** Put `quantity` units of an order line back where they were reserved (latest reservation first). */
async function release(tx: Tx, o: Loaded, item: Loaded["items"][number], quantity: number, actorId: string, note: string) {
  let left = quantity;
  for (const a of [...item.allocations].sort((x, y) => +y.createdAt - +x.createdAt)) {
    if (!left) break;
    const n = Math.min(left, a.quantity);
    if (a.variantId) await moveStock(tx, { variantId: a.variantId, storeId: a.storeId, delta: n, reason: "CANCEL_RESTOCK", orderId: o.id, actorId, note });
    if (n === a.quantity) await tx.orderAllocation.delete({ where: { id: a.id } });
    else await tx.orderAllocation.update({ where: { id: a.id }, data: { quantity: { decrement: n } } });
    left -= n;
  }
}

/** Recalculate an unpaid order's money from its lines: discount in proportion, points as they were, delivery fee. */
async function reprice(tx: Tx, o: Loaded) {
  const items = await tx.orderItem.findMany({ where: { orderId: o.id }, select: { unitPrice: true, quantity: true } });
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discount = o.subtotal ? Math.round((o.discount * subtotal) / o.subtotal) : 0;
  if (o.pointsDiscount > subtotal - discount) throw new EditError("The customer's points would be worth more than what's left in the order. Remove less, or cancel the order.");
  let shippingFee = o.shippingFee;
  const a = o.shippingAddress as { district?: string; pickup?: boolean } | null;
  if (!o.pickupStoreId && a?.district) {
    const rate = rateFor(await getDeliveryRates(), a.district);
    if (rate) shippingFee = deliveryFee(o.shippingMethod === "express" ? "express" : "standard", rate, subtotal - discount, false);
  }
  const total = subtotal - discount - o.pointsDiscount + shippingFee;
  await tx.order.update({ where: { id: o.id }, data: { subtotal, discount, shippingFee, total } });
  return { subtotal, discount, shippingFee, total };
}

/** Fewer units of a line (0 takes it off). Unpaid orders only; the order can't end up empty. */
export async function reduceItem(tx: Tx, user: Actor, d: { orderId: string; orderItemId: string; quantity: number }) {
  const o = await load(tx, d.orderId);
  if (o.paymentStatus === "PAID") throw new EditError("This order is paid: taking items off needs a refund. Cancel the order and place a new one instead.");
  const item = o.items.find((i) => i.id === d.orderItemId);
  if (!item) throw new EditError("That item isn't on this order.");
  if (!Number.isInteger(d.quantity) || d.quantity < 0 || d.quantity >= item.quantity) throw new EditError(`Choose fewer than ${item.quantity}.`);
  const remove = item.quantity - d.quantity;
  if (o.items.reduce((s, i) => s + i.quantity, 0) - remove <= 0) throw new EditError("That would leave nothing on the order: cancel it instead.");
  const ref = formatOrderNumber(o.number);
  await release(tx, o, item, remove, user.id, `${ref}: ${remove} taken off the order`);
  if (d.quantity === 0) await tx.orderItem.delete({ where: { id: item.id } });
  else await tx.orderItem.update({ where: { id: item.id }, data: { quantity: d.quantity } });
  await tx.product.update({ where: { id: item.productId }, data: { soldCount: { decrement: remove } } });
  const was = o.total;
  const m = await reprice(tx, o);
  const what = `${item.name} ${item.color} ${item.size}: ${item.quantity} → ${d.quantity}`;
  await tx.orderEvent.create({ data: { orderId: o.id, actor: user.name, message: `Changed: ${what}. New total ${formatPrice(m.total)}` } });
  await queueOrderNotice(tx, o.id, "updated");
  await audit(tx, user, { action: "order.edit", entity: ["Order", o.id], summary: `${ref}: ${what}; total ${formatPrice(was)} → ${formatPrice(m.total)}` });
  return m;
}

/** A different size (or colour) of the same product for some or all units of a line. The price stays the same. */
export async function swapSize(tx: Tx, user: Actor, d: { orderId: string; orderItemId: string; newVariantId: string; quantity?: number }) {
  const o = await load(tx, d.orderId);
  const item = o.items.find((i) => i.id === d.orderItemId);
  if (!item) throw new EditError("That item isn't on this order.");
  const qty = d.quantity ?? item.quantity;
  if (!Number.isInteger(qty) || qty < 1 || qty > item.quantity) throw new EditError(`Swap 1 to ${item.quantity}.`);
  const v = await tx.variant.findUnique({ where: { id: d.newVariantId }, select: { id: true, sku: true, color: true, size: true, costPrice: true, productId: true, product: { select: { status: true } } } });
  if (!v || v.productId !== item.productId || v.product.status !== "ACTIVE") throw new EditError("Choose another size of the same product.");
  if (v.id === item.variantId) throw new EditError("That's the size already on the order.");
  const ref = formatOrderNumber(o.number);
  await release(tx, o, item, qty, user.id, `${ref}: swapped to ${v.size}`);
  // the swapped units become their own line (the rest of the line stays as it was)
  let lineId = item.id;
  if (qty < item.quantity) {
    await tx.orderItem.update({ where: { id: item.id }, data: { quantity: item.quantity - qty } });
    lineId = (await tx.orderItem.create({ data: { orderId: o.id, productId: item.productId, name: item.name, slug: item.slug, image: item.image, unitPrice: item.unitPrice, variantId: v.id, sku: v.sku, color: v.color, size: v.size, quantity: qty, unitCost: v.costPrice } })).id;
  } else {
    await tx.orderItem.update({ where: { id: item.id }, data: { variantId: v.id, sku: v.sku, color: v.color, size: v.size, unitCost: v.costPrice } });
  }
  const a = o.shippingAddress as { district?: string } | null;
  try {
    await allocateOrder(tx, { orderId: o.id, lines: [{ orderItemId: lineId, variantId: v.id, quantity: qty, label: `${item.name} (${v.size})` }], toDistrict: a?.district ?? null, prefer: o.pickupStoreId ?? undefined, actorId: user.id, note: `${ref}: swapped from ${item.size}` });
  } catch (e) {
    if (e instanceof StockError) throw new EditError(`${item.name} in ${v.color} ${v.size} isn't in stock anywhere that sends orders.`);
    throw e;
  }
  const what = `${item.name}: ${qty} × ${item.color} ${item.size} → ${v.color} ${v.size}`;
  await tx.orderEvent.create({ data: { orderId: o.id, actor: user.name, message: `Changed: ${what}` } });
  await queueOrderNotice(tx, o.id, "updated");
  await audit(tx, user, { action: "order.edit", entity: ["Order", o.id], summary: `${ref}: ${what}` });
}

/** A new delivery address or phone. The fee follows the district for unpaid orders; a paid order keeps its fee. */
export async function changeAddress(tx: Tx, user: Actor, d: { orderId: string; address: unknown }) {
  const o = await load(tx, d.orderId);
  if (o.pickupStoreId) throw new EditError("This order is collected from a shop: there's no delivery address to change.");
  const p = addressFields.safeParse(d.address);
  if (!p.success) throw new EditError(p.error.issues[0].message);
  const before = o.shippingAddress as { district?: string; city?: string; line1?: string; phone?: string } | null;
  const next = { ...(o.shippingAddress as object), ...withProvince({ ...p.data, line2: p.data.line2 || null, postalCode: p.data.postalCode || null }) };
  await tx.order.update({ where: { id: o.id }, data: { shippingAddress: next as Prisma.InputJsonValue, phone: p.data.phone } });
  const fresh = { ...o, shippingAddress: next as Prisma.JsonValue };
  const m = o.paymentStatus === "PAID" ? null : await reprice(tx, fresh);
  const ref = formatOrderNumber(o.number);
  const what = `address ${before?.line1 ?? ""}, ${before?.city ?? ""}, ${before?.district ?? ""} → ${p.data.line1}, ${p.data.city}, ${p.data.district}${before?.phone !== p.data.phone ? `; phone ${before?.phone ?? ""} → ${p.data.phone}` : ""}`;
  await tx.orderEvent.create({ data: { orderId: o.id, actor: user.name, message: `Changed ${what}${m && m.total !== o.total ? `. New total ${formatPrice(m.total)}` : ""}` } });
  await audit(tx, user, { action: "order.edit", entity: ["Order", o.id], summary: `${ref}: ${what}${m && m.total !== o.total ? `; total ${formatPrice(o.total)} → ${formatPrice(m.total)}` : ""}` });
  return m;
}
