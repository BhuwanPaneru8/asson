import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addToCart } from "@/actions/cart";
import { placeOrder } from "@/actions/checkout";
import { createPosSale, openShift } from "@/actions/pos";
import { adjustStock } from "@/actions/admin/catalog";
import { cancelStockTransfer, newTransfer, pickOrder, receiveStockTransfer, saveLocation, sendStockTransfer } from "@/actions/admin/locations";
import { transitionOrder } from "@/lib/orders";
import { getPickList } from "@/lib/picking";
import { RedirectError, session } from "../support/next-mocks";
import { actAs, makeLocation, makeProduct, makeUser, resetDb, stockAt } from "../support/db";

const ref = () => `test-${Math.random().toString(36).slice(2, 12)}`;

async function checkout(lines: { variantId: string; quantity?: number }[]) {
  session.user = null;
  session.cookies.clear();
  for (const l of lines) expect((await addToCart({ variantId: l.variantId, quantity: l.quantity ?? 1 })).ok).toBe(true);
  try {
    const r = await placeOrder({ email: "sita@test.local", phone: "9841234567", address: { fullName: "Sita Rai", phone: "9841234567", line1: "Ward 4", city: "Town", district: "Kathmandu", postalCode: "" }, shippingMethod: "standard", paymentMethod: "COD" });
    return { error: r?.error };
  } catch (e) {
    if (e instanceof RedirectError) return { orderId: e.url.split("/")[2].split("?")[0] };
    throw e;
  }
}

const total = async (variantId: string) => (await db.variant.findUniqueOrThrow({ where: { id: variantId } })).stock;
const put = (storeId: string, variantId: string, quantity: number) => db.storeStock.upsert({ where: { storeId_variantId: { storeId, variantId } }, create: { storeId, variantId, quantity }, update: { quantity } });

