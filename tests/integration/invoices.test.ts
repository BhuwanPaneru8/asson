import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createPosSale, openShift } from "@/actions/pos";
import { processReturn } from "@/actions/returns";
import { printDocument } from "@/actions/admin/invoices";
import { transitionOrder } from "@/lib/orders";
import { issueCreditNote, issueInvoice } from "@/lib/invoices";
import { accountingSummary, returnsRegister, salesRegister, splitVat } from "@/lib/accounting";
import { computeVat } from "@/lib/vat";
import { cbmsProviders, syncCbms, type BillPayload, type ReturnPayload } from "@/lib/cbms";
import { ktmDate } from "@/lib/pos";
import { actAs, makeLocation, makeProduct, makeUser, resetDb } from "../support/db";

const ref = () => `test-${Math.random().toString(36).slice(2, 12)}`;
const today = ktmDate();
const at = (d: string, t = "12:00") => new Date(`${d}T${t}:00+05:45`);

type P = Awaited<ReturnType<typeof makeProduct>>;
/** An online COD order as checkout leaves it, without going through checkout */
const onlineOrder = (p: P, o: { qty?: number; status?: "SHIPPED" | "DELIVERED"; shipping?: number; discount?: number } = {}) => {
  const qty = o.qty ?? 1, subtotal = p.price * qty, shipping = o.shipping ?? 0, discount = o.discount ?? 0;
  return db.order.create({
    data: {
      email: "a@test.local", phone: "9841234567", status: o.status ?? "SHIPPED", paymentMethod: "COD", channel: "ONLINE", subtotal, discount, shippingFee: shipping, total: subtotal - discount + shipping,
      shippingMethod: "standard", shippingAddress: { fullName: "Maya Gurung", line1: "Jhamsikhel", city: "Lalitpur", district: "Lalitpur", state: "Bagmati" },
      items: { create: { variantId: p.variants[0].id, productId: p.id, name: p.name, slug: p.slug, sku: p.variants[0].sku, color: "White", size: "M", image: "", unitPrice: p.price, quantity: qty } },
    },
    include: { items: true },
  });
};

