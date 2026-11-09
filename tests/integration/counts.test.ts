import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { approveStockCount, cancelStockCount, scanForCount, setCountLine, startStockCount, submitStockCount } from "@/actions/admin/counts";
import { moveStock } from "@/lib/stock";
import { RedirectError } from "../support/next-mocks";
import { actAs, makeLocation, makeProduct, makeUser, resetDb, stockAt } from "../support/db";

async function start(storeId: string, categoryId?: string) {
  try {
    const r = await startStockCount({ storeId, categoryId });
    return { error: r.ok ? undefined : r.error };
  } catch (e) {
    if (e instanceof RedirectError) return { id: e.url.split("/").pop()! };
    throw e;
  }
}

describe("stock counts", () => {
  beforeEach(resetDb);

  it("blind count → submit → approve adjusts only the differences, with ledger and audit", async () => {
    const shop = await makeLocation({ code: "SHOP" });
    const p = await makeProduct({ cost: 500, stock: { S: 5, M: 3, L: 2 }, at: shop.id });
    const [s, m, l] = p.variants;
    const cashier = await makeUser("CASHIER");
    actAs(cashier);
    const { id } = await start(shop.id);
    expect(await db.stockCountLine.count({ where: { countId: id } })).toBe(3);

    // S: scanned 4 times (one missing); M: typed 3 (matches); L: not counted
    for (let i = 0; i < 4; i++) expect(await scanForCount(id!, s.sku.toLowerCase())).toMatchObject({ ok: true, counted: i + 1 });
    expect(await setCountLine(id!, m.id, 3)).toMatchObject({ ok: true, counted: 3 });
    expect(await scanForCount(id!, "NOPE-1")).toMatchObject({ ok: false, error: expect.stringMatching(/No item/) });
    // the counter never gets the system figure back
    expect(Object.keys(await scanForCount(id!, m.sku))).not.toContain("systemAt");
    expect(await setCountLine(id!, m.id, 3)).toMatchObject({ counted: 3 }); // fix the extra scan

    expect(await submitStockCount(id!)).toEqual({ ok: true });
    expect(await scanForCount(id!, s.sku)).toMatchObject({ ok: false, error: expect.stringMatching(/submitted/) }); // frozen
    await expect(approveStockCount(id!)).rejects.toThrow(); // cashiers can't approve (sent back to the till)
  });

  it("approval applies counted − system-at-count, so sales during the count aren't lost twice", async () => {
    const shop = await makeLocation({ code: "SHOP" });
    const p = await makeProduct({ cost: 500, stock: { S: 5, M: 3, L: 2 }, at: shop.id });
    const [s, m, l] = p.variants;
    actAs(await makeUser("STAFF"));
    const { id } = await start(shop.id);
    await setCountLine(id!, s.id, 4); // one S missing (system 5)
    await setCountLine(id!, m.id, 3);
    await submitStockCount(id!);
    // a till sale of one S after it was counted
    await db.$transaction((tx) => moveStock(tx, { variantId: s.id, storeId: shop.id, delta: -1, reason: "SALE" }));
    const manager = await makeUser("MANAGER");
    actAs(manager);
    expect(await approveStockCount(id!, "Shoplifting suspected")).toEqual({ ok: true, plus: 0, minus: 1 });
    // 5 − 1 sold − 1 missing = 3; M and uncounted L untouched
    expect([await stockAt(shop.id, s.id), await stockAt(shop.id, m.id), await stockAt(shop.id, l.id)]).toEqual([3, 3, 2]);
    expect(await db.inventoryLog.findFirstOrThrow({ where: { reason: "COUNT" } })).toMatchObject({ variantId: s.id, delta: -1, storeId: shop.id, actorId: manager.id });
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "count.approve" } })).summary).toMatch(/\+0 \/ −1 units, net -?Rs\. -?500/);
    expect(await approveStockCount(id!)).toMatchObject({ ok: false }); // not twice
  });

  it("found items are added; a loss bigger than what's left is capped at zero", async () => {
    const shop = await makeLocation({ code: "SHOP" });
    const wh = await makeLocation({ code: "WH", kind: "WAREHOUSE" });
    const p = await makeProduct({ stock: { M: 2 }, at: wh.id });
    await db.product.update({ where: { id: p.id }, data: { status: "DRAFT" } }); // not on sale, none at the shop: not on the list
    const q = await makeProduct({ stock: { M: 3 }, at: shop.id });
    actAs(await makeUser("MANAGER"));
    const { id } = await start(shop.id);
    expect(await scanForCount(id!, p.variants[0].sku)).toMatchObject({ ok: true, counted: 1 }); // found on the shop floor
    await setCountLine(id!, q.variants[0].id, 0); // counted none
    await submitStockCount(id!);
    await db.$transaction((tx) => moveStock(tx, { variantId: q.variants[0].id, storeId: shop.id, delta: -2, reason: "SALE" })); // 1 left
    expect(await approveStockCount(id!)).toEqual({ ok: true, plus: 1, minus: 1 }); // −3 counted, but only 1 left to remove
    expect([await stockAt(shop.id, p.variants[0].id), await stockAt(shop.id, q.variants[0].id)]).toEqual([1, 0]);
    expect((await db.stockCountLine.findFirstOrThrow({ where: { variantId: p.variants[0].id } })).added).toBe(true);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "count.approve" } })).summary).toMatch(/2 unit\(s\) already sold since counting/);
  });

  it("one open count per scope; a category count covers only that category; cancel changes nothing", async () => {
    const shop = await makeLocation({ code: "SHOP" });
    const shirts = await makeProduct({ stock: { M: 2 }, at: shop.id });
    const jeansCat = await db.category.create({ data: { name: "Jeans", slug: "jeans" } });
    const jeans = await makeProduct({ stock: { "32": 4 }, at: shop.id });
    await db.product.update({ where: { id: jeans.id }, data: { categoryId: jeansCat.id } });
    actAs(await makeUser("MANAGER"));
    const a = await start(shop.id, jeansCat.id);
    expect((await db.stockCountLine.findMany({ where: { countId: a.id } })).map((l) => l.variantId)).toEqual([jeans.variants[0].id]);
    expect(await start(shop.id)).toMatchObject({ error: expect.stringMatching(/still open/) }); // whole-location overlaps it
    expect(await cancelStockCount(a.id!, "x")).toMatchObject({ ok: false }); // needs a reason
    expect(await cancelStockCount(a.id!, "Wrong shelf")).toEqual({ ok: true });
    expect((await start(shop.id)).id).toBeTruthy();
    expect(await stockAt(shop.id, shirts.variants[0].id)).toBe(2);
  });

  it("a submitted count can only be rejected by someone who could approve it", async () => {
    const shop = await makeLocation({ code: "SHOP" });
    const p = await makeProduct({ stock: { M: 2 }, at: shop.id });
    actAs(await makeUser("CASHIER"));
    const { id } = await start(shop.id);
    await setCountLine(id!, p.variants[0].id, 2);
    await submitStockCount(id!);
    await expect(cancelStockCount(id!, "I miscounted")).rejects.toThrow();
    actAs(await makeUser("MANAGER"));
    expect(await cancelStockCount(id!, "Recount tomorrow")).toEqual({ ok: true });
  });
});
