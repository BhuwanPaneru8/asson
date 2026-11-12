import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { payablesSummary, recordBill, recordCreditNote, recordPayment, supplierStatement, voidBill, voidCreditNote } from "@/lib/payables";
import { computeVat } from "@/lib/vat";
import { profitAndLoss } from "@/lib/finance";
import { quarantine, takeOut } from "@/lib/damage";
import { makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);
const D = "2026-11-10";

describe("supplier credit notes", () => {
  let owner: U, sid: string;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    sid = (await db.supplier.create({ data: { name: "Birgunj Textiles", pan: "301234567", paymentTermsDays: 30 } })).id;
  });
  const bill = (ref: string, amount: number, date = D) => tx((t) => recordBill(t, owner, { supplierId: sid, reference: ref, billDate: date, amount, vatAmount: 0 }));
  const credit = (ref: string, amount: number, extra: Partial<Parameters<typeof recordCreditNote>[2]> = {}) => tx((t) => recordCreditNote(t, owner, { supplierId: sid, reference: ref, date: D, amount, vatAmount: 0, reason: "price correction", ...extra }));

  it("settles the oldest bills like a payment; the rest is credit that the next bill uses; duplicates are refused", async () => {
    const b1 = await bill("INV-1", 100_000, "2026-11-01");
    const b2 = await bill("INV-2", 100_000, "2026-11-05");
    expect(await credit("CN-1", 150_000)).toMatchObject({ credit: 0, bills: 2 });
    expect((await db.supplierBill.findUniqueOrThrow({ where: { id: b1.id } })).status).toBe("PAID");
    expect((await db.supplierBill.findUniqueOrThrow({ where: { id: b2.id } })).paid).toBe(50_000);
    await expect(credit("CN-1", 1000)).rejects.toThrow(/already recorded as CN-/);
    await expect(credit("CN-2", 1000, { reason: "" })).rejects.toThrow(/what the credit is for/);
    expect(await credit("CN-2", 80_000)).toMatchObject({ credit: 30_000, bills: 1 }); // 50k settles b2, 30k left
    expect((await payablesSummary()).credit).toBe(30_000);
    const b3 = await bill("INV-3", 40_000);
    expect(b3.creditUsed).toBe(30_000); // the credit note's leftover pays the next bill
    const st = await supplierStatement(sid);
    expect(st.filter((r) => r.kind === "credit").map((r) => [r.label, r.credit])).toEqual([[expect.stringMatching(/^CN-\d{5}$/), 150_000], [expect.stringMatching(/^CN-\d{5}$/), 80_000]]);
    expect(st.at(-1)!.balance).toBe(10_000); // 240k billed − 230k credited
  });

  it("voiding a credit note makes its bills owed again; voiding a bill gives the credit note's part back as credit", async () => {
    const b1 = await bill("INV-1", 100_000);
    const cn = await credit("CN-1", 100_000);
    await tx((t) => voidCreditNote(t, owner, cn.id, "wrong supplier"));
    expect(await db.supplierBill.findUniqueOrThrow({ where: { id: b1.id } })).toMatchObject({ status: "OPEN", paid: 0 });
    await expect(tx((t) => voidCreditNote(t, owner, cn.id, "again"))).rejects.toThrow(/already void/);

    const b2 = await bill("INV-2", 50_000);
    await credit("CN-2", 50_000, { billIds: [b2.id] });
    await tx((t) => voidBill(t, owner, b2.id, "duplicate invoice"));
    // the 50k comes back as credit and is used on the still-open INV-1
    expect((await db.supplierBill.findUniqueOrThrow({ where: { id: b1.id } })).paid).toBe(50_000);
    await tx((t) => recordPayment(t, owner, { supplierId: sid, amount: 50_000, method: "CASH", paidAt: D }));
    expect((await db.supplierBill.findUniqueOrThrow({ where: { id: b1.id } })).status).toBe("PAID");
  });

  it("gives back input VAT in its period (PAN suppliers only) and, for damaged goods, comes off the cost of goods", async () => {
    await tx((t) => recordBill(t, owner, { supplierId: sid, reference: "INV-V", billDate: D, amount: 113_000, vatAmount: 13_000 }));
    const before = await computeVat("2026-11-01", "2026-11-30");
    expect(before.inputVat).toBe(13_000);
    await credit("CN-V", 22_600, { vatAmount: 2_600 });
    const after = await computeVat("2026-11-01", "2026-11-30");
    expect([after.inputVat, after.supplierCredits]).toEqual([10_400, { count: 1, vat: 2_600 }]);
    const noPan = (await db.supplier.create({ data: { name: "Street vendor" } })).id;
    await tx((t) => recordCreditNote(t, owner, { supplierId: noPan, reference: "X", date: D, amount: 11_300, vatAmount: 1_300, reason: "refund" }));
    expect((await computeVat("2026-11-01", "2026-11-30")).inputVat).toBe(10_400); // no PAN: no VAT claimed, none given back

    // damaged goods sent back: their credit (less VAT) lowers COGS; a plain price correction doesn't
    const shop = await makeLocation({ code: "KTM", name: "Kathmandu" });
    const p = await makeProduct({ price: 2000, cost: 900, stock: { M: 5 }, at: shop.id });
    await tx((t) => quarantine(t, { storeId: shop.id, variantId: p.variants[0].id, quantity: 2, source: "Store return R1" }));
    const sent = await tx((t) => takeOut(t, owner, { storeId: shop.id, variantId: p.variants[0].id, quantity: 2, kind: "TO_SUPPLIER", supplierId: sid }));
    const start = new Date("2026-11-01T00:00:00+05:45"), end = new Date("2026-12-01T00:00:00+05:45");
    const pl0 = await profitAndLoss(start, end, "2026-11-01", "2026-12-01");
    await credit("CN-D", 203_400, { vatAmount: 23_400, reason: "damaged returned", damageEntryIds: [sent.id] });
    const pl1 = await profitAndLoss(start, end, "2026-11-01", "2026-12-01");
    expect([pl1.supplierCredits, pl0.cogs - pl1.cogs]).toEqual([180_000, 180_000]);
    expect(await db.damageEntry.findUniqueOrThrow({ where: { id: sent.id } })).toMatchObject({ creditReceived: 180_000 });
  });

  it("a closed month's credit notes can't be added (by the app or straight into the database)", async () => {
    await db.monthClose.create({ data: { month: "2026-10", closedAt: new Date(), closedById: owner.id, snapshot: {} } });
    await expect(tx((t) => recordCreditNote(t, owner, { supplierId: sid, reference: "OLD", date: "2026-10-20", amount: 1000, vatAmount: 0, reason: "late" }))).rejects.toThrow(/closed/);
    await expect(db.supplierCredit.create({ data: { supplierId: sid, reference: "RAW", date: new Date("2026-10-20T12:00:00+05:45"), amount: 1000, unallocated: 1000, reason: "x", createdById: owner.id } })).rejects.toThrow(/Month 2026-10 is closed/);
  });
});
