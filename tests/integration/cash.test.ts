import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { closeShift, createPosSale, openShift } from "@/actions/pos";
import { balanceOf, cashBook, cashPosition, checkDeposit, countSafe, pettySpend, recordDeposit } from "@/lib/cash";
import { actAs, makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;
const rs = (n: number) => n * 100;
const ph = `/media/p/${"f".repeat(32)}.jpg`;

describe("cash per location", () => {
  let owner: U, sita: U, ram: U, hari: U, ktm: L, pkr: L;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    sita = await makeUser("MANAGER", { name: "Sita", locations: [ktm.id] });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    hari = await makeUser("MANAGER", { name: "Hari", locations: [pkr.id] });
  });

  it("tills move cash in and out of the safe's book; the book is append-only", async () => {
    await db.$transaction((tx) => countSafe(tx, sita, ktm.id, rs(10_000), "Started"));
    const p = await makeProduct({ price: 1500, at: ktm.id });
    actAs(ram);
    expect((await openShift(2000, ktm.id)).ok).toBe(true); // Rs 2,000 float out of the safe
    expect(await balanceOf(db, ktm.id)).toBe(rs(8_000));
    expect((await createPosSale({ clientRef: "cash-test-1", lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: null, tenders: [{ method: "CASH", amount: rs(1500), tendered: rs(2000) }] })).ok).toBe(true);
    // while the shift is open, its cash shows as "in tills", not in the safe
    const [open] = (await cashPosition({ all: true })).filter((r) => r.storeId === ktm.id);
    expect(open).toMatchObject({ balance: rs(8_000), inTills: rs(3_500) });
    expect((await closeShift(3500)).ok).toBe(true);
    expect(await balanceOf(db, ktm.id)).toBe(rs(11_500));
    expect((await closeShift(3500)).ok).toBe(false); // already closed: nothing posted twice
    expect(await db.cashEntry.count({ where: { storeId: ktm.id } })).toBe(3);
    const e = await db.cashEntry.findFirstOrThrow({ where: { kind: "SHIFT_IN" } });
    await expect(db.cashEntry.update({ where: { id: e.id }, data: { amount: 1 } })).rejects.toThrow(/append-only/);
    await expect(db.cashEntry.delete({ where: { id: e.id } })).rejects.toThrow(/append-only/);
  });

  it("safe counts: the first starts the book; later differences need a reason", async () => {
    await expect(db.$transaction((tx) => countSafe(tx, hari, ktm.id, 100, ""))).rejects.toThrow(/not assigned to Kathmandu/);
    expect(await db.$transaction((tx) => countSafe(tx, sita, ktm.id, rs(5_000), ""))).toEqual({ difference: 0, balance: rs(5_000) });
    await expect(db.$transaction((tx) => countSafe(tx, sita, ktm.id, rs(4_900), " "))).rejects.toThrow(/short by Rs. 100. Say why/);
    expect(await db.$transaction((tx) => countSafe(tx, sita, ktm.id, rs(4_900), "Rs 100 note missing"))).toMatchObject({ difference: -rs(100) });
    expect(await db.$transaction((tx) => countSafe(tx, sita, ktm.id, rs(4_900), ""))).toMatchObject({ difference: 0 }); // matched: still recorded
    const [r] = (await cashPosition({ all: true })).filter((x) => x.storeId === ktm.id);
    expect(r).toMatchObject({ balance: rs(4_900), lastCountDiff: 0 });
  });

  it("deposits: within the book, slip once, checked by someone else; a shortfall goes back on the book", async () => {
    await db.$transaction((tx) => countSafe(tx, sita, ktm.id, rs(100_000), ""));
    await expect(db.$transaction((tx) => recordDeposit(tx, sita, { storeId: ktm.id, amount: rs(150_000), bank: "NIC Asia", slipNo: "A1" }))).rejects.toThrow(/only holds Rs. 1,00,000/);
    await expect(db.$transaction((tx) => recordDeposit(tx, sita, { storeId: ktm.id, amount: rs(10_000), bank: "NIC Asia", slipNo: "A1", depositedOn: "2999-01-01" }))).rejects.toThrow(/future/);
    const d1 = await db.$transaction((tx) => recordDeposit(tx, sita, { storeId: ktm.id, amount: rs(60_000), bank: "NIC Asia", slipNo: "A1", slipPhoto: ph }));
    await expect(db.$transaction((tx) => recordDeposit(tx, sita, { storeId: ktm.id, amount: rs(1_000), bank: "NIC Asia", slipNo: "A1" }))).rejects.toThrow(/already recorded/);
    const d2 = await db.$transaction((tx) => recordDeposit(tx, ram, { storeId: ktm.id, amount: rs(30_000), bank: "NIC Asia", slipNo: "A2" }));
    expect(await balanceOf(db, ktm.id)).toBe(rs(10_000));

    await expect(db.$transaction((tx) => checkDeposit(tx, sita, d1.id, { bankAmount: rs(60_000) }))).rejects.toThrow(/Someone else/);
    await db.$transaction((tx) => checkDeposit(tx, owner, d1.id, { bankAmount: rs(60_000) }));
    await expect(db.$transaction((tx) => checkDeposit(tx, owner, d2.id, { bankAmount: rs(25_000) }))).rejects.toThrow(/what the bank showed/);
    await db.$transaction((tx) => checkDeposit(tx, owner, d2.id, { bankAmount: rs(25_000), note: "Statement shows 25,000" }));
    await expect(db.$transaction((tx) => checkDeposit(tx, owner, d2.id, { bankAmount: rs(30_000) }))).rejects.toThrow(/Already checked/);
    expect(await balanceOf(db, ktm.id)).toBe(rs(15_000)); // the missing Rs 5,000 is the shop's to explain
    const [r] = (await cashPosition({ all: true })).filter((x) => x.storeId === ktm.id);
    expect(r).toMatchObject({ pending: 0, disputed: 1 });
    expect(r.flags).toContain("1 deposit disputed");
  });

  it("petty cash is limited, comes off the book and is an expense of the location (once)", async () => {
    await db.$transaction((tx) => countSafe(tx, sita, ktm.id, rs(3_000), ""));
    await expect(db.$transaction((tx) => pettySpend(tx, ram, { storeId: ktm.id, amount: rs(6_000), category: "OTHER", description: "Big thing" }))).rejects.toThrow(/up to Rs. 5,000/);
    await expect(db.$transaction((tx) => pettySpend(tx, ram, { storeId: ktm.id, amount: rs(4_000), category: "OTHER", description: "Too much" }))).rejects.toThrow(/only holds/);
    await expect(db.$transaction((tx) => pettySpend(tx, ram, { storeId: ktm.id, amount: rs(100), category: "SALARIES", description: "Wages" }))).rejects.toThrow(/payroll/);
    await db.$transaction((tx) => pettySpend(tx, ram, { storeId: ktm.id, amount: rs(450), category: "OTHER", description: "Tea and cleaning", receipt: ph }));
    expect(await balanceOf(db, ktm.id)).toBe(rs(2_550));
    const ex = await db.expense.findFirstOrThrow();
    expect(ex).toMatchObject({ amount: rs(450), storeId: ktm.id, paidVia: "Petty cash" });
    expect(ex.source).toMatch(/^petty:/);
  });

  it("two people taking money out at once can't overdraw the safe", async () => {
    await db.$transaction((tx) => countSafe(tx, sita, ktm.id, rs(50_000), ""));
    // six people at once, each taking Rs 40,000 of the 50,000: only one can succeed
    const r = await Promise.allSettled([1, 2, 3, 4, 5, 6].map((i) => db.$transaction((tx) => recordDeposit(tx, i % 2 ? sita : ram, { storeId: ktm.id, amount: rs(40_000), bank: "NIC Asia", slipNo: `X${i}` }))));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await balanceOf(db, ktm.id)).toBe(rs(10_000));
  });

  it("position flags and scope; the book shows a running balance", async () => {
    await db.$transaction((tx) => countSafe(tx, sita, ktm.id, rs(250_000), ""));
    const rows = await cashPosition({ all: true });
    expect(rows.find((x) => x.storeId === ktm.id)!.flags).toEqual(["over the Rs. 2,00,000 limit: deposit", "never deposited"]);
    expect(rows.find((x) => x.storeId === pkr.id)!.flags).toEqual(["cash book not started: count the safe"]);
    expect((await cashPosition({ all: false, storeIds: [pkr.id] })).map((x) => x.name)).toEqual(["Pokhara shop"]);
    await db.$transaction((tx) => recordDeposit(tx, sita, { storeId: ktm.id, amount: rs(200_000), bank: "NIC Asia", slipNo: "B1" }));
    const book = (await cashBook(sita, ktm.id))!;
    expect(book.entries.map((e) => [e.kind, e.balanceAfter])).toEqual([["DEPOSIT", rs(50_000)], ["OPENING", rs(250_000)]]);
    expect(await cashBook(hari, ktm.id)).toBeNull();
  });
});
