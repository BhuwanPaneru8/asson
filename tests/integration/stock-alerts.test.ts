import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { subscribeStockAlert } from "@/actions/stock-alerts";
import { adjustStock } from "@/actions/admin/catalog";
import { addToCart } from "@/actions/cart";
import { placeOrder } from "@/actions/checkout";
import { transitionOrder } from "@/lib/orders";
import { RedirectError } from "../support/next-mocks";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";

describe("back-in-stock alerts", () => {
  beforeEach(resetDb);

  it("only sold-out sizes can be subscribed, with a valid Nepali mobile", async () => {
    const p = await makeProduct({ stock: { M: 0, L: 3 } });
    expect(await subscribeStockAlert({ variantId: p.variants[0].id, phone: "12345" })).toMatchObject({ ok: false });
    expect(await subscribeStockAlert({ variantId: p.variants[1].id, phone: "9841234567" })).toMatchObject({ ok: false, error: expect.stringMatching(/in stock/) });
    expect(await subscribeStockAlert({ variantId: p.variants[0].id, phone: "9841234567" })).toMatchObject({ ok: true });
    expect(await subscribeStockAlert({ variantId: p.variants[0].id, phone: "9841234567" })).toMatchObject({ ok: true }); // idempotent
    expect(await db.stockAlert.count()).toBe(1);
  });

  it("texts each waiting shopper exactly once when stock arrives", async () => {
    const p = await makeProduct({ name: "Linen Shirt", stock: { M: 0 } });
    const v = p.variants[0].id;
    await subscribeStockAlert({ variantId: v, phone: "9841234567" });
    await subscribeStockAlert({ variantId: v, phone: "9801234567" });
    actAs(await makeUser("MANAGER"));
    expect((await adjustStock(v, 5, "RECEIVED")).ok).toBe(true);
    const sms = await db.notification.findMany({ where: { template: "back_in_stock" } });
    expect(sms).toHaveLength(2);
    expect(sms[0].body).toMatch(/Linen Shirt \(White, M\) is back in stock/);
    expect(await db.stockAlert.count({ where: { notifiedAt: null } })).toBe(0);
    await adjustStock(v, 2, "RECEIVED"); // more stock later: no repeat SMS
    expect(await db.notification.count({ where: { template: "back_in_stock" } })).toBe(2);
  });

  it("a cancelled order putting the last unit back also triggers the alert", async () => {
    const p = await makeProduct({ stock: { M: 1 } });
    const v = p.variants[0].id;
    actAs(null);
    await addToCart({ variantId: v });
    await placeOrder({ email: "a@test.local", phone: "9841234567", address: { fullName: "Asha Gurung", phone: "9841234567", line1: "Ward 4, House 12", city: "Town", district: "Kathmandu", postalCode: "" }, shippingMethod: "standard", paymentMethod: "COD" }).then((r) => expect(r).toBeUndefined(), (e) => { if (!(e instanceof RedirectError)) throw e; });
    await subscribeStockAlert({ variantId: v, phone: "9812345678" });
    const o = await db.order.findFirstOrThrow();
    await transitionOrder({ orderId: o.id, to: "CANCELLED", actor: "t" });
    expect(await db.notification.count({ where: { template: "back_in_stock", to: "9812345678" } })).toBe(1);
  });
});
