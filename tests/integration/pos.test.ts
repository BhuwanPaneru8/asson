import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { closeShift, createPosSale, openShift } from "@/actions/pos";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";

const ref = () => `test-${Math.random().toString(36).slice(2, 12)}`;
const cash = (amount: number, tendered?: number) => ({ method: "CASH" as const, amount, tendered });

describe("POS sale", () => {
  beforeEach(resetDb);

  async function cashierWithShift(float = 1000) {
    const cashier = await makeUser("CASHIER");
    actAs(cashier);
    expect((await openShift(float)).ok).toBe(true);
    return cashier;
  }

  it("takes stock, snapshots price and cost, records tenders and change", async () => {
    const p = await makeProduct({ price: 2399, cost: 1100, stock: { M: 5 } });
    await cashierWithShift();
    const r = await createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 2 }], discount: null, tenders: [cash(479_800, 500_000)] });
    expect(r).toMatchObject({ ok: true, change: 20_200 });
    const v = await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } });
    expect(v.stock).toBe(3);
    const order = await db.order.findFirstOrThrow({ include: { items: true, tenders: true } });
    expect(order).toMatchObject({ channel: "STORE", status: "DELIVERED", paymentStatus: "PAID", total: 479_800 });
    expect(order.items[0]).toMatchObject({ unitPrice: 239_900, unitCost: 110_000, quantity: 2 });
    expect(order.tenders[0]).toMatchObject({ method: "CASH", amount: 479_800, tendered: 500_000 });
    expect(await db.inventoryLog.count({ where: { reason: "SALE", delta: -2 } })).toBe(1);
  });

  it("is idempotent: a double-tap with the same clientRef sells once", async () => {
    const p = await makeProduct({ stock: { M: 5 } });
    await cashierWithShift();
    const input = { clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: null, tenders: [cash(100_000)] };
    const [a, b] = await Promise.all([createPosSale(input), createPosSale(input)]);
    expect(a.ok && b.ok && a.orderId === b.orderId).toBe(true);
    expect(await db.order.count()).toBe(1);
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(4);
  });

  it("never sells the last unit twice, even at the same instant", async () => {
    const p = await makeProduct({ stock: { M: 1 } });
    const store = await db.store.create({ data: { code: "FLAGSHIP", name: "Flagship", address: "KTM" } });
    const a = await makeUser("CASHIER"), b = await makeUser("CASHIER");
    await db.shift.createMany({ data: [{ storeId: store.id, cashierId: a.id, openingFloat: 0 }, { storeId: store.id, cashierId: b.id, openingFloat: 0 }] });
    const sell = async (u: typeof a) => { actAs(u); return createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: null, tenders: [cash(100_000)] }); };
    // actAs is module-global, so interleave by starting both before either awaits completion
    const results = await Promise.all([sell(a), sell(b)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await db.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(0);
  });

  it("refuses payments that don't add up to the server-computed total", async () => {
    const p = await makeProduct({ price: 1000, stock: { M: 5 } });
    await cashierWithShift();
    const r = await createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: null, tenders: [cash(50_000)] });
    expect(r.ok).toBe(false);
  });

  describe("discount approvals", () => {
    const sale = (variantId: string, percent: number, pin?: string) =>
      createPosSale({ clientRef: ref(), lines: [{ variantId, quantity: 1 }], discount: { type: "PERCENT", value: percent, reason: "Loyal customer" }, approverPin: pin, tenders: [cash(100_000 - percent * 1000)] });

    it("cashier may give up to 5% alone", async () => {
      const p = await makeProduct({ price: 1000, stock: { M: 5 } });
      await cashierWithShift();
      expect((await sale(p.variants[0].id, 5)).ok).toBe(true);
    });
    it("10% needs a manager PIN, which is recorded as the approver", async () => {
      const p = await makeProduct({ price: 1000, stock: { M: 5 } });
      const manager = await makeUser("MANAGER", { pin: "2580" });
      await cashierWithShift();
      expect((await sale(p.variants[0].id, 10)).ok).toBe(false);
      expect((await sale(p.variants[0].id, 10, "1111")).ok).toBe(false);
      const r = await sale(p.variants[0].id, 10, "2580");
      expect(r.ok).toBe(true);
      const o = await db.order.findFirstOrThrow({ where: { discount: { gt: 0 } } });
      expect(o).toMatchObject({ discount: 10_000, discountApprovedById: manager.id, discountReason: "Loyal customer" });
    });
    it("over 15% needs the owner — a manager PIN is not enough", async () => {
      const p = await makeProduct({ price: 1000, stock: { M: 5 } });
      await makeUser("MANAGER", { pin: "2580" });
      await makeUser("ADMIN", { pin: "1357" });
      await cashierWithShift();
      expect((await sale(p.variants[0].id, 20, "2580")).ok).toBe(false);
      expect((await sale(p.variants[0].id, 20, "1357")).ok).toBe(true);
    });
  });

  it("store-credit vouchers are drawn down and can't be overspent", async () => {
    const p = await makeProduct({ price: 1000, stock: { M: 5 } });
    await db.coupon.create({ data: { code: "CR-TEST", type: "FIXED", value: 150_000, isCredit: true } });
    await cashierWithShift();
    const pay = (amount: number) => createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: null, tenders: [{ method: "VOUCHER", amount, reference: "cr-test" }, ...(amount < 100_000 ? [cash(100_000 - amount)] : [])] });
    expect((await pay(100_000)).ok).toBe(true);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: "CR-TEST" } })).value).toBe(50_000);
    expect((await pay(100_000)).ok).toBe(false); // only Rs 500 left
    expect((await pay(50_000)).ok).toBe(true); // split: Rs 500 credit + Rs 500 cash
    const v = await db.coupon.findUniqueOrThrow({ where: { code: "CR-TEST" } });
    expect(v).toMatchObject({ value: 0, active: false });
  });

  it("closing a shift: expected = float + cash sales; a difference needs a note", async () => {
    const p = await makeProduct({ price: 1000, stock: { M: 5 } });
    await cashierWithShift(500);
    await createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: null, tenders: [cash(100_000)] });
    expect((await closeShift(1490)).ok).toBe(false); // Rs 10 short, no note
    const r = await closeShift(1490, "Gave wrong change");
    expect(r).toMatchObject({ ok: true, expected: 150_000, counted: 149_000, difference: -1_000 });
  });
});