describe("multi-location stock", () => {
  beforeEach(async () => {
    await resetDb();
    await db.deliveryRate.create({ data: { district: "Kathmandu", province: "Bagmati", zone: "VALLEY", fee: 10_000, etaMinDays: 1, etaMaxDays: 2 } });
  });

  it("keeps Variant.stock equal to the sum of locations, and rejects direct writes to it", async () => {
    const wh = await makeLocation({ code: "WH", kind: "WAREHOUSE", priority: 10 });
    const p = await makeProduct({ stock: { M: 4 }, at: wh.id });
    const shop = await makeLocation({ code: "SHOP" });
    await put(shop.id, p.variants[0].id, 3);
    expect(await total(p.variants[0].id)).toBe(7);
    await expect(db.variant.update({ where: { id: p.variants[0].id }, data: { stock: 100 } })).rejects.toThrow(/derived from StoreStock/);
    await expect(db.storeStock.update({ where: { storeId_variantId: { storeId: wh.id, variantId: p.variants[0].id } }, data: { quantity: -1 } })).rejects.toThrow();
    await expect(db.storeStock.delete({ where: { storeId_variantId: { storeId: wh.id, variantId: p.variants[0].id } } })).rejects.toThrow(/still holds 4/);
    expect(await total(p.variants[0].id)).toBe(7);
  });

  it("fills an online order from the one location that has every line, before priority", async () => {
    const wh = await makeLocation({ code: "WH", kind: "WAREHOUSE", priority: 10 });
    const shop = await makeLocation({ code: "SHOP", priority: 50 });
    const a = await makeProduct({ stock: { M: 5 }, at: wh.id });
    const b = await makeProduct({ stock: { M: 2 }, at: shop.id });
    await put(shop.id, a.variants[0].id, 1);
    const r = await checkout([{ variantId: a.variants[0].id }, { variantId: b.variants[0].id }]);
    expect(r.orderId).toBeTruthy();
    // only the shop has both lines → one parcel from the shop, warehouse untouched
    expect(await stockAt(shop.id, a.variants[0].id)).toBe(0);
    expect(await stockAt(wh.id, a.variants[0].id)).toBe(5);
    const allocs = await db.orderAllocation.findMany({ where: { orderId: r.orderId } });
    expect(allocs.every((x) => x.storeId === shop.id && x.pickedAt === null)).toBe(true);
    const logs = await db.inventoryLog.findMany({ where: { orderId: r.orderId, reason: "SALE" } });
    expect(logs.map((l) => l.storeId)).toEqual([shop.id, shop.id]);
  });

  it("splits a line across locations when none has enough, and sells out only when all are empty", async () => {
    const wh = await makeLocation({ code: "WH", kind: "WAREHOUSE", priority: 10 });
    const shop = await makeLocation({ code: "SHOP", priority: 50 });
    const p = await makeProduct({ stock: { M: 2 }, at: wh.id });
    await put(shop.id, p.variants[0].id, 1);
    const r = await checkout([{ variantId: p.variants[0].id, quantity: 3 }]);
    expect(r.orderId).toBeTruthy();
    const allocs = await db.orderAllocation.findMany({ where: { orderId: r.orderId }, orderBy: { quantity: "desc" } });
    expect(allocs.map((x) => [x.storeId, x.quantity])).toEqual([[wh.id, 2], [shop.id, 1]]);
    expect(await total(p.variants[0].id)).toBe(0);

    // cancelling puts each unit back where it came from
    await transitionOrder({ orderId: r.orderId!, to: "CANCELLED", actor: "test" });
    expect([await stockAt(wh.id, p.variants[0].id), await stockAt(shop.id, p.variants[0].id)]).toEqual([2, 1]);
    expect(await total(p.variants[0].id)).toBe(3);
  });

  it("never sells the last unit twice across concurrent online orders", async () => {
    const p = await makeProduct({ stock: { M: 1 } });
    const [x, y] = await Promise.allSettled([checkout([{ variantId: p.variants[0].id }]), checkout([{ variantId: p.variants[0].id }])]);
    void x; void y;
    expect(await db.order.count()).toBeLessThanOrEqual(1);
    expect(await total(p.variants[0].id)).toBe(0);
    expect(await db.orderAllocation.aggregate({ _sum: { quantity: true } })).toMatchObject({ _sum: { quantity: 1 } });
  });

  it("the till sells only from its own shop", async () => {
    const wh = await makeLocation({ code: "WH", kind: "WAREHOUSE", priority: 10 });
    const shop = await makeLocation({ code: "FLAGSHIP", priority: 20 });
    const p = await makeProduct({ price: 1000, stock: { M: 5 }, at: wh.id });
    const cashier = await makeUser("CASHIER");
    actAs(cashier);
    expect(await openShift(0, shop.id)).toMatchObject({ ok: true });
    const sale = () => createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: null, tenders: [{ method: "CASH", amount: 100_000 }] });
    expect(await sale()).toMatchObject({ ok: false, error: expect.stringMatching(/only 0 at FLAGSHIP.*transfer/) });
    await put(shop.id, p.variants[0].id, 1);
    expect(await sale()).toMatchObject({ ok: true });
    expect([await stockAt(shop.id, p.variants[0].id), await stockAt(wh.id, p.variants[0].id)]).toEqual([0, 5]);
    const alloc = await db.orderAllocation.findFirstOrThrow();
    expect(alloc).toMatchObject({ storeId: shop.id, quantity: 1 });
    expect(alloc.pickedAt).not.toBeNull();
  });

  it("adjusts stock at the chosen location only", async () => {
    const wh = await makeLocation({ code: "WH", kind: "WAREHOUSE", priority: 10 });
    const shop = await makeLocation({ code: "SHOP" });
    const p = await makeProduct({ stock: { M: 3 }, at: wh.id });
    actAs(await makeUser("MANAGER"));
    expect(await adjustStock(p.variants[0].id, -1, "DAMAGED", "Torn", shop.id)).toMatchObject({ ok: false, error: expect.stringMatching(/SHOP doesn't have/) });
    expect(await adjustStock(p.variants[0].id, 2, "RECEIVED", undefined, shop.id)).toMatchObject({ ok: true, here: 2, stock: 5 });
    expect(await stockAt(wh.id, p.variants[0].id)).toBe(3);
  });

  describe("transfers", () => {
    async function setup() {
      const wh = await makeLocation({ code: "WH", kind: "WAREHOUSE", priority: 10 });
      const shop = await makeLocation({ code: "SHOP", priority: 20 });
      const p = await makeProduct({ stock: { M: 10, L: 4 }, at: wh.id });
      const staff = await makeUser("STAFF");
      actAs(staff);
      return { wh, shop, p, staff };
    }
    const create = async (input: Parameters<typeof newTransfer>[0]) => {
      try { return await newTransfer(input); } catch (e) { if (e instanceof RedirectError) return { ok: true as const, id: e.url.split("/").pop()! }; throw e; }
    };

    it("sent stock leaves the source; counted stock arrives; shortfalls are logged and audited", async () => {
      const { wh, shop, p } = await setup();
      const [m, l] = p.variants;
      const t = await create({ fromId: wh.id, toId: shop.id, items: [{ variantId: m.id, quantity: 6 }, { variantId: l.id, quantity: 2 }] });
      expect(t.ok).toBe(true);
      const id = (t as { id: string }).id;
      expect(await stockAt(wh.id, m.id)).toBe(10); // a draft moves nothing
      expect(await sendStockTransfer(id)).toMatchObject({ ok: true });
      expect([await stockAt(wh.id, m.id), await total(m.id)]).toEqual([4, 4]); // in the van: not sellable anywhere
      expect(await sendStockTransfer(id)).toMatchObject({ ok: false });

      const items = await db.stockTransferItem.findMany({ where: { transferId: id } });
      const mi = items.find((i) => i.variantId === m.id)!;
      expect(await receiveStockTransfer({ id, counts: { [mi.id]: 5 }, note: "box torn" })).toMatchObject({ ok: true, short: 1 });
      expect([await stockAt(shop.id, m.id), await stockAt(shop.id, l.id), await total(m.id)]).toEqual([5, 2, 9]);
      expect(await db.inventoryLog.count({ where: { reason: "TRANSFER_LOSS", variantId: m.id } })).toBe(1);
      expect((await db.auditLog.findFirstOrThrow({ where: { action: "transfer.receive" } })).summary).toMatch(/SHORT T\d+-M −1/);
      expect(await receiveStockTransfer({ id, counts: {} })).toMatchObject({ ok: false });
    });

    it("can't send more than the source holds, and a recall puts units back", async () => {
      const { wh, shop, p } = await setup();
      const [m] = p.variants;
      const big = await create({ fromId: wh.id, toId: shop.id, items: [{ variantId: m.id, quantity: 11 }], sendNow: true });
      expect(big).toMatchObject({ ok: false, error: expect.stringMatching(/WH doesn't have 11/) });
      expect(await db.stockTransfer.count()).toBe(0); // all or nothing
      const t = await create({ fromId: wh.id, toId: shop.id, items: [{ variantId: m.id, quantity: 3 }], sendNow: true });
      const id = (t as { id: string }).id;
      expect(await stockAt(wh.id, m.id)).toBe(7);
      expect(await cancelStockTransfer(id, "Van broke down")).toMatchObject({ ok: true });
      expect([await stockAt(wh.id, m.id), await stockAt(shop.id, m.id)]).toEqual([10, 0]);
    });

    it("cashiers can't move stock between locations", async () => {
      const { wh, shop, p } = await setup();
      actAs(await makeUser("CASHIER"));
      await expect(newTransfer({ fromId: wh.id, toId: shop.id, items: [{ variantId: p.variants[0].id, quantity: 1 }] })).rejects.toThrow();
    });
  });

  it("pick lists show confirmed orders per location; picking or packing clears them", async () => {
    const wh = await makeLocation({ code: "WH", kind: "WAREHOUSE", priority: 10 });
    const p = await makeProduct({ stock: { M: 5 }, at: wh.id });
    const a = await checkout([{ variantId: p.variants[0].id, quantity: 2 }]);
    const b = await checkout([{ variantId: p.variants[0].id }]);
    expect((await getPickList(wh.id)).units).toBe(0); // PENDING (COD call not done yet) isn't picked
    for (const o of [a, b]) await transitionOrder({ orderId: o.orderId!, to: "CONFIRMED", actor: "test" });
    const list = await getPickList(wh.id);
    expect(list).toMatchObject({ units: 3, skus: [{ sku: p.variants[0].sku, quantity: 3 }] });
    expect(list.orders).toHaveLength(2);

    actAs(await makeUser("STAFF"));
    expect(await pickOrder(a.orderId!, wh.id)).toMatchObject({ ok: true, remaining: 0 });
    expect(await pickOrder(a.orderId!, wh.id)).toMatchObject({ ok: false });
    await transitionOrder({ orderId: b.orderId!, to: "PACKED", actor: "test" });
    expect((await getPickList(wh.id)).units).toBe(0);
  });

  it("a location can only be switched off when empty and idle", async () => {
    const wh = await makeLocation({ code: "WH", kind: "WAREHOUSE", priority: 10 });
    const shop = await makeLocation({ code: "SHOP" });
    const p = await makeProduct({ stock: { M: 2 }, at: shop.id });
    void p;
    actAs(await makeUser("ADMIN"));
    const base = { code: "SHOP", name: "Shop", kind: "SHOP" as const, address: "Kathmandu", priority: 100, pickup: true, active: false };
    expect(await saveLocation(base, shop.id)).toMatchObject({ ok: false, error: expect.stringMatching(/2 units are still there/) });
    expect(await saveLocation({ ...base, code: "WH", name: "Warehouse", kind: "WAREHOUSE", active: true, pickup: true }, wh.id)).toMatchObject({ ok: true });
    expect((await db.store.findUniqueOrThrow({ where: { id: wh.id } })).pickup).toBe(false); // warehouses aren't pickup points
    actAs(await makeUser("MANAGER"));
    await expect(saveLocation(base, shop.id)).rejects.toThrow();
  });
});