describe("tax invoices", () => {
  beforeEach(resetDb);

  it("a till sale gets a numbered tax invoice with BS and AD dates, seller and buyer PAN, and VAT that matches the register", async () => {
    const p = await makeProduct({ price: 2399, stock: { M: 10 } });
    actAs(await makeUser("ADMIN", { name: "Sita" }));
    await openShift(1000);
    const a = await createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 2 }], discount: null, tenders: [{ method: "CASH", amount: 479_800, tendered: 500_000 }], customer: { name: "Everest Traders", pan: "301234567" } });
    const b = await createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: null, tenders: [{ method: "ESEWA_QR", amount: 239_900, reference: "Q1" }] });
    if (!a.ok || !b.ok) throw new Error("sale failed");
    const [i1, i2] = await db.taxInvoice.findMany({ orderBy: { seq: "asc" } });
    const fy = i1.fiscalYear;
    expect(fy).toMatch(/^\d{4}\/\d{2}$/);
    expect(i1).toMatchObject({ orderId: a.orderId, series: "FLAGSHIP", seq: 1, number: `FLAGSHIP-${fy.slice(2, 4)}${fy.slice(5)}-000001`, dateAd: today, buyerName: "Everest Traders", buyerPan: "301234567", paymentMethod: "Cash", abbreviated: false, total: 479_800, ...splitVat(479_800) });
    expect(i1.dateBs).toMatch(/^20\d\d-\d\d-\d\d$/);
    expect(i2).toMatchObject({ seq: 2, buyerName: "Walk-in customer", buyerPan: null, paymentMethod: "eSewa QR" });
    expect(await db.cbmsSync.count({ where: { status: "QUEUED" } })).toBe(2);

    const sales = await salesRegister({ from: today, to: today });
    expect(sales.map((s) => [s.invoice, s.pan, s.vat])).toEqual([[i1.number, "301234567", i1.vat], [i2.number, "", i2.vat]]);
    // a bad PAN never reaches an invoice
    expect((await createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: null, tenders: [{ method: "CASH", amount: 239_900 }], customer: { pan: "12345" } })).ok).toBe(false);
  });

  it("numbers are gap-free under concurrency, and a sale that rolls back gives its number back", async () => {
    const p = await makeProduct({ price: 1130, stock: { M: 100 } });
    const orders = await Promise.all(Array.from({ length: 25 }, () => onlineOrder(p, { status: "DELIVERED" })));
    // one issuer fails after taking a number: its transaction (and the number) rolls back
    const failing = db.$transaction(async (tx) => { await issueInvoice(tx, orders[0].id); throw new Error("printer jam"); }).catch(() => "rolled back");
    const results = await Promise.all([failing, ...orders.slice(1).map((o) => db.$transaction((tx) => issueInvoice(tx, o.id)))]);
    expect(results[0]).toBe("rolled back");
    await db.$transaction((tx) => issueInvoice(tx, orders[0].id));
    const seqs = (await db.taxInvoice.findMany({ select: { seq: true }, orderBy: { seq: "asc" } })).map((i) => i.seq);
    expect(seqs).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(new Set((await db.taxInvoice.findMany({ select: { series: true } })).map((i) => i.series))).toEqual(new Set(["WEB"]));
    // issuing twice returns the same invoice
    const again = await db.$transaction((tx) => issueInvoice(tx, orders[1].id));
    expect(await db.taxInvoice.count()).toBe(25);
    expect(again?.orderId).toBe(orders[1].id);
  });

  it("each fiscal year starts again at 1, per series", async () => {
    const p = await makeProduct({ price: 1130, stock: { M: 10 } });
    const [a, b, c] = await Promise.all([onlineOrder(p), onlineOrder(p), onlineOrder(p)]);
    const last = await db.$transaction((tx) => issueInvoice(tx, a.id, { now: at("2026-07-16", "23:30") })); // 32 Asar 2083
    const first = await db.$transaction((tx) => issueInvoice(tx, b.id, { now: at("2026-07-17", "00:10") })); // 1 Shrawan 2083
    const second = await db.$transaction((tx) => issueInvoice(tx, c.id, { now: at("2026-07-17", "09:00") }));
    expect([last?.number, last?.dateBs]).toEqual(["WEB-8283-000001", "2083-03-32"]);
    expect([first?.number, first?.dateBs, second?.number]).toEqual(["WEB-8384-000001", "2083-04-01", "WEB-8384-000002"]);
  });

  it("online orders are invoiced when delivered (with the delivery charge); a whole return is a credit note", async () => {
    const p = await makeProduct({ price: 1500, stock: { M: 10 } });
    const owner = await makeUser("ADMIN");
    const o = await onlineOrder(p, { qty: 2, shipping: 10_000, discount: 20_000 });
    expect(await db.taxInvoice.count()).toBe(0);
    await transitionOrder({ orderId: o.id, to: "DELIVERED", actor: "t", actorId: owner.id });
    const inv = await db.taxInvoice.findUniqueOrThrow({ where: { orderId: o.id } });
    expect(inv).toMatchObject({ series: "WEB", total: 290_000, paymentMethod: "Cash on delivery", buyerName: "Maya Gurung", buyerAddress: expect.stringContaining("Jhamsikhel"), issuedById: owner.id, ...splitVat(290_000) });
    const lines = inv.lines as { name: string; amount: number }[];
    expect(lines.map((l) => l.name)).toEqual([expect.stringContaining(p.name), "Delivery charge"]);
    expect(lines.reduce((s, l) => s + l.amount, 0) - inv.discount).toBe(inv.taxable);

    await transitionOrder({ orderId: o.id, to: "RETURN_REQUESTED", actor: "t" });
    await transitionOrder({ orderId: o.id, to: "RETURNED", actor: "t", actorId: owner.id });
    const cn = await db.creditNote.findFirstOrThrow();
    // goods less discount come back; the delivery charge isn't refunded
    expect(cn).toMatchObject({ invoiceId: inv.id, number: expect.stringMatching(/^CN-WEB-\d{4}-000001$/), total: 280_000, ...splitVat(280_000) });
    const returns = await returnsRegister({ from: today, to: today });
    expect(returns).toEqual([expect.objectContaining({ note: cn.number, invoice: inv.number, amount: 280_000 })]);
  });

  it("till returns are credit notes against the invoice, capped at what's left; the VAT return nets them", async () => {
    const p = await makeProduct({ price: 2000, stock: { M: 10 } });
    actAs(await makeUser("ADMIN"));
    await openShift(5000);
    const sale = await createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 3 }], discount: { type: "PERCENT", value: 10, reason: "Promo" }, tenders: [{ method: "CASH", amount: 540_000 }] });
    if (!sale.ok) throw new Error(sale.error);
    const order = await db.order.findUniqueOrThrow({ where: { id: sale.orderId }, include: { items: true, invoice: true } });
    const line = (q: number) => [{ orderItemId: order.items[0].id, quantity: q, condition: "RESELLABLE" as const }];
    const r1 = await processReturn({ clientRef: ref(), orderId: order.id, lines: line(1), reason: "Too small", refundMethod: "CASH" });
    expect(r1).toMatchObject({ ok: true, refund: 180_000 });
    const cn = await db.creditNote.findFirstOrThrow({ include: { return: true } });
    expect(cn).toMatchObject({ invoiceId: order.invoice!.id, series: "FLAGSHIP", total: 180_000, reason: "Too small", ...splitVat(180_000) });
    expect(cn.return?.id).toBe(r1.ok && r1.returnId);

    // never more than the invoice: a direct attempt to over-credit is refused
    await expect(db.$transaction((tx) => issueCreditNote(tx, { orderId: order.id, lines: [{ name: "x", quantity: 1, amount: 360_001 }], reason: "x" }))).rejects.toThrow(/left to credit/);

    const v = await computeVat(today, today);
    expect(v.outputVat).toBe(order.invoice!.vat - cn.vat);
    expect(v.sales.documents).toBe(order.invoice!.number);
    expect(v.returns.documents).toBe(cn.number);
    const s = await accountingSummary({ from: today, to: today });
    expect(s.vat.output).toBe(v.outputVat);
  });

  it("issued documents can't be edited or deleted, even by SQL", async () => {
    const p = await makeProduct({ price: 1130, stock: { M: 5 } });
    const o = await onlineOrder(p);
    const inv = await db.$transaction((tx) => issueInvoice(tx, o.id));
    await expect(db.taxInvoice.update({ where: { id: inv!.id }, data: { buyerName: "Someone else" } })).rejects.toThrow(/can't be changed/);
    await expect(db.taxInvoice.delete({ where: { id: inv!.id } })).rejects.toThrow(/can't be changed/);
    await expect(db.$executeRawUnsafe(`UPDATE "TaxInvoice" SET "total" = 1`)).rejects.toThrow(/can't be changed/);
    const cn = await db.$transaction((tx) => issueCreditNote(tx, { orderId: o.id, lines: [{ name: "x", quantity: 1, amount: 1130_00 }], reason: "x" }));
    await expect(db.creditNote.update({ where: { id: cn!.id }, data: { reason: "y" } })).rejects.toThrow(/can't be changed/);
  });

  it("the first print is the original; reprints are numbered copies, all in the audit trail", async () => {
    const p = await makeProduct({ price: 1130, stock: { M: 5 } });
    const o = await onlineOrder(p);
    const inv = await db.$transaction((tx) => issueInvoice(tx, o.id));
    actAs(await makeUser("STAFF")); // fulfilment staff (orders) may print
    const copies = await Promise.all([1, 2, 3].map(() => printDocument({ kind: "invoice", id: inv!.id })));
    expect(copies.map((c) => (c.ok ? c.copy : -1)).sort()).toEqual([0, 1, 2]);
    expect(await db.auditLog.count({ where: { action: "invoice.print" } })).toBe(1);
    expect((await db.auditLog.findMany({ where: { action: "invoice.reprint" }, orderBy: { at: "asc" } })).map((a) => a.summary)).toEqual(expect.arrayContaining([expect.stringMatching(/Copy of original \(1\)/), expect.stringMatching(/Copy of original \(2\)/)]));
    await expect(db.invoicePrint.deleteMany()).rejects.toThrow(/can't be changed/);
    actAs(await makeUser("CUSTOMER"));
    await expect(printDocument({ kind: "invoice", id: inv!.id })).rejects.toThrow(); // customers are sent away (redirect)
  });

  it("sales from before invoicing started stay in the register under their order numbers", async () => {
    const p = await makeProduct({ price: 1130, stock: { M: 5 } });
    const old = await onlineOrder(p, { status: "DELIVERED" });
    await db.order.update({ where: { id: old.id }, data: { createdAt: at(today, "00:01") } });
    expect((await salesRegister({ from: today, to: today })).map((r) => r.invoice)).toEqual([expect.stringMatching(/^AS/)]);
    await transitionOrder({ orderId: (await onlineOrder(p)).id, to: "DELIVERED", actor: "t" }); // invoicing starts
    const fresh = await onlineOrder(p); // placed after that: not a sale until it's delivered and invoiced
    const rows = await salesRegister({ from: today, to: today });
    expect(rows.map((r) => r.invoice).sort()).toEqual([expect.stringMatching(/^AS/), expect.stringMatching(/^WEB-/)]);
    expect((await accountingSummary({ from: today, to: today })).uninvoiced).toEqual({ count: 1, total: fresh.total });
  });
});

describe("CBMS outbox", () => {
  const sentBills: BillPayload[] = [], sentReturns: ReturnPayload[] = [];
  let billCode = 200;
  beforeEach(async () => {
    await resetDb();
    sentBills.length = 0; sentReturns.length = 0; billCode = 200;
    cbmsProviders.fake = { name: "fake", postBill: async (b) => { sentBills.push(b); return { code: billCode }; }, postReturn: async (b) => { sentReturns.push(b); return { code: 200 }; } };
  });
  afterEach(() => { delete process.env.CBMS_MODE; delete process.env.CBMS_USERNAME; delete process.env.CBMS_PASSWORD; delete process.env.CBMS_SELLER_PAN; });
  const switchOn = () => Object.assign(process.env, { CBMS_MODE: "fake", CBMS_USERNAME: "taxpayer", CBMS_PASSWORD: "pw", CBMS_SELLER_PAN: "609876543" });

  it("is off by default (documents wait), then posts invoices before their credit notes in the IRD's format", async () => {
    const p = await makeProduct({ price: 1130, stock: { M: 5 } });
    const o = await onlineOrder(p, { qty: 2 });
    const inv = await db.$transaction((tx) => issueInvoice(tx, o.id, { buyerPan: "301234567" }));
    const cn = await db.$transaction((tx) => issueCreditNote(tx, { orderId: o.id, lines: [{ name: "Shirt", quantity: 1, amount: 113_000 }], reason: "Defect" }));
    expect(await syncCbms()).toMatchObject({ off: true, sent: 0, waiting: 2 });

    switchOn();
    billCode = 102; // CBMS hiccup: the invoice fails, so its credit note waits
    expect(await syncCbms()).toMatchObject({ sent: 0, failed: 1 });
    expect(sentReturns).toHaveLength(0);
    await db.cbmsSync.updateMany({ where: { invoiceId: inv!.id }, data: { claimedAt: new Date(0) } }); // past the backoff
    billCode = 101; // "already exists" (the first post did land): counts as sent
    expect(await syncCbms()).toMatchObject({ sent: 2, failed: 0 });
    expect(sentBills.at(-1)).toMatchObject({ username: "taxpayer", password: "pw", seller_pan: "609876543", buyer_pan: "301234567", buyer_name: "Maya Gurung", invoice_number: inv!.number, fiscal_year: `${inv!.fiscalYear.slice(0, 4)}.0${inv!.fiscalYear.slice(5)}`, invoice_date: inv!.dateBs.replaceAll("-", "."), total_sales: 2260, taxable_sales_vat: 2000, vat: 260, isrealtime: true });
    expect(sentReturns[0]).toMatchObject({ ref_invoice_number: inv!.number, credit_note_number: cn!.number, reason_for_return: "Defect", total_sales: 1130, taxable_sales_vat: 1000, vat: 130 });
    expect(await db.cbmsSync.count({ where: { status: "SENT" } })).toBe(2);
  });

  it("an invalid model (104) stops retrying; documents posted late aren't real time", async () => {
    const p = await makeProduct({ price: 1130, stock: { M: 5 } });
    const o = await onlineOrder(p);
    await db.$transaction((tx) => issueInvoice(tx, o.id, { now: new Date(Date.now() - 3_600_000) }));
    switchOn();
    billCode = 104;
    await syncCbms();
    const row = await db.cbmsSync.findFirstOrThrow();
    expect(row).toMatchObject({ status: "FAILED", code: "104", attempts: 8, error: expect.stringMatching(/Model invalid/) });
    expect(sentBills[0].isrealtime).toBe(false);
    expect(await syncCbms()).toMatchObject({ sent: 0, failed: 0 });
  });
});

describe("invoice series per location", () => {
  beforeEach(resetDb);
  it("two shops number independently", async () => {
    const p = await makeProduct({ price: 1000, stock: { M: 10 } });
    const pokhara = await makeLocation({ code: "PKR-1" });
    await db.storeStock.create({ data: { storeId: pokhara.id, variantId: p.variants[0].id, quantity: 5 } });
    const a = await makeUser("CASHIER"), b = await makeUser("CASHIER");
    const flagship = await makeLocation({ code: "FLAGSHIP" });
    await db.shift.createMany({ data: [{ storeId: flagship.id, cashierId: a.id, openingFloat: 0 }, { storeId: pokhara.id, cashierId: b.id, openingFloat: 0 }] });
    for (const u of [a, b, a]) {
      actAs(u);
      const r = await createPosSale({ clientRef: ref(), lines: [{ variantId: p.variants[0].id, quantity: 1 }], discount: null, tenders: [{ method: "CASH", amount: 100_000 }] });
      expect(r.ok).toBe(true);
    }
    const rows = await db.taxInvoice.findMany({ orderBy: { issuedAt: "asc" }, select: { series: true, seq: true, storeId: true } });
    expect(rows).toEqual([{ series: "FLAGSHIP", seq: 1, storeId: flagship.id }, { series: "PKR1", seq: 1, storeId: pokhara.id }, { series: "FLAGSHIP", seq: 2, storeId: flagship.id }]);
  });
});
