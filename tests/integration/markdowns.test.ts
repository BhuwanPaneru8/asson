import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addItems, cancelEvent, createEvent, endEvent, eventResults, preview, removeItem, roundPrice, runPriceEvents, scheduleEvent, setItemPrice, suggestions } from "@/lib/markdowns";
import { makeProduct, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);
const H = 3_600_000;

describe("markdowns and price events", () => {
  let owner: U, mgr: U;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    mgr = await makeUser("MANAGER", { name: "Manager" });
  });
  const price = async (id: string) => db.product.findUniqueOrThrow({ where: { id }, select: { price: true, compareAtPrice: true } });

  it("rounds sale prices down to Rs 10; previews margin against the highest size cost and flags below-margin, clashes and no-cost", async () => {
    expect(roundPrice(179_950)).toBe(179_000);
    expect(roundPrice(500)).toBe(1000);
    const a = await makeProduct({ price: 2000, cost: 1000, stock: { S: 3, M: 2 } }); // Rs 2,000, cost Rs 1,000
    await db.variant.update({ where: { id: a.variants[1].id }, data: { costPrice: 110_000 } }); // M costs Rs 1,100
    const b = await makeProduct({ price: 1000, stock: { M: 4 } }); // no cost
    const now = new Date();
    const e = await tx((t) => createEvent(t, owner, { name: "Dashain sale", startsAt: new Date(now.getTime() + H), endsAt: new Date(now.getTime() + 48 * H) }));
    expect(await tx((t) => addItems(t, owner, e.id, { productIds: [a.id, b.id], percentOff: 45 }))).toEqual({ added: 2 });
    const p = (await preview(e.id))!;
    const ra = p.rows.find((r) => r.productId === a.id)!;
    expect([ra.shelf, ra.newPrice, ra.off, ra.cost, ra.margin, ra.stock, ra.belowCost, ra.belowMin]).toEqual([200_000, 110_000, 45, 110_000, 0, 5, false, true]);
    expect(p.rows.find((r) => r.productId === b.id)!.noCost).toBe(true);
    expect(p.totals).toMatchObject({ products: 2, units: 9, retailBefore: 200_000 * 5 + 100_000 * 4, retailAfter: 110_000 * 5 + 55_000 * 4, belowMin: 1 });

    await expect(tx((t) => scheduleEvent(t, mgr, e.id, { allowBelowMargin: true }, now))).rejects.toThrow(/only the owner can approve/);
    await expect(tx((t) => scheduleEvent(t, owner, e.id, { allowBelowMargin: false }, now))).rejects.toThrow(/Tick "below margin"/);
    await tx((t) => setItemPrice(t, e.id, a.id, 150_000));
    // a second sale at the same time with the same product can't be scheduled
    await tx((t) => scheduleEvent(t, owner, e.id, { allowBelowMargin: false }, now));
    const e2 = await tx((t) => createEvent(t, owner, { name: "Clash", startsAt: new Date(now.getTime() + 24 * H), endsAt: null }));
    await tx((t) => addItems(t, owner, e2.id, { productIds: [a.id], percentOff: 10 }));
    expect((await preview(e2.id))!.rows[0].clash).toMatch(/^SALE-\d+$/);
    await expect(tx((t) => scheduleEvent(t, owner, e2.id, { allowBelowMargin: false }, now))).rejects.toThrow(/Already in another sale/);
    await tx((t) => removeItem(t, e2.id, a.id));
    await expect(tx((t) => scheduleEvent(t, owner, e2.id, { allowBelowMargin: false }, now))).rejects.toThrow(/Add products first/);
    await tx((t) => cancelEvent(t, owner, e2.id));
    await expect(tx((t) => addItems(t, owner, e2.id, { productIds: [a.id], percentOff: 10 }))).rejects.toThrow(/Only a draft or scheduled/);
    await expect(tx((t) => addItems(t, owner, e.id, { productIds: [a.id], percentOff: 95 }))).rejects.toThrow(/1 to 89%/);
  });

  it("the job starts it on time (sale price live, old price struck through) and ends it (prices back; a price changed meanwhile is left)", async () => {
    const a = await makeProduct({ price: 2000, cost: 800, stock: { M: 5 } });
    const b = await makeProduct({ price: 3000, cost: 900, stock: { M: 5 } });
    await db.product.update({ where: { id: b.id }, data: { compareAtPrice: 350_000 } }); // has an MRP above the price
    const t0 = new Date("2026-12-01T10:00:00+05:45");
    const e = await tx((t) => createEvent(t, owner, { name: "Weekend", startsAt: t0, endsAt: new Date(t0.getTime() + 48 * H) }));
    await tx((t) => addItems(t, owner, e.id, { productIds: [a.id, b.id], percentOff: 25 }));
    await tx((t) => scheduleEvent(t, owner, e.id, { allowBelowMargin: false }, new Date(t0.getTime() - H)));
    expect(await runPriceEvents(new Date(t0.getTime() - 60_000))).toEqual({ started: 0, ended: 0 });
    expect(await runPriceEvents(t0)).toEqual({ started: 1, ended: 0 });
    expect(await price(a.id)).toEqual({ price: 150_000, compareAtPrice: 200_000 });
    expect(await price(b.id)).toEqual({ price: 225_000, compareAtPrice: 350_000 }); // the MRP stays
    expect(await runPriceEvents(t0)).toEqual({ started: 0, ended: 0 }); // twice is safe

    // during the sale someone reprices b by hand: it isn't put back
    await db.product.update({ where: { id: b.id }, data: { price: 199_000 } });
    expect(await runPriceEvents(new Date(t0.getTime() + 48 * H))).toEqual({ started: 0, ended: 1 });
    expect(await price(a.id)).toEqual({ price: 200_000, compareAtPrice: null });
    expect(await price(b.id)).toEqual({ price: 199_000, compareAtPrice: 350_000 });
    expect((await db.priceEventItem.findFirstOrThrow({ where: { productId: b.id } })).restoreSkipped).toBe(true);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "markdown.end" } })).summary).toMatch(/1 price\(s\) put back, 1 left as changed/);
  });

  it("scheduling once the start has come starts it straight away; a clearance never ends; results compare with the time before", async () => {
    const a = await makeProduct({ price: 2000, cost: 800, stock: { M: 10 } });
    const now = new Date();
    const order = (daysAgo: number, unitPrice: number, quantity: number) => db.order.create({ data: { email: "x@t.l", phone: "9800000000", status: "DELIVERED", paymentMethod: "COD", subtotal: unitPrice * quantity, total: unitPrice * quantity, shippingMethod: "standard", shippingAddress: {}, createdAt: new Date(now.getTime() - daysAgo * 24 * H),
      items: { create: [{ variantId: a.variants[0].id, productId: a.id, name: a.name, slug: a.slug, sku: a.variants[0].sku, color: "White", size: "M", image: "", unitPrice, unitCost: 80_000, quantity }] } } });
    await order(8, 200_000, 1); // before the sale
    const e = await tx((t) => createEvent(t, owner, { name: "Clearance", startsAt: new Date(now.getTime() - 7 * 24 * H), endsAt: null }));
    await tx((t) => addItems(t, owner, e.id, { productIds: [a.id], price: 120_000 }));
    await tx((t) => scheduleEvent(t, owner, e.id, { allowBelowMargin: false }, new Date(now.getTime() - 7 * 24 * H)));
    expect((await db.priceEvent.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("LIVE");
    expect((await price(a.id)).price).toBe(120_000);
    await order(3, 120_000, 3); await order(1, 120_000, 1);
    expect(await runPriceEvents(new Date(now.getTime() + 365 * 24 * H))).toEqual({ started: 0, ended: 0 }); // no end date
    const r = (await eventResults(e.id, now))!;
    expect([r.days, r.during.units, r.during.sales, r.before.units, r.margin]).toEqual([7, 4, 480_000, 1, 33.3]);
    const ended = await tx((t) => endEvent(t, e.id, owner, now));
    expect(ended).toEqual({ restored: 1, skipped: 0 });
    expect((await price(a.id)).price).toBe(200_000);
  });

  it("suggests slow stock with a markdown by how long it has sat", async () => {
    const old = await makeProduct({ price: 2000, cost: 900, stock: { M: 6 } });
    await db.variant.updateMany({ where: { productId: old.id }, data: { createdAt: new Date(Date.now() - 200 * 24 * H) } });
    const s = await suggestions();
    expect(s.find((x) => x.productId === old.id)).toMatchObject({ units: 6, atCost: 540_000, suggestOff: 40 });
  });
});
