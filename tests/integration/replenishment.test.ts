import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { autoDraftReplenishment, replenishmentPlan } from "@/lib/replenishment";
import { draftReplenishment } from "@/actions/admin/replenishment";
import { actAs, makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

const DAY = 86_400_000;
type Loc = Awaited<ReturnType<typeof makeLocation>>;

/** Sales history at a location (only the ledger matters for speed). */
async function sold(storeId: string, variantId: string, units: number, daysAgo: number) {
  await db.inventoryLog.create({ data: { variantId, storeId, delta: -units, reason: "SALE", createdAt: new Date(Date.now() - daysAgo * DAY) } });
}
const put = (storeId: string, variantId: string, quantity: number) => db.storeStock.upsert({ where: { storeId_variantId: { storeId, variantId } }, create: { storeId, variantId, quantity }, update: { quantity } });
const lines = async () => (await replenishmentPlan()).flatMap((r) => r.lines.map((l) => [r.fromName, r.toName, l.size, l.quantity, l.reason]));

describe("store replenishment", () => {
  let whKtm: Loc, whBrt: Loc, pkr: Loc, ktm: Loc, v: string;
  beforeEach(async () => {
    await resetDb();
    whKtm = await makeLocation({ code: "WHK", name: "Kathmandu warehouse", kind: "WAREHOUSE", priority: 10 });
    whBrt = await makeLocation({ code: "WHB", name: "Biratnagar warehouse", kind: "WAREHOUSE", priority: 5 });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara", priority: 30 });
    ktm = await makeLocation({ code: "KTMS", name: "Kathmandu shop", priority: 20 });
    for (const [l, d] of [[whKtm, "Kathmandu"], [whBrt, "Morang"], [pkr, "Kaski"], [ktm, "Kathmandu"]] as const) await db.store.update({ where: { id: l.id }, data: { district: d } });
    const p = await makeProduct({ stock: { M: 50 }, at: whKtm.id });
    v = p.variants[0].id;
    await put(whBrt.id, v, 50);
  });

  it("tops a busy shop up to 21 days of its own sales from the NEAREST warehouse", async () => {
    for (let d = 1; d <= 28; d += 3) await sold(pkr.id, v, 3, d); // 30 in 30 days at Pokhara
    await put(pkr.id, v, 4);
    // speed 0.6·1 + 0.4·(30/90) ≈ 0.733/day → target ceil(15.4) = 16 → need 12; Kathmandu is nearer to Kaski than Biratnagar
    expect(await lines()).toEqual([["Kathmandu warehouse", "Pokhara", "M", 12, "warehouse"]]);
  });

  it("counts transfers already drafted or on the way, and keeps a warehouse's own online reserve", async () => {
    for (let d = 1; d <= 28; d += 3) await sold(pkr.id, v, 3, d);
    await put(pkr.id, v, 4);
    await db.stockTransfer.create({ data: { fromId: whBrt.id, toId: pkr.id, status: "SENT", createdById: "x", items: { create: { variantId: v, quantity: 5 } } } });
    for (let d = 1; d <= 29; d += 1) await sold(whKtm.id, v, 2, d); // the Kathmandu warehouse sells ~2/day online
    await put(whKtm.id, v, 15); // 58 sold in 30 days → ~1.42/day → reserve ceil(9.9) = 10 → only 5 spare there
    // need 12 − 5 already on the way = 7: 5 from the nearer warehouse, the other 2 from Biratnagar
    expect(await lines()).toEqual([["Kathmandu warehouse", "Pokhara", "M", 5, "warehouse"], ["Biratnagar warehouse", "Pokhara", "M", 2, "warehouse"]]);
  });

  it("moves stock a shop isn't selling to a shop that is, when the warehouses are empty", async () => {
    await put(whKtm.id, v, 0); await put(whBrt.id, v, 0);
    for (let d = 1; d <= 28; d += 3) await sold(pkr.id, v, 3, d);
    await put(ktm.id, v, 10); // sitting in the Kathmandu shop, unsold for months
    await sold(ktm.id, v, 1, 80); // last sold 80 days ago
    expect(await lines()).toEqual([["Kathmandu shop", "Pokhara", "M", 9, "rebalance"]]); // keeps its own display minimum of 1
  });

  it("keeps at least one of every size a shop sells on display", async () => {
    await sold(pkr.id, v, 1, 70); // one sale in 90 days
    expect(await lines()).toEqual([["Kathmandu warehouse", "Pokhara", "M", 1, "warehouse"]]);
  });

  it("drafting: by the sending location, once (re-planning sees the draft), and the nightly job only when switched on", async () => {
    for (let d = 1; d <= 28; d += 3) await sold(pkr.id, v, 3, d);
    actAs(await makeUser("STAFF", { locations: [pkr.id] })); // the receiving shop can see, not draft
    expect(await draftReplenishment([{ fromId: whKtm.id, toId: pkr.id }])).toMatchObject({ ok: false, error: expect.stringMatching(/Nothing to draft/) });
    actAs(await makeUser("STAFF", { locations: [whKtm.id] }));
    expect(await draftReplenishment([{ fromId: whKtm.id, toId: pkr.id }])).toMatchObject({ ok: true, drafted: ["TR-00001"] });
    expect(await db.stockTransferItem.findFirstOrThrow()).toMatchObject({ quantity: 16 });
    expect(await replenishmentPlan()).toEqual([]); // nothing left to suggest
    expect(await autoDraftReplenishment()).toEqual({ skipped: "autoDraft is off" });
  });
});
