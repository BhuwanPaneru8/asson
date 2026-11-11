import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { computeVat, createReturn, fileReturn, recordVatPayment, reopenReturn, suggestNextPeriod } from "@/lib/vat";
import { recordBill } from "@/lib/payables";
import { importStatement } from "@/lib/bank-statements";
import { makeProduct, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
const at = (d: string) => new Date(`${d}T12:00:00+05:45`);
const later = new Date("2027-01-01T06:00:00Z"); // "now" for filing: both periods have ended

describe("VAT returns", () => {
  let owner: U, withPan: string, noPan: string, p: Awaited<ReturnType<typeof makeProduct>>;
  beforeEach(async () => {
    await resetDb();
    owner = await makeUser("ADMIN", { name: "Owner" });
    withPan = (await db.supplier.create({ data: { name: "Birgunj Mills", pan: "601234567" } })).id;
    noPan = (await db.supplier.create({ data: { name: "Street Tailor" } })).id;
    p = await makeProduct({ price: 1130 }); // Rs 1,130 incl. 13% VAT = 1,000 + 130
  });

  const sale = (on: string, qty: number) => db.order.create({ data: {
    email: "a@test.local", phone: "9841234567", status: "DELIVERED", paymentMethod: "COD", channel: "ONLINE", subtotal: p.price * qty, total: p.price * qty, shippingMethod: "standard", shippingAddress: {}, createdAt: at(on),
    items: { create: { variantId: p.variants[0].id, productId: p.id, name: p.name, slug: p.slug, sku: p.variants[0].sku, color: "W", size: "M", image: "", unitPrice: p.price, quantity: qty } },
  }, include: { items: true } });

  it("output VAT less returns, input VAT only with a supplier PAN, payable or credit carried, filed in order", async () => {
    // Kartik 2083 ≈ 2026-10-18 … 2026-11-16 (the accountant enters the AD dates)
    await sale("2026-10-20", 10); // VAT 1,300
    const o = await sale("2026-10-25", 2); // VAT 260
    await db.return.create({ data: { orderId: o.id, processedById: owner.id, reason: "size", refundMethod: "CASH", refundAmount: 113_000, createdAt: at("2026-11-01"), items: { create: { orderItemId: o.items[0].id, quantity: 1, condition: "RESELLABLE", amount: 113_000 } } } }); // VAT 130 back
    await db.$transaction((tx) => recordBill(tx, owner, { supplierId: withPan, reference: "B1", billDate: "2026-10-22", amount: 565_000, vatAmount: 65_000 }));
    await db.$transaction((tx) => recordBill(tx, owner, { supplierId: noPan, reference: "T1", billDate: "2026-10-23", amount: 113_000, vatAmount: 13_000 }));

    const v = await computeVat("2026-10-18", "2026-11-16");
    expect(v).toMatchObject({ outputVat: 130_000 + 26_000 - 13_000, inputVat: 65_000, unclaimableVat: 13_000, payable: 143_000 - 65_000, carryForward: 0 });
    expect(v.noPan.map((b) => b.supplier)).toEqual(["Street Tailor"]);

    await expect(db.$transaction((tx) => createReturn(tx, owner, { label: "Kartik 2083", from: "2026-10-18", to: "2026-12-31" }))).rejects.toThrow(/29–32 days/);
    const kartik = await db.$transaction((tx) => createReturn(tx, owner, { label: "Kartik 2083", from: "2026-10-18", to: "2026-11-16" }));
    await expect(db.$transaction((tx) => createReturn(tx, owner, { label: "Overlap", from: "2026-11-10", to: "2026-12-10" }))).rejects.toThrow(/overlaps Kartik/);
    expect(await suggestNextPeriod()).toEqual({ from: "2026-11-17", to: "2026-12-16" });
    // the database refuses an overlap even past the app's check
    await expect(db.vatReturn.create({ data: { label: "x", from: "2026-11-16", to: "2026-12-15", createdById: owner.id } })).rejects.toThrow(/can't overlap/);

    // Mangsir: a big purchase month → credit to carry
    const mangsir = await db.$transaction((tx) => createReturn(tx, owner, { label: "Mangsir 2083", from: "2026-11-17", to: "2026-12-16" }));
    await sale("2026-11-20", 1); // VAT 130
    await db.$transaction((tx) => recordBill(tx, owner, { supplierId: withPan, reference: "B2", billDate: "2026-11-25", amount: 226_000, vatAmount: 26_000 }));
    await expect(db.$transaction((tx) => fileReturn(tx, owner, mangsir.id, "ACK-2", later))).rejects.toThrow(/File Kartik 2083 first/);
    await expect(db.$transaction((tx) => fileReturn(tx, owner, kartik.id, " ", later))).rejects.toThrow(/acknowledgement/);
    await db.$transaction((tx) => fileReturn(tx, owner, kartik.id, "ACK-1", later));
    const m = await db.$transaction((tx) => fileReturn(tx, owner, mangsir.id, "ACK-2", later));
    expect(m).toMatchObject({ outputVat: 13_000, inputVat: 26_000, broughtForward: 0, payable: 0, carryForward: 13_000 });

    // a filed period's bills are locked; reopening the earlier return is refused while a later one is filed
    await expect(db.$transaction((tx) => recordBill(tx, owner, { supplierId: withPan, reference: "LATE", billDate: "2026-10-30", amount: 1130, vatAmount: 130 }))).rejects.toThrow(/filed VAT return/);
    await expect(db.$transaction((tx) => reopenReturn(tx, owner, kartik.id, "late bill"))).rejects.toThrow(/Mangsir 2083 is already filed/);
    await db.$transaction((tx) => reopenReturn(tx, owner, mangsir.id, "late bill"));
    await db.$transaction((tx) => reopenReturn(tx, owner, kartik.id, "late bill"));
    await db.$transaction((tx) => recordBill(tx, owner, { supplierId: withPan, reference: "LATE", billDate: "2026-10-30", amount: 113_000, vatAmount: 13_000 }));
    expect(await db.$transaction((tx) => fileReturn(tx, owner, kartik.id, "ACK-1b", later))).toMatchObject({ inputVat: 78_000, payable: 65_000 });

    // Kartik's payable is paid from the bank: the statement line records it
    await db.$transaction((tx) => importStatement(tx, owner, "NIC Asia current", [{ date: "2026-12-10", amount: -65_000, description: "IRD VAT PAYMENT", reference: "", row: 2 }]));
    const k = await db.vatReturn.findUniqueOrThrow({ where: { id: kartik.id }, include: { statementLine: true } });
    expect(k).toMatchObject({ paidOn: "2026-12-10", paidAmount: 65_000 });
    expect(k.statementLine).not.toBeNull();
    await expect(db.$transaction((tx) => recordVatPayment(tx, owner, kartik.id, { paidOn: "2026-12-11", amount: 1, ref: "" }))).rejects.toThrow(/Already recorded/);
    await expect(db.$transaction((tx) => reopenReturn(tx, owner, kartik.id, "x"))).rejects.toThrow(/paid/);
  });
});
