import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { openNewShop, previewOpening } from "@/actions/admin/rollout";
import { scopeFor } from "@/lib/scope";
import { RedirectError } from "../support/next-mocks";
import { actAs, makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

const DAY = 86_400_000;
type Loc = Awaited<ReturnType<typeof makeLocation>>;

const open = async (input: Parameters<typeof openNewShop>[0]) => {
  try { const r = await openNewShop(input); return r; } catch (e) { if (e instanceof RedirectError) return { ok: true as const, url: e.url }; throw e; }
};
const base = (warehouseId: string, plan: Parameters<typeof openNewShop>[0]["plan"], staffIds: string[] = []) => ({ code: "BTW", name: "Asson Butwal", district: "Rupandehi", address: "Traffic Chowk", pickup: true, shipsOnline: true, priority: 50, staffIds, warehouseId, plan });

describe("new-store rollout", () => {
  let wh: Loc, ktm: Loc;
  beforeEach(async () => {
    await resetDb();
    actAs(await makeUser("ADMIN"));
    wh = await makeLocation({ code: "WH", name: "Warehouse", kind: "WAREHOUSE" });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
  });

  it("copies a similar shop's stock, scaled, never beyond what the warehouse can spare", async () => {
    const a = await makeProduct({ stock: { S: 20, M: 3 }, at: wh.id });
    await db.storeStock.createMany({ data: [{ storeId: ktm.id, variantId: a.variants[0].id, quantity: 10 }, { storeId: ktm.id, variantId: a.variants[1].id, quantity: 10 }] });
    expect(await previewOpening(wh.id, { mode: "copy", fromStoreId: ktm.id, percent: 50 })).toEqual({ ok: true, sizes: 2, units: 8 }); // S 5, M capped at 3

    const cashier = await makeUser("CASHIER", { locations: [] });
    const r = await open(base(wh.id, { mode: "copy", fromStoreId: ktm.id, percent: 50 }, [cashier.id]));
    expect(r).toMatchObject({ ok: true, url: expect.stringMatching(/^\/admin\/transfers\//) });
    const shop = await db.store.findUniqueOrThrow({ where: { code: "BTW" } });
    expect(shop).toMatchObject({ kind: "SHOP", district: "Rupandehi", pickup: true });
    const t = await db.stockTransfer.findFirstOrThrow({ include: { items: true } });
    expect(t).toMatchObject({ status: "DRAFT", fromId: wh.id, toId: shop.id });
    expect(t.items.map((i) => i.quantity).sort()).toEqual([3, 5]);
    expect(await scopeFor(cashier)).toEqual({ all: false, storeIds: [shop.id] }); // the new shop's team can run it
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "location.open" } })).summary).toMatch(/Opened Asson Butwal \(BTW\) in Rupandehi: 1 staff assigned .*opening stock 8 units from Warehouse drafted/);
  });

  it("best-seller starter: the network's top products, every size that sells, warehouse reserve kept", async () => {
    const hot = await makeProduct({ name: "Hot Tee", stock: { S: 10, M: 10, L: 10 }, at: wh.id });
    const cold = await makeProduct({ name: "Cold Coat", stock: { M: 10 }, at: wh.id });
    const log = (variantId: string, units: number, storeId = ktm.id) => db.inventoryLog.create({ data: { variantId, storeId, delta: -units, reason: "SALE", createdAt: new Date(Date.now() - 5 * DAY) } });
    await log(hot.variants[0].id, 9); await log(hot.variants[1].id, 9); // L never sells
    await log(cold.variants[0].id, 1);
    await log(hot.variants[0].id, 60, wh.id); // the warehouse ships lots of S online itself → keeps a reserve
    // top 1 = Hot Tee. S has nothing spare (warehouse keeps ceil((0.6·60/30 + 0.4·60/90)·7) = 11 > 10 back for its own online sales), L never sells → only M
    expect(await previewOpening(wh.id, { mode: "bestsellers", products: 1, perSize: 3 })).toEqual({ ok: true, sizes: 1, units: 3 });
    // top 2 adds the coat's M
    expect(await previewOpening(wh.id, { mode: "bestsellers", products: 2, perSize: 3 })).toEqual({ ok: true, sizes: 2, units: 6 });
  });

  it("refuses a duplicate code, and only the owner opens shops", async () => {
    expect(await open({ ...base(wh.id, { mode: "bestsellers", products: 10, perSize: 1 }), code: "KTM" })).toMatchObject({ ok: false, error: expect.stringMatching(/already used/) });
    expect(await open({ ...base(wh.id, { mode: "bestsellers", products: 10, perSize: 1 }), district: "Atlantis" })).toMatchObject({ ok: false, error: expect.stringMatching(/district/) });
    actAs(await makeUser("MANAGER"));
    await expect(openNewShop(base(wh.id, { mode: "bestsellers", products: 10, perSize: 1 }))).rejects.toThrow();
    expect(await db.store.count({ where: { code: "BTW" } })).toBe(0);
  });
});
