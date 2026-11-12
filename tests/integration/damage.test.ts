import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { damageRegister, quarantine, recordCredit, takeOut } from "@/lib/damage";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

describe("damaged stock register", () => {
  let mgr: U, owner: U, other: U, ktm: L, pkr: L, p: Awaited<ReturnType<typeof makeProduct>>, supplierId: string;
  beforeEach(async () => {
    await resetDb();
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    mgr = await makeUser("MANAGER", { name: "Sita", locations: [ktm.id] });
    other = await makeUser("MANAGER", { name: "Hari", locations: [pkr.id] });
    owner = await makeUser("ADMIN", { name: "Owner" });
    p = await makeProduct({ price: 2000, cost: 900, stock: { M: 5 }, at: ktm.id });
    supplierId = (await db.supplier.create({ data: { name: "Birgunj Textiles" } })).id;
  });
  const v = () => p.variants[0];
  const here = async () => (await db.storeStock.findUnique({ where: { storeId_variantId: { storeId: ktm.id, variantId: v().id } } }))?.quantity ?? 0;

  it("damaged units come in off sale; repaired goes back on sale; written off needs a reason; you can't take out more than is held", async () => {
    await tx((t) => quarantine(t, { storeId: ktm.id, variantId: v().id, quantity: 3, source: "Store return R1", actorId: mgr.id }));
    expect(await here()).toBe(5); // off sale: sellable stock unchanged
    expect(await db.inventoryLog.findFirst({ where: { reason: "DAMAGED" } })).toMatchObject({ delta: 0, note: "Store return R1: 3 damaged, quarantined" });
    let r = await damageRegister({ all: true });
    expect(r.held.map((h) => [h.store, h.units, h.cost])).toEqual([["Kathmandu shop", 3, 90_000]]);
    expect([r.units, r.value]).toEqual([3, 270_000]);

    await expect(tx((t) => takeOut(t, other, { storeId: ktm.id, variantId: v().id, quantity: 1, kind: "REPAIRED" }))).rejects.toThrow(/not assigned to Kathmandu/);
    await expect(tx((t) => takeOut(t, mgr, { storeId: ktm.id, variantId: v().id, quantity: 4, kind: "REPAIRED" }))).rejects.toThrow(/Only 3 damaged here/);
    await tx((t) => takeOut(t, mgr, { storeId: ktm.id, variantId: v().id, quantity: 1, kind: "REPAIRED", note: "button sewn" }));
    expect(await here()).toBe(6);
    await expect(tx((t) => takeOut(t, mgr, { storeId: ktm.id, variantId: v().id, quantity: 1, kind: "WRITTEN_OFF" }))).rejects.toThrow(/Say what happened/);
    await tx((t) => takeOut(t, mgr, { storeId: ktm.id, variantId: v().id, quantity: 1, kind: "WRITTEN_OFF", note: "torn beyond repair, binned" }));
    r = await damageRegister({ all: false, storeIds: [ktm.id] });
    expect(r.units).toBe(1);
    expect(r.recent.map((e) => [e.kind, e.quantity])).toEqual([["WRITTEN_OFF", -1], ["REPAIRED", -1], ["IN", 3]]);
    expect((await damageRegister({ all: false, storeIds: [pkr.id] })).units).toBe(0);
  });

  it("back to the supplier: credit expected at cost (or as given), finance records what arrived, once", async () => {
    await tx((t) => quarantine(t, { storeId: ktm.id, variantId: v().id, quantity: 4, source: "Found damaged by staff" }));
    await expect(tx((t) => takeOut(t, mgr, { storeId: ktm.id, variantId: v().id, quantity: 2, kind: "TO_SUPPLIER" }))).rejects.toThrow(/Choose the supplier/);
    const e = await tx((t) => takeOut(t, mgr, { storeId: ktm.id, variantId: v().id, quantity: 2, kind: "TO_SUPPLIER", supplierId }));
    expect([e.creditExpected, e.source]).toEqual([180_000, "To Birgunj Textiles"]);
    const e2 = await tx((t) => takeOut(t, mgr, { storeId: ktm.id, variantId: v().id, quantity: 1, kind: "TO_SUPPLIER", supplierId, creditExpected: 50_000 }));
    let r = await damageRegister({ all: true });
    expect([r.owed.length, r.owedTotal, r.units]).toEqual([2, 230_000, 1]);
    await tx((t) => recordCredit(t, owner, e.id, 150_000));
    await expect(tx((t) => recordCredit(t, owner, e.id, 1))).rejects.toThrow(/already recorded/);
    r = await damageRegister({ all: true });
    expect([r.owed.map((c) => c.id), r.settled.map((c) => c.creditReceived)]).toEqual([[e2.id], [150_000]]);
  });

  it("is append-only: entries can't be deleted or changed, and the sign must match the kind", async () => {
    await tx((t) => quarantine(t, { storeId: ktm.id, variantId: v().id, quantity: 2, source: "x" }));
    const e = await db.damageEntry.findFirstOrThrow();
    await expect(db.damageEntry.delete({ where: { id: e.id } })).rejects.toThrow(/never deleted/);
    await expect(db.damageEntry.update({ where: { id: e.id }, data: { quantity: 1 } })).rejects.toThrow(/append-only/);
    await expect(db.damageEntry.create({ data: { storeId: ktm.id, variantId: v().id, kind: "WRITTEN_OFF", quantity: 2, source: "x" } })).rejects.toThrow(/DamageEntry_sign/);
  });

  it("two people taking out the last units at once: only what's held goes", async () => {
    await tx((t) => quarantine(t, { storeId: ktm.id, variantId: v().id, quantity: 2, source: "x" }));
    const r = await Promise.allSettled([1, 2].map(() => tx((t) => takeOut(t, mgr, { storeId: ktm.id, variantId: v().id, quantity: 2, kind: "WRITTEN_OFF", note: "binned" }))));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await damageRegister({ all: true })).units).toBe(0);
  });
});
