import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buyAgain, changeMyAddress, reduceMyItem, swapMySize } from "@/actions/account";
import { allocateOrder } from "@/lib/stock";
import { actAs, makeLocation, makeProduct, makeUser, resetDb, stockAt } from "../support/db";

const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

describe("customers changing their own order before it's packed", () => {
  let wh: Awaited<ReturnType<typeof makeLocation>>, p: Awaited<ReturnType<typeof makeProduct>>;
  beforeEach(async () => {
    await resetDb();
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    await db.store.update({ where: { id: wh.id }, data: { shipsOnline: true } });
    p = await makeProduct({ price: 2000, cost: 900, stock: { S: 5, M: 5 }, at: wh.id });
  });
  const v = (size: string) => p.variants.find((x) => x.size === size)!;
  const order = async (userId: string | null, status = "CONFIRMED") => {
    const o = await db.order.create({ data: { userId, email: "g@t.l", phone: "9811111111", status: status as never, paymentMethod: "COD", subtotal: 400_000, total: 415_000, shippingFee: 15_000, shippingMethod: "standard", channel: "ONLINE",
      shippingAddress: { fullName: "Gita Rai", phone: "9811111111", line1: "Ward 4", city: "Dharan", district: "Sunsari", state: "Koshi" },
      items: { create: [{ variantId: v("S").id, productId: p.id, name: p.name, slug: p.slug, sku: v("S").sku, color: v("S").color, size: "S", image: "", unitPrice: 200_000, unitCost: 90_000, quantity: 2 }] } }, include: { items: true } });
    if (status !== "DELIVERED") await tx((t) => allocateOrder(t, { orderId: o.id, lines: o.items.map((i) => ({ orderItemId: i.id, variantId: i.variantId!, quantity: i.quantity, label: "S" })) }));
    return o;
  };

  it("a guest with the order link swaps a size, takes one off and changes the address; it's on the timeline, not in the staff audit", async () => {
    actAs(null);
    const o = await order(null);
    expect(await swapMySize(o.id, o.items[0].id, v("M").id)).toEqual({ ok: true });
    const line = await db.orderItem.findFirstOrThrow({ where: { orderId: o.id } });
    expect(line.size).toBe("M");
    expect([await stockAt(wh.id, v("S").id), await stockAt(wh.id, v("M").id)]).toEqual([5, 3]);
    expect(await reduceMyItem(o.id, line.id, 1)).toEqual({ ok: true });
    expect(await changeMyAddress(o.id, { fullName: "Gita Rai", phone: "9822222222", line1: "Lakeside 6", city: "Pokhara", district: "Kaski" })).toEqual({ ok: true });
    const after = await db.order.findUniqueOrThrow({ where: { id: o.id }, include: { events: true } });
    expect([after.subtotal, after.phone]).toEqual([200_000, "9822222222"]);
    expect(after.events.filter((e) => e.message.startsWith("Changed")).map((e) => e.actor)).toEqual(["g@t.l", "g@t.l", "g@t.l"]);
    expect(await db.auditLog.count({ where: { action: "order.edit" } })).toBe(0);
  });

  it("someone else's account order can't be changed; a packed one can't either", async () => {
    const owner = await makeUser("CUSTOMER", { name: "Owner" });
    const stranger = await makeUser("CUSTOMER", { name: "Stranger" });
    const o = await order(owner.id);
    actAs(stranger);
    expect(await reduceMyItem(o.id, o.items[0].id, 1)).toEqual({ ok: false, error: "Order not found." });
    actAs(owner);
    await db.order.update({ where: { id: o.id }, data: { status: "PACKED" } });
    expect(await reduceMyItem(o.id, o.items[0].id, 1)).toMatchObject({ ok: false, error: expect.stringMatching(/only orders not yet packed/) });
  });

  it("buy again puts what's still on sale and in stock back in the bag", async () => {
    const owner = await makeUser("CUSTOMER", { name: "Owner" });
    actAs(owner);
    const o = await order(owner.id, "DELIVERED");
    const r = await buyAgain(o.id);
    expect(r).toMatchObject({ ok: true, added: 1, skipped: 0 });
    const cart = await db.cart.findFirstOrThrow({ include: { items: true } });
    expect(cart.items.map((i) => [i.variantId, i.quantity])).toEqual([[v("S").id, 2]]);
    await db.product.update({ where: { id: p.id }, data: { status: "ARCHIVED" } });
    expect(await buyAgain(o.id)).toMatchObject({ ok: false, error: expect.stringMatching(/None of these are available/) });
  });
});
