import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { lockDay, openShift } from "@/actions/pos";
import { adjustStock } from "@/actions/admin/catalog";
import { cancelStockTransfer, newTransfer, pickOrder, receiveStockTransfer, sendStockTransfer } from "@/actions/admin/locations";
import { scanForCount, startStockCount } from "@/actions/admin/counts";
import { setStaffLocations } from "@/actions/admin/team";
import { scopeFor } from "@/lib/scope";
import { ktmDate } from "@/lib/pos";
import { RedirectError } from "../support/next-mocks";
import { actAs, makeLocation, makeProduct, makeUser, resetDb, stockAt } from "../support/db";

const redirected = async <T,>(p: Promise<T>) => {
  try { return await p; } catch (e) { if (e instanceof RedirectError) return { ok: true as const, id: e.url.split("/").pop()! }; throw e; }
};

describe("location-scoped staff", () => {
  let wh: Awaited<ReturnType<typeof makeLocation>>, ktm: typeof wh, pkr: typeof wh, p: Awaited<ReturnType<typeof makeProduct>>;
  beforeEach(async () => {
    await resetDb();
    wh = await makeLocation({ code: "WH", name: "Main warehouse", kind: "WAREHOUSE", priority: 10 });
    ktm = await makeLocation({ code: "KTM", name: "Asson Kathmandu", priority: 20 });
    pkr = await makeLocation({ code: "PKR", name: "Asson Pokhara", priority: 30 });
    p = await makeProduct({ stock: { M: 10 }, at: wh.id });
    await db.storeStock.create({ data: { storeId: pkr.id, variantId: p.variants[0].id, quantity: 4 } });
  });

  it("a cashier opens a till and closes the day only at their own shop", async () => {
    actAs(await makeUser("CASHIER", { locations: [pkr.id] }));
    expect(await openShift(0, ktm.id)).toMatchObject({ ok: false, error: expect.stringMatching(/only open a shift at a shop you work at/) });
    expect(await openShift(0)).toEqual({ ok: true }); // defaults to their shop
    expect((await db.shift.findFirstOrThrow()).storeId).toBe(pkr.id);
    actAs(await makeUser("MANAGER", { locations: [pkr.id] }));
    expect(await lockDay(ktmDate(), undefined, ktm.id)).toMatchObject({ ok: false, error: expect.stringMatching(/shop you manage/) });
    actAs(await makeUser("CASHIER", { locations: [] }));
    expect(await openShift(0)).toMatchObject({ ok: false, error: expect.stringMatching(/not assigned to a shop/) });
  });

  it("stock adjustments only where the manager works", async () => {
    actAs(await makeUser("MANAGER", { locations: [pkr.id] }));
    expect(await adjustStock(p.variants[0].id, -1, "DAMAGED", "Torn", wh.id)).toMatchObject({ ok: false, error: expect.stringMatching(/not assigned to Main warehouse/) });
    expect(await adjustStock(p.variants[0].id, -1, "DAMAGED", "Torn", pkr.id)).toMatchObject({ ok: true });
    expect([await stockAt(wh.id, p.variants[0].id), await stockAt(pkr.id, p.variants[0].id)]).toEqual([10, 3]);
  });

  it("transfers: only the sender sends or recalls, only the receiver counts in", async () => {
    const whStaff = await makeUser("STAFF", { locations: [wh.id] });
    const pkrStaff = await makeUser("STAFF", { locations: [pkr.id] });
    actAs(pkrStaff);
    expect(await redirected(newTransfer({ fromId: wh.id, toId: pkr.id, items: [{ variantId: p.variants[0].id, quantity: 2 }] }))).toMatchObject({ ok: false, error: expect.stringMatching(/not assigned to Main warehouse/) });
    actAs(whStaff);
    const t = (await redirected(newTransfer({ fromId: wh.id, toId: pkr.id, items: [{ variantId: p.variants[0].id, quantity: 2 }], sendNow: true }))) as { id: string };
    expect(await stockAt(wh.id, p.variants[0].id)).toBe(8);
    expect(await receiveStockTransfer({ id: t.id, counts: {} })).toMatchObject({ ok: false, error: expect.stringMatching(/not assigned to Asson Pokhara/) });
    actAs(pkrStaff);
    expect(await cancelStockTransfer(t.id, "Not needed")).toMatchObject({ ok: false });
    expect(await receiveStockTransfer({ id: t.id, counts: {} })).toMatchObject({ ok: true });
    expect(await stockAt(pkr.id, p.variants[0].id)).toBe(6);
    expect(await sendStockTransfer(t.id)).toMatchObject({ ok: false });
  });

  it("counts and pick lists belong to the people who work there", async () => {
    actAs(await makeUser("STAFF", { locations: [pkr.id] }));
    expect(await startStockCount({ storeId: wh.id })).toMatchObject({ ok: false, error: expect.stringMatching(/not assigned/) });
    const mine = (await redirected(startStockCount({ storeId: pkr.id }))) as { id: string };
    expect(await scanForCount(mine.id, p.variants[0].sku)).toMatchObject({ ok: true, counted: 1 });
    actAs(await makeUser("STAFF", { locations: [wh.id] }));
    expect(await scanForCount(mine.id, p.variants[0].sku)).toMatchObject({ ok: false, error: expect.stringMatching(/not assigned to Asson Pokhara/) });
    expect(await pickOrder("any-order", pkr.id)).toMatchObject({ ok: false, error: expect.stringMatching(/not assigned/) });
  });

  it("the owner assigns locations (audited); the owner and HQ staff act everywhere", async () => {
    const owner = await makeUser("ADMIN");
    const sita = await makeUser("MANAGER", { name: "Sita", locations: [] });
    expect(await scopeFor(owner)).toEqual({ all: true });
    expect(await scopeFor(sita)).toEqual({ all: false, storeIds: [] });
    actAs(owner);
    expect(await setStaffLocations({ userId: sita.id, all: false, storeIds: [pkr.id, ktm.id] })).toEqual({ ok: true });
    expect(new Set((await scopeFor(sita) as { storeIds: string[] }).storeIds)).toEqual(new Set([pkr.id, ktm.id]));
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "team.locations" } })).summary).toMatch(/Sita now works at Asson Kathmandu, Asson Pokhara \(was no locations\)/);
    expect(await setStaffLocations({ userId: sita.id, all: true, storeIds: [] })).toEqual({ ok: true });
    expect(await scopeFor(sita)).toEqual({ all: true });
    expect(await setStaffLocations({ userId: owner.id, all: false, storeIds: [] })).toMatchObject({ ok: false, error: expect.stringMatching(/owner always/) });
    actAs(sita);
    await expect(setStaffLocations({ userId: sita.id, all: true, storeIds: [] })).rejects.toThrow(); // managers can't change who works where
  });
});
