import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addToCart } from "@/actions/cart";
import { placeOrder } from "@/actions/checkout";
import { rankLocations } from "@/lib/stock";
import { RedirectError, session } from "../support/next-mocks";
import { makeLocation, makeProduct, resetDb } from "../support/db";

type P = Awaited<ReturnType<typeof makeProduct>>;

async function order(district: string, lines: { p: P; qty?: number }[], extra: Partial<Parameters<typeof placeOrder>[0]> = {}) {
  session.user = null; session.cookies.clear();
  for (const l of lines) expect((await addToCart({ variantId: l.p.variants[0].id, quantity: l.qty ?? 1 })).ok).toBe(true);
  try {
    const r = await placeOrder({ email: "c@test.local", phone: "9841234567", address: { fullName: "Maya", phone: "9841234567", line1: "Ward 1", city: "Town", district, postalCode: "" }, shippingMethod: "standard", paymentMethod: "COD", ...extra });
    throw new Error(r?.error ?? "no redirect");
  } catch (e) {
    if (e instanceof RedirectError) return e.url.split("/")[2].split("?")[0];
    throw e;
  }
}
const from = async (orderId: string) => (await db.orderAllocation.findMany({ where: { orderId }, include: { store: { select: { code: true } } } })).map((a) => [a.store.code, a.quantity]);

describe("geography-aware fulfilment", () => {
  let wh: Awaited<ReturnType<typeof makeLocation>>, pkr: typeof wh, brt: typeof wh;
  beforeEach(async () => {
    await resetDb();
    for (const d of ["Kaski", "Morang", "Kathmandu"]) await db.deliveryRate.create({ data: { district: d, province: "X", zone: "OUTSIDE", fee: 15_000, etaMinDays: 2, etaMaxDays: 4 } });
    wh = await makeLocation({ code: "WH", kind: "WAREHOUSE", priority: 10 });
    pkr = await makeLocation({ code: "PKR", priority: 30 });
    brt = await makeLocation({ code: "BRT", priority: 40 });
    await db.store.update({ where: { id: wh.id }, data: { district: "Kathmandu" } });
    await db.store.update({ where: { id: pkr.id }, data: { district: "Kaski" } });
    await db.store.update({ where: { id: brt.id }, data: { district: "Morang" } });
  });

  it("ships from the customer's own district or province before the warehouse's higher priority", async () => {
    const p = await makeProduct({ stock: { M: 5 }, at: wh.id });
    await db.storeStock.createMany({ data: [{ storeId: pkr.id, variantId: p.variants[0].id, quantity: 2 }, { storeId: brt.id, variantId: p.variants[0].id, quantity: 2 }] });
    expect(await from(await order("Kaski", [{ p }]))).toEqual([["PKR", 1]]);
    expect(await from(await order("Morang", [{ p }]))).toEqual([["BRT", 1]]);
    // Syangja has no shop of its own, but it's in Gandaki like Pokhara: same province wins over the warehouse
    expect(await from(await order("Syangja", [{ p }]))).toEqual([["PKR", 1]]);
  });

  it("one parcel from further away beats two parcels from nearby", async () => {
    const a = await makeProduct({ stock: { M: 5 }, at: wh.id });
    const b = await makeProduct({ stock: { M: 5 }, at: wh.id });
    await db.storeStock.create({ data: { storeId: pkr.id, variantId: a.variants[0].id, quantity: 3 } }); // Pokhara has only one of the two
    expect(await from(await order("Kaski", [{ p: a }, { p: b }]))).toEqual([["WH", 1], ["WH", 1]]);
  });

  it("locations that don't ship online are skipped for delivery but still serve pickup", async () => {
    const p = await makeProduct({ stock: { M: 5 }, at: wh.id });
    await db.storeStock.create({ data: { storeId: pkr.id, variantId: p.variants[0].id, quantity: 2 } });
    await db.store.update({ where: { id: pkr.id }, data: { shipsOnline: false, pickup: true } });
    expect(await from(await order("Kaski", [{ p }]))).toEqual([["WH", 1]]);
    expect(await from(await order("Kaski", [{ p }], { pickupStoreId: pkr.id, pickupName: "Maya" }))).toEqual([["PKR", 1]]);
  });

  it("without districts the old order holds: whole order, then most lines, then priority", () => {
    const lines = [{ variantId: "v", quantity: 1 }];
    const avail = new Map([["v", new Map([["A", 1], ["B", 1]])]]);
    expect(rankLocations(lines, [{ id: "B", priority: 20 }, { id: "A", priority: 10 }], avail)).toEqual(["A", "B"]);
    expect(rankLocations(lines, [{ id: "A", priority: 10, district: "Kathmandu" }, { id: "B", priority: 20, district: "Kaski" }], avail, undefined, "Kaski")).toEqual(["B", "A"]);
  });
});
