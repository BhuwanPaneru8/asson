import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createPosSale, openShift } from "@/actions/pos";
import { processReturn } from "@/actions/returns";
import { buildDaySummary, ktmDate } from "@/lib/pos";
import { actAs, makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

const ref = () => `test-${Math.random().toString(36).slice(2, 12)}`;

describe("daily closing: returns per shop", () => {
  beforeEach(resetDb);

  async function setup() {
    const ktm = await makeLocation({ code: "KTM", name: "Asson Kathmandu" });
    const pkr = await makeLocation({ code: "PKR", name: "Asson Pokhara" });
    const p = await makeProduct({ price: 2000, cost: 900, stock: { M: 10 }, at: ktm.id });
    await db.storeStock.create({ data: { storeId: pkr.id, variantId: p.variants[0].id, quantity: 10 } });
    return { ktm, pkr, variantId: p.variants[0].id };
  }

  /** A manager at one shop sells two units, then takes one back. */
  async function sellAndReturn(storeId: string, variantId: string, refundMethod: "CASH" | "STORE_CREDIT", condition: "RESELLABLE" | "DAMAGED") {
    const manager = await makeUser("MANAGER", { locations: [storeId] });
    actAs(manager);
    expect((await openShift(5000, storeId)).ok).toBe(true);
    const sale = await createPosSale({ clientRef: ref(), lines: [{ variantId, quantity: 2 }], discount: null, tenders: [{ method: "CASH", amount: 400_000 }] });
    if (!sale.ok) throw new Error(sale.error);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: sale.orderId } });
    const r = await processReturn({ clientRef: ref(), orderId: sale.orderId, lines: [{ orderItemId: item.id, quantity: 1, condition }], reason: "Size", refundMethod });
    if (!r.ok) throw new Error(r.error);
    return r;
  }

  it("each shop's closing lists only the returns taken at that shop", async () => {
    const { ktm, pkr, variantId } = await setup();
    const credit = await sellAndReturn(ktm.id, variantId, "STORE_CREDIT", "DAMAGED");
    const cashBack = await sellAndReturn(pkr.id, variantId, "CASH", "RESELLABLE");
    expect(await db.return.findUniqueOrThrow({ where: { id: credit.returnId } })).toMatchObject({ storeId: ktm.id });
    expect(await db.return.findUniqueOrThrow({ where: { id: cashBack.returnId } })).toMatchObject({ storeId: pkr.id });

    const k = await buildDaySummary(ktm.id, ktmDate());
    expect(k.returns.map((r) => r.id)).toEqual([credit.returnId]);
    expect(k.refunds).toEqual({ total: 200_000, cash: 0, credit: 200_000, damagedUnits: 1 });
    expect(k.cash.refunds).toBe(0);

    const p = await buildDaySummary(pkr.id, ktmDate());
    expect(p.returns.map((r) => r.id)).toEqual([cashBack.returnId]);
    expect(p.refunds).toEqual({ total: 200_000, cash: 200_000, credit: 0, damagedUnits: 0 });
    expect(p.cash.refunds).toBe(200_000);
    expect(p.alerts.join(" ")).not.toMatch(/damaged/);
  });

  it("the migration backfills the shop from the shift, else from the return's stock movement", async () => {
    const { ktm, pkr, variantId } = await setup();
    const a = await sellAndReturn(ktm.id, variantId, "STORE_CREDIT", "DAMAGED");
    const b = await sellAndReturn(pkr.id, variantId, "CASH", "RESELLABLE");
    // as before the column existed; `a` also lost its shift (store credit can have none)
    await db.return.updateMany({ data: { storeId: null } });
    await db.return.update({ where: { id: a.returnId }, data: { shiftId: null } });

    const sql = readFileSync(path.join(process.cwd(), "prisma/migrations/20261216100000_return_store/migration.sql"), "utf8");
    const updates = sql.split(";").map((s) => s.trim()).filter((s) => /^(--[^\n]*\n)*UPDATE/.test(s));
    expect(updates).toHaveLength(3);
    for (const u of updates) await db.$executeRawUnsafe(u);

    expect((await db.return.findUniqueOrThrow({ where: { id: a.returnId } })).storeId).toBe(ktm.id);
    expect((await db.return.findUniqueOrThrow({ where: { id: b.returnId } })).storeId).toBe(pkr.id);
  });
});
