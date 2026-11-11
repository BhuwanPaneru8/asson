import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { closeChecklist, closeMonth, isMonthClosed, reopenMonth } from "@/lib/month-close";
import { importStatement, resolveLine } from "@/lib/bank-statements";
import { recordBill, recordPayment, voidPayment } from "@/lib/payables";
import { countSafe, recordDeposit } from "@/lib/cash";
import { postRecurring, saveRecurringCost } from "@/lib/shop-pl";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
const rs = (n: number) => n * 100;
const line = (date: string, amount: number, description = "", reference = "") => ({ date, amount, description, reference, row: 2 });

describe("supplier payments on the statement, and month-end close", () => {
  let owner: U, acct: U, supplierId: string;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    acct = await makeUser("ADMIN", { name: "Accountant" });
    supplierId = (await db.supplier.create({ data: { name: "Birgunj Mills", paymentTermsDays: 15 } })).id;
  });

  it("debits: supplier payments by bank (cheques clear late, references settle ties), bank-paid expenses, fees booked from the line", async () => {
    await db.$transaction((tx) => recordBill(tx, owner, { supplierId, reference: "INV-1", billDate: "2026-10-01", amount: rs(90_000), vatAmount: 0 }));
    const chq1 = await db.$transaction((tx) => recordPayment(tx, owner, { supplierId, amount: rs(40_000), method: "CHEQUE", reference: "CHQ 000123", paidAt: "2026-10-03" }));
    const chq2 = await db.$transaction((tx) => recordPayment(tx, owner, { supplierId, amount: rs(40_000), method: "CHEQUE", reference: "CHQ 000124", paidAt: "2026-10-03" }));
    const cash = await db.$transaction((tx) => recordPayment(tx, owner, { supplierId, amount: rs(10_000), method: "CASH", paidAt: "2026-10-04" }));
    const rent = await db.expense.create({ data: { date: "2026-10-05", category: "RENT", amount: rs(55_000), description: "HQ rent", paidVia: "Bank transfer", createdById: owner.id } });
    await db.expense.create({ data: { date: "2026-10-05", category: "OTHER", amount: rs(10_000), description: "Petty", paidVia: "Petty cash", source: "petty:x", createdById: owner.id } });

    const r = await db.$transaction((tx) => importStatement(tx, acct, "NIC Asia current", [
      line("2026-10-07", -rs(40_000), "CHQ PAID 000124"), // clears 4 days later; the cheque number picks chq2 over chq1
      line("2026-10-08", -rs(40_000), "CHQ PAID"), // then the only one left
      line("2026-10-06", -rs(55_000), "TRANSFER TO LANDLORD"),
      line("2026-10-09", -rs(10_000), "ATM"), // the cash payment and the petty spend are never candidates
      line("2026-10-31", -rs(250), "SMS CHARGES"),
    ]));
    expect(r).toMatchObject({ payments: 2, expenses: 1 });
    expect((await db.statementLine.findFirstOrThrow({ where: { paymentId: chq2.id } })).date).toBe("2026-10-07");
    expect((await db.statementLine.findFirstOrThrow({ where: { paymentId: chq1.id } })).date).toBe("2026-10-08");
    expect((await db.statementLine.findFirstOrThrow({ where: { expenseId: rent.id } })).date).toBe("2026-10-06");
    const atm = await db.statementLine.findFirstOrThrow({ where: { description: "ATM" } });
    expect(atm.status).toBe("UNMATCHED");
    await expect(db.$transaction((tx) => resolveLine(tx, acct, atm.id, { paymentId: cash.id }))).rejects.toThrow(/in cash/);
    await expect(db.$transaction((tx) => resolveLine(tx, acct, atm.id, { paymentId: chq1.id }))).rejects.toThrow(/already matched/);
    await db.$transaction((tx) => resolveLine(tx, acct, atm.id, { ignore: "Owner cash withdrawal" }));
    const sms = await db.statementLine.findFirstOrThrow({ where: { description: "SMS CHARGES" } });
    await expect(db.$transaction((tx) => resolveLine(tx, acct, sms.id, { book: { category: "SALARIES", description: "x" } }))).rejects.toThrow(/payroll/);
    await db.$transaction((tx) => resolveLine(tx, acct, sms.id, { book: { category: "FEES", description: "SMS charges" } }));
    expect(await db.statementLine.count({ where: { status: "UNMATCHED" } })).toBe(0);
    await expect(db.statementLine.update({ where: { id: sms.id }, data: { paymentId: chq1.id } })).rejects.toThrow(); // one match per line (and per payment)
  });

  it("the checklist blocks closing until tills, statement lines and deposits are done; warnings need a yes", async () => {
    const shop = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    const mgr = await makeUser("MANAGER", { name: "Sita", locations: [shop.id] });
    await expect(db.$transaction((tx) => closeMonth(tx, owner, "2999-01", { acceptWarnings: true }))).rejects.toThrow(/finished month/);
    // October: an open shift, a deposit nobody checked, a statement line nobody explained
    const sh = await db.shift.create({ data: { storeId: shop.id, cashierId: mgr.id, openingFloat: 0, openedAt: new Date("2026-10-30T10:00:00Z") } });
    await db.$transaction((tx) => countSafe(tx, mgr, shop.id, rs(10_000), ""));
    const dep = await db.$transaction((tx) => recordDeposit(tx, mgr, { storeId: shop.id, amount: rs(5_000), bank: "NIC Asia", slipNo: "S1", depositedOn: "2026-10-30" }));
    await db.$transaction((tx) => importStatement(tx, acct, "Nabil", [line("2026-10-31", rs(1_234), "UNKNOWN CREDIT")]));
    let c = await closeChecklist("2026-10");
    expect(c.items.filter((i) => i.blocking && i.count).map((i) => i.key)).toEqual(["shifts", "statement", "deposits"]);
    await expect(db.$transaction((tx) => closeMonth(tx, owner, "2026-10", { acceptWarnings: true }))).rejects.toThrow(/Clear these first/);

    await db.shift.update({ where: { id: sh.id }, data: { status: "CLOSED", closedAt: new Date("2026-10-30T18:00:00Z"), countedCash: 0, expectedCash: 0, difference: 0 } });
    const ln = await db.statementLine.findFirstOrThrow({ where: { description: "UNKNOWN CREDIT" } });
    await db.$transaction((tx) => resolveLine(tx, acct, ln.id, { ignore: "Owner top-up" }));
    await db.bankDeposit.update({ where: { id: dep.id }, data: { status: "VERIFIED", bankAmount: rs(5_000), checkedById: acct.id, checkedAt: new Date() } });
    c = await closeChecklist("2026-10");
    expect(c.blocking).toBe(0);
    expect(c.items.filter((i) => !i.blocking && i.count).map((i) => i.key)).toEqual(expect.arrayContaining(["payroll"]));
    await expect(db.$transaction((tx) => closeMonth(tx, owner, "2026-10", { acceptWarnings: false }))).rejects.toThrow(/confirm/);
    await db.$transaction((tx) => closeMonth(tx, owner, "2026-10", { acceptWarnings: true }));
    expect(await isMonthClosed("2026-10")).toBe(true);
    await expect(db.$transaction((tx) => closeMonth(tx, owner, "2026-10", { acceptWarnings: true }))).rejects.toThrow(/already closed/);
  });

  it("a closed month is locked in the database; paying its bill later is fine; reopening needs a reason", async () => {
    const b = await db.$transaction((tx) => recordBill(tx, owner, { supplierId, reference: "INV-9", billDate: "2026-10-10", amount: rs(20_000), vatAmount: 0 }));
    const p = await db.$transaction((tx) => recordPayment(tx, owner, { supplierId, amount: rs(5_000), method: "BANK", reference: "T1", paidAt: "2026-10-12" }));
    const e = await db.expense.create({ data: { date: "2026-10-15", category: "OTHER", amount: rs(100), description: "x", createdById: owner.id } });
    await db.$transaction((tx) => saveRecurringCost(tx, owner, { storeId: null, category: "UTILITIES", amount: rs(4_000), description: "Internet", startMonth: "2026-10", active: true }));
    await db.monthClose.create({ data: { month: "2026-10", closedAt: new Date(), closedById: owner.id, closedByName: "Owner", snapshot: {} } });

    // whatever the code path, the database refuses
    await expect(db.expense.create({ data: { date: "2026-10-20", category: "OTHER", amount: 1, description: "late", createdById: owner.id } })).rejects.toThrow(/2026-10 is closed/);
    await expect(db.expense.update({ where: { id: e.id }, data: { amount: 200 } })).rejects.toThrow(/closed/);
    await expect(db.expense.delete({ where: { id: e.id } })).rejects.toThrow(/closed/);
    await expect(db.supplierBill.update({ where: { id: b.id }, data: { amount: rs(1) } })).rejects.toThrow(/closed/);
    await expect(db.supplierPayment.update({ where: { id: p.id }, data: { amount: rs(1) } })).rejects.toThrow(/closed/);
    // and the app says so clearly first
    await expect(db.$transaction((tx) => recordBill(tx, owner, { supplierId, reference: "INV-LATE", billDate: "2026-10-30", amount: rs(1_000), vatAmount: 0 }))).rejects.toThrow(/2026-10 is closed, so a bill can't be added/);
    await expect(db.$transaction((tx) => voidPayment(tx, owner, p.id, "mistake"))).rejects.toThrow(/closed/);
    expect(await postRecurring("2026-10")).toEqual({ posted: 0 });

    // paying October's bill in November is November's event
    await db.$transaction((tx) => recordPayment(tx, owner, { supplierId, amount: rs(15_000), method: "BANK", reference: "T2", paidAt: "2026-11-05" }));
    expect((await db.supplierBill.findUniqueOrThrow({ where: { id: b.id } })).paid).toBe(rs(20_000));

    await expect(db.$transaction((tx) => reopenMonth(tx, owner, "2026-10", " "))).rejects.toThrow(/Say why/);
    await db.$transaction((tx) => reopenMonth(tx, owner, "2026-10", "Late invoice from the landlord"));
    expect(await isMonthClosed("2026-10")).toBe(false);
    await db.expense.create({ data: { date: "2026-10-20", category: "RENT", amount: rs(1_000), description: "late", createdById: owner.id } });
    await db.$transaction((tx) => closeMonth(tx, owner, "2026-10", { acceptWarnings: true }));
    expect(await db.monthClose.findUniqueOrThrow({ where: { month: "2026-10" } })).toMatchObject({ closes: 2, reopenReason: "Late invoice from the landlord" });
    expect(await isMonthClosed("2026-10")).toBe(true);
  });
});
