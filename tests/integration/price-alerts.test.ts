import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { subscribePriceAlert } from "@/actions/stock-alerts";
import { addItems, createEvent, preview, scheduleEvent } from "@/lib/markdowns";
import { queuePriceDrops } from "@/lib/stock-alerts";
import { makeProduct, makeUser, resetDb } from "../support/db";

const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

describe("price-drop alerts", () => {
  beforeEach(resetDb);

  it("subscribing records today's price (asking again re-arms it); only active products, valid numbers", async () => {
    const p = await makeProduct({ price: 2000, stock: { M: 3 } });
    expect(await subscribePriceAlert({ productId: p.id, phone: "12345" })).toMatchObject({ ok: false, error: expect.stringMatching(/10-digit/) });
    expect(await subscribePriceAlert({ productId: p.id, phone: "9811111111" })).toEqual({ ok: true, message: "Done — we'll text you if the price drops." });
    expect(await db.priceAlert.findFirstOrThrow({ where: { productId: p.id } })).toMatchObject({ price: 200_000, notifiedAt: null });
    await db.priceAlert.updateMany({ data: { notifiedAt: new Date() } });
    await db.product.update({ where: { id: p.id }, data: { price: 180_000 } });
    await subscribePriceAlert({ productId: p.id, phone: "9811111111" });
    expect(await db.priceAlert.findFirstOrThrow({ where: { productId: p.id } })).toMatchObject({ price: 180_000, notifiedAt: null });
    await db.product.update({ where: { id: p.id }, data: { status: "ARCHIVED" } });
    expect(await subscribePriceAlert({ productId: p.id, phone: "9822222222" })).toMatchObject({ ok: false });
  });

  it("a sale starting texts each watcher once, listing several products in one SMS; only when the price is really lower", async () => {
    const owner = await makeUser("ADMIN");
    const a = await makeProduct({ price: 2000, cost: 500, stock: { M: 3 } });
    const b = await makeProduct({ price: 3000, cost: 500, stock: { M: 3 } });
    const c = await makeProduct({ price: 1000, cost: 500, stock: { M: 3 } });
    for (const [pid, phone] of [[a.id, "9811111111"], [b.id, "9811111111"], [a.id, "9822222222"], [c.id, "9833333333"]] as const) await subscribePriceAlert({ productId: pid, phone });
    const e = await tx((t) => createEvent(t, owner, { name: "Sale", startsAt: new Date(Date.now() - 60_000), endsAt: null }));
    await tx((t) => addItems(t, owner, e.id, { productIds: [a.id, b.id], percentOff: 20 }));
    expect((await preview(e.id))!.rows.map((r) => [r.name, r.watching])).toEqual([[a.name, 2], [b.name, 1]].sort((x, y) => String(x[0]).localeCompare(String(y[0]))));
    await tx((t) => scheduleEvent(t, owner, e.id, { allowBelowMargin: false })); // starts now
    const sms = await db.notification.findMany({ where: { template: "price_drop" }, orderBy: { to: "asc" } });
    expect(sms.map((s) => s.to)).toEqual(["9811111111", "9822222222"]); // c wasn't marked down
    expect(sms[0].body).toMatch(/price drop! .* is now Rs\. [\d,]+ \(was Rs\. [\d,]+\) and 1 more you watched/);
    expect(await db.priceAlert.count({ where: { notifiedAt: null } })).toBe(1); // only c's
    expect(await tx((t) => queuePriceDrops(t, [a.id, b.id]))).toBe(0); // each alert fires once
  });

  it("a price raised then back to the asked price doesn't fire; strictly lower does", async () => {
    const p = await makeProduct({ price: 2000, stock: { M: 3 } });
    await subscribePriceAlert({ productId: p.id, phone: "9811111111" });
    await db.product.update({ where: { id: p.id }, data: { price: 200_000 } });
    expect(await tx((t) => queuePriceDrops(t, [p.id]))).toBe(0);
    await db.product.update({ where: { id: p.id }, data: { price: 199_000 } });
    expect(await tx((t) => queuePriceDrops(t, [p.id]))).toBe(1);
  });
});
