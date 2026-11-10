import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { commissionsFor, saveRule } from "@/lib/commissions";
import { buildRun, confirmTaxYear, saveEmployment, saveTaxYear } from "@/lib/payroll";
import { TEMPLATE_2082 } from "@/lib/payroll-rules";
import { makeLocation, makeUser, resetDb } from "../support/db";

const rs = (n: number) => n * 100;
type U = Awaited<ReturnType<typeof makeUser>>;
type L = Awaited<ReturnType<typeof makeLocation>>;

describe("till sales commission", () => {
  let owner: U, ram: U, hari: U, ktm: L, pkr: L;
  const shift = async (u: U, at: L) => db.shift.create({ data: { storeId: at.id, cashierId: u.id, openingFloat: 0 } });
  const sale = async (u: U, sh: { id: string }, total: number, o: { day?: string; status?: "DELIVERED" | "CANCELLED" } = {}) => db.order.create({
    data: { email: "w@test.local", phone: "", status: o.status ?? "DELIVERED", paymentMethod: "IN_STORE", channel: "STORE", subtotal: total, total, shippingMethod: "pickup", shippingAddress: {}, cashierId: u.id, shiftId: sh.id, createdAt: new Date(`${o.day ?? "2026-11-05"}T06:00:00Z`) },
  });

  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN");
    ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    hari = await makeUser("CASHIER", { name: "Hari", locations: [pkr.id] });
    await db.$transaction((tx) => saveRule(tx, owner, { storeId: null, rateBp: 100, threshold: 0, active: true })); // 1% everywhere
    await db.$transaction((tx) => saveRule(tx, owner, { storeId: pkr.id, rateBp: 200, threshold: rs(50_000), active: true })); // Pokhara: 2% after Rs 50,000
  });

  it("pays on sales excluding VAT, minus this month's refunds; cancelled sales don't count", async () => {
    const sh = await shift(ram, ktm);
    const big = await sale(ram, sh, rs(113_000)); // taxable 1,00,000
    await sale(ram, sh, rs(11_300), { status: "CANCELLED" });
    await sale(ram, sh, rs(22_600), { day: "2026-10-30" }); // last month
    await db.return.create({ data: { orderId: big.id, processedById: owner.id, reason: "size", refundMethod: "CASH", refundAmount: rs(11_300), createdAt: new Date("2026-11-20T06:00:00Z") } });
    const [r] = await commissionsFor("2026-11");
    expect(r).toMatchObject({ userId: ram.id, storeId: ktm.id, orders: 1, sales: rs(100_000), refunds: rs(10_000), base: rs(90_000), rateBp: 100, commission: rs(900) });
  });

  it("a shop's own rule wins; its target must be reached first", async () => {
    const sh = await shift(hari, pkr);
    await sale(hari, sh, rs(45_200)); // taxable 40,000 < target 50,000
    expect((await commissionsFor("2026-11"))[0]).toMatchObject({ base: rs(40_000), rateBp: 200, commission: 0 });
    await sale(hari, sh, rs(22_600)); // +20,000 → 60,000 ≥ target → 2% of all of it
    expect((await commissionsFor("2026-11"))[0]).toMatchObject({ base: rs(60_000), commission: rs(1_200) });
  });

  it("goes onto the payslip as taxable pay", async () => {
    await db.$transaction((tx) => saveTaxYear(tx, owner, "2083/84", TEMPLATE_2082));
    await db.$transaction((tx) => confirmTaxYear(tx, owner, "2083/84"));
    await db.$transaction((tx) => saveEmployment(tx, owner, ram.id, { basic: rs(26_000), allowance: 0, inSsf: false, married: false, active: true }));
    await sale(ram, await shift(ram, ktm), rs(226_000)); // taxable 2,00,000 → 1% = 2,000
    await db.$transaction((tx) => buildRun(tx, owner, "2026-11", "2026-11-30"));
    expect(await db.payslip.findFirstOrThrow({ where: { userId: ram.id } })).toMatchObject({ commission: rs(2_000), gross: rs(28_000) });
  });

  it("only one rule per shop and one default, even if code tries", async () => {
    await expect(db.commissionRule.create({ data: { storeId: null, rateBp: 50 } })).rejects.toThrow();
    await expect(db.commissionRule.create({ data: { storeId: pkr.id, rateBp: 50 } })).rejects.toThrow();
    await expect(db.$transaction((tx) => saveRule(tx, owner, { storeId: null, rateBp: 5000, threshold: 0, active: true }))).rejects.toThrow(/between 0% and 20%/);
  });
});
