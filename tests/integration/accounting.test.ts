import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { accountingSummary, periodBounds, purchaseRegister, returnsRegister, salesRegister, splitVat } from "@/lib/accounting";
import { profitAndLoss } from "@/lib/finance";
import { recordSupplierBill, voidSupplierBill } from "@/actions/admin/payables";
import { GET } from "@/app/admin/(staff)/finance/export/[register]/route";
import { ktmDate } from "@/lib/pos";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";

const today = ktmDate();
const period = { from: today, to: today };

async function order(p: Awaited<ReturnType<typeof makeProduct>>, o: { qty: number; status?: "DELIVERED" | "CANCELLED" | "RETURNED"; discount?: number; points?: number; shipping?: number; channel?: "ONLINE" | "STORE" }) {
  const subtotal = p.price * o.qty;
  const total = subtotal - (o.discount ?? 0) - (o.points ?? 0) + (o.shipping ?? 0);
  return db.order.create({
    data: {
      email: "a@test.local", phone: "9841234567", status: o.status ?? "DELIVERED", paymentMethod: o.channel === "STORE" ? "IN_STORE" : "COD", channel: o.channel ?? "ONLINE",
      subtotal, discount: o.discount ?? 0, pointsDiscount: o.points ?? 0, shippingFee: o.shipping ?? 0, total, shippingMethod: "standard", shippingAddress: { fullName: "Maya Gurung" },
      items: { create: { variantId: p.variants[0].id, productId: p.id, name: p.name, slug: p.slug, sku: p.variants[0].sku, color: "White", size: "M", image: "", unitPrice: p.price, quantity: o.qty, unitCost: 50_000 } },
    },
    include: { items: true },
  });
}

describe("accounting export", () => {
  beforeEach(async () => {
    await resetDb();
    actAs(await makeUser("ADMIN"));
  });

  it("splits VAT out of VAT-inclusive amounts, to the paisa", () => {
    expect(splitVat(113_000)).toEqual({ taxable: 100_000, vat: 13_000 });
    expect(splitVat(99_900)).toEqual({ taxable: 88_407, vat: 11_493 });
    const { taxable, vat } = splitVat(123_457);
    expect(taxable + vat).toBe(123_457);
  });

  it("sales − returns ties out exactly to the P&L's net sales + delivery income", async () => {
    const p = await makeProduct({ price: 1500 });
    await order(p, { qty: 2, discount: 20_000, points: 5_000, shipping: 10_000 });
    await order(p, { qty: 1, channel: "STORE" });
    await order(p, { qty: 3, status: "CANCELLED" }); // never a sale
    await order(p, { qty: 1, status: "RETURNED" }); // online order that came back whole
    const partly = await order(p, { qty: 2 });
    await db.return.create({ data: { orderId: partly.id, processedById: "x", reason: "Size", refundMethod: "CASH", refundAmount: 150_000, items: { create: { orderItemId: partly.items[0].id, quantity: 1, condition: "RESELLABLE", amount: 150_000 } } } });

    const sales = await salesRegister(period);
    expect(sales.map((s) => s.channel)).toEqual(["Online", "Store", "Online", "Online"]);
    expect(sales[0]).toMatchObject({ customer: "Maya Gurung", goods: 300_000, discount: 25_000, delivery: 10_000, total: 285_000, ...splitVat(285_000) });
    const returns = await returnsRegister(period);
    expect(returns.map((r) => [r.note.startsWith("RET-") ? "online" : "store", r.amount])).toEqual(expect.arrayContaining([["store", 150_000], ["online", 150_000]]));

    const { start, end } = periodBounds(period);
    const pl = await profitAndLoss(start, end, period.from, ktmDate(new Date(end.getTime() + 1000)));
    const s = await accountingSummary(period);
    expect(s.sales.total - s.returns.total).toBe(pl.netSales + pl.deliveryIncome);
    expect(s.vat.output).toBe(s.sales.vat - s.returns.vat);
  });

  it("purchase register: void bills excluded, input VAT counted, bills without supplier PAN flagged", async () => {
    const withPan = await db.supplier.create({ data: { name: "Mill A", pan: "301234567" } });
    const noPan = await db.supplier.create({ data: { name: "Mill B" } });
    await recordSupplierBill({ supplierId: withPan.id, reference: "A1", billDate: today, amount: 11_300, vatAmount: 1_300 });
    await recordSupplierBill({ supplierId: noPan.id, reference: "B1", billDate: today, amount: 5_650, vatAmount: 650 });
    await recordSupplierBill({ supplierId: noPan.id, reference: "B2", billDate: today, amount: 999, vatAmount: 0 });
    const b1 = await db.supplierBill.findFirstOrThrow({ where: { reference: "B1" } });
    await voidSupplierBill(b1.id, "Duplicate");
    const rows = await purchaseRegister(period);
    expect(rows.map((r) => [r.invoice, r.pan, r.taxable, r.vat])).toEqual([["A1", "301234567", 1_000_000, 130_000], ["B2", "", 99_900, 0]]);
    const s = await accountingSummary(period);
    expect(s.vat).toEqual({ output: 0, input: 130_000, payable: -130_000 });
    expect(s.purchases.missingPan).toBe(0); // B2 has no VAT, so no PAN needed
    await expect(db.supplier.update({ where: { id: noPan.id }, data: { pan: "12345" } })).rejects.toThrow(/Supplier_pan_format/);
  });

  it("CSV download: owner only, plain rupee numbers, logged in the activity log", async () => {
    const p = await makeProduct({ price: 1130 });
    await order(p, { qty: 1 });
    const req = (k: string, q = `from=${today}&to=${today}`) => GET(new NextRequest(`http://x/admin/finance/export/${k}?${q}`), { params: Promise.resolve({ register: k }) });

    const res = await req("sales");
    expect(res.headers.get("content-disposition")).toMatch(`asson-sales-${today}_${today}.csv`);
    const lines = (await res.text()).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toMatch(/^Date,Invoice,Customer/);
    expect(lines[1]).toMatch(/,1130\.00,0\.00,0\.00,1130\.00,1000\.00,130\.00$/);
    expect(await db.auditLog.count({ where: { action: "accounting.export" } })).toBe(1);

    expect((await req("nope")).status).toBe(400);
    expect((await req("sales", "from=2026-12-01&to=2026-11-01")).status).toBe(400);
    actAs(await makeUser("MANAGER"));
    expect((await req("sales")).status).toBe(403);
  });
});
