import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { countSafe, recordDeposit, balanceOf } from "@/lib/cash";
import { importStatement, parseDate, parseMoney, parseStatement, reconciliation, resolveLine } from "@/lib/bank-statements";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;
const rs = (n: number) => n * 100;

// the shape of a typical Nepali bank CSV export: a title block, the header, lines, a closing balance
const NIC = `NIC ASIA BANK LTD,,,,,,
Account Statement,,,,,,
Account No: 0123456789,,,,,,
Txn Date,Value Date,Description,Cheque No,Withdraw,Deposit,Balance
05/11/2026,05/11/2026,CASH DEP BY SITA SLIP A1001,,,"60,000.00","1,60,000.00"
06/11/2026,06/11/2026,CASH DEP KTM BRANCH,,,"30,000.00","1,90,000.00"
07/11/2026,07/11/2026,PATHAO COD SETTLEMENT REF PTH-778,,,"12,450.00","2,02,450.00"
08/11/2026,08/11/2026,SERVICE CHARGE,,150.00,,"2,02,300.00"
09/11/2026,09/11/2026,INTEREST CREDIT,,,"85.50","2,02,385.50"
,,Closing Balance,,,,"2,02,385.50"
`;

describe("bank statements", () => {
  let owner: U, acct: U, sita: U, ktm: L, pkr: L;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    acct = await makeUser("ADMIN", { name: "Accountant" });
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    sita = await makeUser("MANAGER", { name: "Sita", locations: [ktm.id, pkr.id] });
  });

  it("reads dates, money and real statement layouts", () => {
    expect(["2026-11-05", "05/11/2026", "5-11-2026", "05.11.26", "05-Nov-2026", "5 November 2026", "2026/11/05"].map(parseDate)).toEqual(Array(7).fill("2026-11-05"));
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("Closing Balance")).toBeNull();
    expect(["1,23,456.50", "Rs. 500", "(250.00)", "500 Cr", "500 DR", "-75", "", "abc"].map(parseMoney)).toEqual([12_345_650, 50_000, -25_000, 50_000, -50_000, -7_500, null, null]);
    const p = parseStatement(NIC);
    expect(p.columns).toMatchObject({ date: "Txn Date", desc: "Description", ref: "Cheque No", debit: "Withdraw", credit: "Deposit" });
    expect(p.lines.map((l) => [l.date, l.amount])).toEqual([["2026-11-05", rs(60_000)], ["2026-11-06", rs(30_000)], ["2026-11-07", rs(12_450)], ["2026-11-08", -rs(150)], ["2026-11-09", 8_550]]);
    expect(p.skipped).toEqual([10]); // the closing-balance line
    // a single signed amount column
    expect(parseStatement("Date,Narration,Amount\n2026-11-05,Cash,5000\n2026-11-06,Fee,-20").lines.map((l) => l.amount)).toEqual([rs(5000), -rs(20)]);
    expect(() => parseStatement("Name,Value\nx,1")).toThrow(/header row/);
  });

  it("matches deposits and COD remittances, disputes a short one, never twice, and leaves the importer's own deposits", async () => {
    await db.$transaction((tx) => countSafe(tx, sita, ktm.id, rs(200_000), ""));
    await db.$transaction((tx) => countSafe(tx, sita, pkr.id, rs(50_000), ""));
    const a1 = await db.$transaction((tx) => recordDeposit(tx, sita, { storeId: ktm.id, amount: rs(60_000), bank: "NIC Asia", slipNo: "A1001", depositedOn: "2026-11-05" }));
    // two Rs 30,000 deposits could explain the 6 Nov line: neither is guessed
    const k2 = await db.$transaction((tx) => recordDeposit(tx, sita, { storeId: ktm.id, amount: rs(30_000), bank: "NIC Asia", slipNo: "K2", depositedOn: "2026-11-06" }));
    const p2 = await db.$transaction((tx) => recordDeposit(tx, sita, { storeId: pkr.id, amount: rs(30_000), bank: "NIC Asia", slipNo: "P2", depositedOn: "2026-11-06" }));
    // a deposit the accountant (who imports) made: left for someone else
    const mine = await db.$transaction((tx) => recordDeposit(tx, acct, { storeId: ktm.id, amount: rs(85.5), bank: "NIC Asia", slipNo: "Z9", depositedOn: "2026-11-09" }));
    // a different bank, same amount: never matched to the NIC line
    await db.$transaction((tx) => recordDeposit(tx, sita, { storeId: pkr.id, amount: rs(12_450), bank: "Nabil", slipNo: "N1", depositedOn: "2026-11-07" }));
    const rem = await db.codRemittance.create({ data: { carrier: "Pathao", reference: "PTH-778", expected: rs(12_450), received: rs(12_450), createdById: owner.id, createdAt: new Date("2026-11-06T10:00:00Z") } });

    const r = await db.$transaction((tx) => importStatement(tx, acct, "NIC Asia current", parseStatement(NIC).lines));
    expect(r).toMatchObject({ added: 5, duplicates: 0, deposits: 1, remittances: 1, leftForOthers: 1 });
    expect(await db.bankDeposit.findUniqueOrThrow({ where: { id: a1.id } })).toMatchObject({ status: "VERIFIED", bankAmount: rs(60_000), checkedById: acct.id });
    expect((await db.statementLine.findFirstOrThrow({ where: { remittanceId: rem.id } })).date).toBe("2026-11-07");
    // the service charge (a debit) waits to be explained like any other line
    const fee = await db.statementLine.findFirstOrThrow({ where: { amount: { lt: 0 } } });
    expect(fee.status).toBe("UNMATCHED");

    // the same file again adds nothing
    expect(await db.$transaction((tx) => importStatement(tx, acct, "NIC Asia current", parseStatement(NIC).lines))).toMatchObject({ added: 0, duplicates: 5 });

    // finance settles the tie by hand: the 6 Nov credit is Kathmandu's; the bank shows exactly 30,000 → verified
    const rec = await reconciliation();
    const tie = rec.unmatched.find((l) => l.date === "2026-11-06")!;
    expect(tie.depositOptions.map((o) => o.id)).toEqual(expect.arrayContaining([k2.id, p2.id]));
    await db.$transaction((tx) => resolveLine(tx, acct, tie.id, { depositId: k2.id }));
    expect((await db.bankDeposit.findUniqueOrThrow({ where: { id: k2.id } })).status).toBe("VERIFIED");
    await expect(db.$transaction((tx) => resolveLine(tx, acct, tie.id, { depositId: p2.id }))).rejects.toThrow(/already dealt with/);

    // the interest line: the accountant can't match their own deposit; it's interest anyway
    const interest = rec.unmatched.find((l) => l.date === "2026-11-09")!;
    await expect(db.$transaction((tx) => resolveLine(tx, acct, interest.id, { depositId: mine.id }))).rejects.toThrow(/Someone else/);
    await expect(db.$transaction((tx) => resolveLine(tx, acct, interest.id, { ignore: " " }))).rejects.toThrow(/Say what this money is/);
    await db.$transaction((tx) => resolveLine(tx, acct, interest.id, { ignore: "Interest" }));
    await db.$transaction((tx) => resolveLine(tx, acct, fee.id, { book: { category: "FEES", description: "Bank service charge" } }));
    expect(await db.expense.findFirstOrThrow({ where: { source: `statement:${fee.id}` } })).toMatchObject({ amount: rs(150), date: "2026-11-08", category: "FEES", paidVia: "Bank", storeId: null });

    // a later statement shows Pokhara's 30,000 deposit as only 29,000: a dispute, the gap back on Pokhara's book
    const before = await balanceOf(db, pkr.id);
    await db.$transaction((tx) => importStatement(tx, owner, "NIC Asia current", [{ date: "2026-11-10", amount: rs(29_000), description: "CASH DEP PKR", reference: "", row: 2 }]));
    const short = (await db.statementLine.findFirstOrThrow({ where: { date: "2026-11-10" } }));
    await db.$transaction((tx) => resolveLine(tx, owner, short.id, { depositId: p2.id }));
    expect(await db.bankDeposit.findUniqueOrThrow({ where: { id: p2.id } })).toMatchObject({ status: "DISPUTED", bankAmount: rs(29_000) });
    expect(await balanceOf(db, pkr.id)).toBe(before + rs(1_000));

    // a deposit made a week before the latest NIC statement that never appeared: chase it. Recent ones (Z9, 1 day)
    // and ones at a bank with no statement yet (Nabil) aren't flagged.
    const lost = await db.$transaction((tx) => recordDeposit(tx, sita, { storeId: ktm.id, amount: rs(7_000), bank: "NIC Asia", slipNo: "OLD1", depositedOn: "2026-11-03" }));
    const after = await reconciliation();
    expect(after.unmatched).toHaveLength(0);
    expect(after.notOnStatement.map((d) => d.id)).toEqual([lost.id]);
    expect(mine.id).toBeTruthy();
  });
});
