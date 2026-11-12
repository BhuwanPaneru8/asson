import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { changeAddress, reduceItem, swapSize } from "@/lib/order-edits";
import { allocateOrder } from "@/lib/stock";
import { transitionOrder } from "@/lib/orders";
import { makeLocation, makeProduct, makeUser, resetDb, stockAt } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

describe("changing an order before it's packed", () => {
  let staff: U, wh: L, p: Awaited<ReturnType<typeof makeProduct>>;
  beforeEach(async () => {
    await resetDb();
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    await db.store.update({ where: { id: wh.id }, data: { shipsOnline: true, district: "Kathmandu" } });
    staff = await makeUser("STAFF", { name: "Care", locations: [wh.id] });
    p = await makeProduct({ price: 2000, cost: 900, stock: { S: 5, M: 5, L: 0 }, at: wh.id });
  });
  const v = (size: string) => p.variants.find((x) => x.size === size)!;
  /** a confirmed COD order for 2 × S + 1 × M, Rs 4,000 + Rs 150 delivery, Rs 400 coupon, reserved at the warehouse */
  const order = async (o: { paid?: boolean; district?: string } = {}) => {
    const created = await db.order.create({ data: { email: "g@t.l", phone: "9811111111", status: "CONFIRMED", paymentMethod: o.paid ? "ONLINE" : "COD", paymentStatus: o.paid ? "PAID" : "PENDING", subtotal: 600_000, discount: 60_000, shippingFee: 15_000, total: 555_000, shippingMethod: "standard", channel: "ONLINE",
      shippingAddress: { fullName: "Gita Rai", phone: "9811111111", line1: "Ward 4", city: "Dharan", district: o.district ?? "Sunsari", state: "Koshi" },
      items: { create: [
        { variantId: v("S").id, productId: p.id, name: p.name, slug: p.slug, sku: v("S").sku, color: v("S").color, size: "S", image: "", unitPrice: 200_000, unitCost: 90_000, quantity: 2 },
        { variantId: v("M").id, productId: p.id, name: p.name, slug: p.slug, sku: v("M").sku, color: v("M").color, size: "M", image: "", unitPrice: 200_000, unitCost: 90_000, quantity: 1 },
      ] } }, include: { items: true } });
    await tx((t) => allocateOrder(t, { orderId: created.id, lines: created.items.map((i) => ({ orderItemId: i.id, variantId: i.variantId!, quantity: i.quantity, label: i.size })) }));
    return created;
  };
  const line = (o: { items: { id: string; size: string }[] }, size: string) => o.items.find((i) => i.size === size)!.id;

  it("taking a unit off puts it back on the shelf, scales the discount, recalculates the fee and texts the customer", async () => {
    const o = await order();
    expect([await stockAt(wh.id, v("S").id), await stockAt(wh.id, v("M").id)]).toEqual([3, 4]);
    const m = await tx((t) => reduceItem(t, staff, { orderId: o.id, orderItemId: line(o, "S"), quantity: 1 }));
    expect(await stockAt(wh.id, v("S").id)).toBe(4);
    expect(await db.orderAllocation.findMany({ where: { orderId: o.id }, select: { quantity: true } })).toHaveLength(2);
    expect([m.subtotal, m.discount]).toEqual([400_000, 40_000]); // discount kept in proportion
    expect(m.total).toBe(400_000 - 40_000 + m.shippingFee);
    expect(await db.notification.findFirst({ where: { orderId: o.id, template: "updated" } })).toBeTruthy();
    await tx((t) => reduceItem(t, staff, { orderId: o.id, orderItemId: line(o, "S"), quantity: 0 })); // the S line goes
    expect((await db.orderItem.findMany({ where: { orderId: o.id } })).map((i) => i.size)).toEqual(["M"]);
    await expect(tx((t) => reduceItem(t, staff, { orderId: o.id, orderItemId: line(o, "M"), quantity: 0 }))).rejects.toThrow(/cancel it instead/);
    expect(await db.auditLog.count({ where: { action: "order.edit" } })).toBe(2);
  });

  it("swapping a size: the old size goes back, the new one is reserved, the price stays; part of a line splits off; works on a paid order", async () => {
    const o = await order({ paid: true });
    await expect(tx((t) => reduceItem(t, staff, { orderId: o.id, orderItemId: line(o, "S"), quantity: 1 }))).rejects.toThrow(/paid: taking items off needs a refund/);
    await tx((t) => swapSize(t, staff, { orderId: o.id, orderItemId: line(o, "S"), newVariantId: v("M").id, quantity: 1 }));
    const items = await db.orderItem.findMany({ where: { orderId: o.id }, orderBy: { size: "asc" } });
    expect(items.map((i) => [i.size, i.quantity, i.unitPrice])).toEqual([["M", 1, 200_000], ["M", 1, 200_000], ["S", 1, 200_000]]);
    expect([await stockAt(wh.id, v("S").id), await stockAt(wh.id, v("M").id)]).toEqual([4, 3]);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).total).toBe(555_000); // unchanged
    await expect(tx((t) => swapSize(t, staff, { orderId: o.id, orderItemId: line(o, "M"), newVariantId: v("L").id }))).rejects.toThrow(/isn't in stock anywhere/);
    expect(await stockAt(wh.id, v("M").id)).toBe(3); // the failed swap changed nothing
  });

  it("changing the address recalculates an unpaid order's fee for the new district; a packed order can't be changed", async () => {
    const o = await order();
    const m = await tx((t) => changeAddress(t, staff, { orderId: o.id, address: { fullName: "Gita Rai", phone: "9822222222", line1: "Lakeside 6", city: "Pokhara", district: "Kaski" } }));
    const after = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect([after.phone, (after.shippingAddress as { district: string; state: string }).district, (after.shippingAddress as { state: string }).state]).toEqual(["9822222222", "Kaski", "Gandaki"]);
    expect(after.total).toBe(m!.total);
    await expect(tx((t) => changeAddress(t, staff, { orderId: o.id, address: { fullName: "G", phone: "1", line1: "x", city: "y", district: "Nowhere" } }))).rejects.toThrow();
    await transitionOrder({ orderId: o.id, to: "PACKED", actor: "wh" });
    await expect(tx((t) => reduceItem(t, staff, { orderId: o.id, orderItemId: line(o, "S"), quantity: 1 }))).rejects.toThrow(/only orders not yet packed/);
  });
});
