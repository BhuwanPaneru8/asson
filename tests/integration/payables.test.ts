import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { recordSupplierBill, recordSupplierPayment, voidSupplierBill, voidSupplierPayment } from "@/actions/admin/payables";
import { billMismatch, payablesSummary, supplierStatement } from "@/lib/payables";
import { ktmDate } from "@/lib/pos";
import { actAs, makeUser, resetDb } from "../support/db";

const day = (offset: number) => ktmDate(new Date(Date.now() + offset * 86_400_000));
const bill = (supplierId: string, reference: string, amount: number, extra: Record<string, unknown> = {}) =>
  recordSupplierBill({ supplierId, reference, billDate: day(-40), amount, vatAmount: 0, ...extra });
const status = async (reference: string) => db.supplierBill.findFirstOrThrow({ where: { reference }, select: { paid: true, status: true, amount: true } });

describe("supplier bills and payments", () => {
  let supplierId: string;
  beforeEach(async () => {
    await resetDb();
    supplierId = (await db.supplier.create({ data: { name: "Birgunj Mills", paymentTermsDays: 15 } })).id;
    actAs(await makeUser("ADMIN"));
  });

  it("records bills with the supplier's terms, and refuses duplicates and nonsense", async () => {
    expect(await bill(supplierId, "INV-1", 11_300, { vatAmount: 1_300 })).toMatchObject({ ok: true });
    const b = await db.supplierBill.findFirstOrThrow();
    expect(b).toMatchObject({ amount: 1_130_000, vatAmount: 130_000, status: "OPEN" });
    expect(Math.round((b.dueDate.getTime() - b.billDate.getTime()) / 86_400_000)).toBe(15);
    expect(await bill(supplierId, "INV-1", 500)).toMatchObject({ ok: false, error: expect.stringMatching(/already recorded as BILL-00001/) });
    expect(await bill(supplierId, "INV-2", 100, { vatAmount: 200 })).toMatchObject({ ok: false, error: expect.stringMatching(/VAT/) });
    const other = await db.supplier.create({ data: { name: "Other" } });
    const po = await db.purchaseOrder.create({ data: { supplierId: other.id, createdById: "x" } });
    expect(await bill(supplierId, "INV-3", 100, { purchaseOrderId: po.id })).toMatchObject({ ok: false, error: expect.stringMatching(/another supplier/) });
  });

  it("pays oldest-due first, keeps the rest as credit, and new bills use the credit", async () => {
    await bill(supplierId, "A", 1000, { billDate: day(-60) });
    await bill(supplierId, "B", 3000, { billDate: day(-30) });
    expect(await recordSupplierPayment({ supplierId, amount: 2500, method: "BANK", reference: "NIC-778", paidAt: day(0) })).toMatchObject({ ok: true, credit: 0 });
    expect(await status("A")).toMatchObject({ status: "PAID", paid: 100_000 });
    expect(await status("B")).toMatchObject({ status: "OPEN", paid: 150_000 });
    expect(await recordSupplierPayment({ supplierId, amount: 2000, method: "CASH", paidAt: day(0) })).toMatchObject({ ok: true, credit: 50_000 });
    expect(await status("B")).toMatchObject({ status: "PAID" });
    // Rs 500 credit pays most of the next bill straight away
    expect(await bill(supplierId, "C", 800, { billDate: day(-1) })).toMatchObject({ ok: true, creditUsed: 50_000 });
    expect(await status("C")).toMatchObject({ status: "OPEN", paid: 50_000 });
    expect(await recordSupplierPayment({ supplierId, amount: 100, method: "BANK", paidAt: day(0) })).toMatchObject({ ok: false, error: expect.stringMatching(/reference/) });
  });

  it("can pay chosen bills only", async () => {
    await bill(supplierId, "OLD", 1000, { billDate: day(-60) });
    await bill(supplierId, "NEW", 1000, { billDate: day(-10) });
    const newer = await db.supplierBill.findFirstOrThrow({ where: { reference: "NEW" } });
    await recordSupplierPayment({ supplierId, amount: 1000, method: "CASH", paidAt: day(0), billIds: [newer.id] });
    expect([(await status("OLD")).status, (await status("NEW")).status]).toEqual(["OPEN", "PAID"]);
  });

  it("the database refuses overpaying a bill, whatever the code does", async () => {
    await bill(supplierId, "X", 1000);
    await expect(db.supplierBill.updateMany({ where: { reference: "X" }, data: { paid: 100_001 } })).rejects.toThrow(/SupplierBill_amounts/);
  });

  it("two payments at once never pay the same bill twice; the loser becomes credit", async () => {
    await bill(supplierId, "RACE", 1000);
    const pay = () => recordSupplierPayment({ supplierId, amount: 1000, method: "CASH", paidAt: day(0) });
    const results = await Promise.all([pay(), pay()]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await status("RACE")).toMatchObject({ status: "PAID", paid: 100_000 });
    expect((await db.supplierPayment.aggregate({ _sum: { unallocated: true } }))._sum.unallocated).toBe(100_000);
  });

  it("voiding: a payment makes its bills owe again; a bill returns what was paid on it as credit, reused elsewhere", async () => {
    await bill(supplierId, "P", 1000, { billDate: day(-50) });
    await recordSupplierPayment({ supplierId, amount: 1000, method: "CASH", paidAt: day(0) });
    const pay = await db.supplierPayment.findFirstOrThrow();
    expect(await voidSupplierPayment(pay.id, "x")).toMatchObject({ ok: false });
    expect(await voidSupplierPayment(pay.id, "Entered twice")).toEqual({ ok: true });
    expect(await status("P")).toMatchObject({ status: "OPEN", paid: 0 });
    expect(await voidSupplierPayment(pay.id, "again")).toMatchObject({ ok: false, error: expect.stringMatching(/already void/) });

    await recordSupplierPayment({ supplierId, amount: 1000, method: "CASH", paidAt: day(0) }); // pays P again
    await bill(supplierId, "Q", 600, { billDate: day(-5) });
    const p = await db.supplierBill.findFirstOrThrow({ where: { reference: "P" } });
    expect(await voidSupplierBill(p.id, "Supplier cancelled this invoice")).toEqual({ ok: true });
    expect(await status("P")).toMatchObject({ status: "VOID", paid: 0 });
    expect(await status("Q")).toMatchObject({ status: "PAID", paid: 60_000 }); // Rs 1000 credit reused
    expect((await db.supplierPayment.aggregate({ where: { voidedAt: null }, _sum: { unallocated: true } }))._sum.unallocated).toBe(40_000);
    expect(await db.auditLog.count({ where: { action: { in: ["bill.void", "payment.void"] } } })).toBe(2);
  });

  it("summary ages what's owed; the statement keeps a running balance that ignores voids", async () => {
    await bill(supplierId, "LATE", 1000, { billDate: day(-80), dueDate: day(-45) });
    await bill(supplierId, "SOON", 2000, { billDate: day(-10), dueDate: day(3) });
    await recordSupplierPayment({ supplierId, amount: 400, method: "CASH", paidAt: day(0) });
    const s = await payablesSummary();
    expect(s).toMatchObject({ owed: 260_000, overdue: 60_000, overdueCount: 1, dueThisWeek: 200_000, credit: 0 });
    expect(s.suppliers[0].buckets).toEqual({ current: 200_000, d30: 0, d60: 60_000, d60plus: 0 });
    const rows = await supplierStatement(supplierId);
    expect(rows.map((r) => [r.label, r.balance])).toEqual([["BILL-00001", 100_000], ["BILL-00002", 300_000], ["PAY-00001", 260_000]]);
  });

  it("managers record bills; only the owner pays or voids them", async () => {
    actAs(await makeUser("MANAGER"));
    expect(await bill(supplierId, "M1", 500)).toMatchObject({ ok: true });
    await expect(recordSupplierPayment({ supplierId, amount: 500, method: "CASH", paidAt: day(0) })).rejects.toThrow();
    const b = await db.supplierBill.findFirstOrThrow();
    await expect(voidSupplierBill(b.id, "mistake")).rejects.toThrow();
  });

  it("flags a bill whose goods value is off from what was received", () => {
    expect(billMismatch({ amount: 1_130_000, vatAmount: 130_000 }, 1_000_000)).toBe(0);
    expect(billMismatch({ amount: 1_130_000, vatAmount: 130_000 }, 1_005_000)).toBe(0); // within 1%
    expect(billMismatch({ amount: 1_230_000, vatAmount: 130_000 }, 1_000_000)).toBe(100_000); // billed Rs 1,000 more
  });
});
