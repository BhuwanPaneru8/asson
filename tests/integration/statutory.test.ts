import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { approveRun, buildRun, confirmTaxYear, markPaid, saveEmployment, saveTaxYear } from "@/lib/payroll";
import { TEMPLATE_2082 } from "@/lib/payroll-rules";
import { dueOnFor, recordDeposit, statutoryOverview, tdsAnnual } from "@/lib/statutory";
import { importStatement } from "@/lib/bank-statements";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
const rs = (n: number) => n * 100;
const late = new Date("2026-12-30T06:00:00Z");

describe("payroll TDS and SSF deposits", () => {
  let owner: U, acct: U, sita: U, ram: U;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    acct = await makeUser("ADMIN", { name: "Accountant" });
    const shop = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    sita = await makeUser("MANAGER", { name: "Sita", locations: [shop.id] });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [shop.id] });
    await db.$transaction((tx) => saveTaxYear(tx, owner, "2083/84", TEMPLATE_2082));
    await db.$transaction((tx) => confirmTaxYear(tx, owner, "2083/84"));
    await db.$transaction((tx) => saveEmployment(tx, owner, sita.id, { basic: rs(120_000), allowance: 0, inSsf: true, married: false, active: true, pan: "123456789" }));
    await db.$transaction((tx) => saveEmployment(tx, owner, ram.id, { basic: rs(30_000), allowance: 0, inSsf: false, married: false, active: true }));
  });

  const pay = async (month: string, last: string) => {
    await db.$transaction((tx) => buildRun(tx, owner, month, last));
    await db.$transaction((tx) => approveRun(tx, owner, month));
    return db.$transaction((tx) => markPaid(tx, owner, month, "Bank", last));
  };

  it("paying payroll creates what's owed with due dates; deposits recorded or matched from the bank; annual TDS per employee", async () => {
    expect(dueOnFor("2026-11")).toBe("2026-12-25");
    expect(dueOnFor("2026-12")).toBe("2027-01-25");
    const nov = await pay("2026-11", "2026-11-30");
    const owed = await db.statutoryDeposit.findMany({ include: { run: true } });
    const ssf = owed.find((d) => d.kind === "SSF")!, tds = owed.find((d) => d.kind === "TDS")!;
    expect([ssf.amount, ssf.dueOn, tds.amount, tds.dueOn]).toEqual([nov.ssf, "2026-12-25", nov.tds, "2026-12-25"]);
    expect(nov.tds).toBeGreaterThan(0);
    // paying again can't double the dues
    await expect(db.$transaction((tx) => markPaid(tx, owner, "2026-11", "Bank", "2026-11-30"))).rejects.toThrow();
    expect(await db.statutoryDeposit.count()).toBe(2);

    expect((await statutoryOverview(new Date("2026-12-30T06:00:00Z"))).map((r) => r.state)).toEqual(["overdue", "overdue"]);
    await expect(db.$transaction((tx) => recordDeposit(tx, acct, tds.id, { paidOn: "2026-12-20", amount: tds.amount, reference: " " }, late))).rejects.toThrow(/voucher/);
    await db.$transaction((tx) => recordDeposit(tx, acct, tds.id, { paidOn: "2026-12-20", amount: tds.amount, reference: "IRD-CH-77" }, late));
    await expect(db.$transaction((tx) => recordDeposit(tx, acct, tds.id, { paidOn: "2026-12-21", amount: 1, reference: "x" }, late))).rejects.toThrow(/Already/);

    // the SSF deposit appears on the bank statement and is matched (and recorded) from it; the TDS too
    const r = await db.$transaction((tx) => importStatement(tx, acct, "NIC Asia current", [
      { date: "2026-12-22", amount: -ssf.amount, description: "SSF CONTRIBUTION NOV", reference: "", row: 2 },
      { date: "2026-12-20", amount: -tds.amount, description: "IRD TDS DEPOSIT", reference: "IRD-CH-77", row: 3 },
    ]));
    expect(r.statutory).toBe(2);
    expect(await db.statutoryDeposit.findUniqueOrThrow({ where: { id: ssf.id } })).toMatchObject({ paidOn: "2026-12-22", paidAmount: ssf.amount });
    expect((await statutoryOverview(new Date("2026-12-30T06:00:00Z"))).map((x) => x.state)).toEqual(["paid", "paid"]);

    const a = await tdsAnnual("2083/84");
    expect(a.rows.map((x) => [x.name, x.pan, x.months])).toEqual([["Ram", "", 1], ["Sita", "123456789", 1]]);
    expect(a.total.tds).toBe(nov.tds);
    expect(a.missingPan).toBe(a.rows.filter((x) => !x.pan && x.tds > 0).length);
  });
});
