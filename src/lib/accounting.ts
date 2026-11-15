import "server-only";
import { db } from "./db";
import { store } from "./config";
import { ktmDate } from "./pos";
import { EXPENSE_LABEL } from "./finance";
import { PAY_METHOD_LABEL, billNo, paymentNo } from "./payables";
import { formatOrderNumber } from "./utils";
import { invoicingStart } from "./invoices";
import { bsIso, toBs } from "./nepali-calendar";

// Registers for the accountant (sales, sales returns, purchases, supplier payments, expenses) and a
// VAT summary, for any Nepal date range. Sales follow the same rules as Finance → P&L (accrual by order
// date, cancelled orders excluded; returns on the day they come back). Since tax invoices (lib/invoices.ts) the
// sales register lists invoices by issue date and the returns register credit notes, so the two reconcile with
// the P&L except for timing: online orders placed but not yet delivered are in the P&L, not yet invoiced
// (`uninvoiced` in the summary). Before the first invoice:
//   sales register total − returns register total = P&L net sales + delivery income
// All selling prices and delivery fees include VAT (`store.vatPercent`); VAT is split out per document.

export type Period = { from: string; to: string }; // YYYY-MM-DD, both days included

export function periodBounds(p: Period) {
  const start = new Date(`${p.from}T00:00:00+05:45`);
  const end = new Date(new Date(`${p.to}T00:00:00+05:45`).getTime() + 86_400_000);
  return { start, end };
}

/** Split a VAT-inclusive amount (paisa) into taxable value and VAT, rounding VAT to the paisa. */
export function splitVat(inclusive: number, percent: number = store.vatPercent) {
  const vat = Math.round((inclusive * percent) / (100 + percent));
  return { taxable: inclusive - vat, vat };
}

const rs = (paisa: number) => (paisa / 100).toFixed(2); // accountants want plain numbers, not "Rs. 1,234"

type SalesRow = { date: string; dateBs: string; invoice: string; order: string; customer: string; pan: string; channel: string; payment: string; status: string; paid: string; goods: number; discount: number; delivery: number; total: number; taxable: number; vat: number };

const channelOf = (o: { channel: string; pickupStoreId: string | null }) => (o.channel === "STORE" ? "Store" : o.pickupStoreId ? "Online (pickup)" : "Online");

/**
 * Sales register: the tax invoices issued in the period (by issue date: a till sale at once, an online order
 * when delivered or collected), with their invoice numbers. Sales from before invoicing started (no invoices
 * existed yet) stay in under their order numbers, by order date, as before.
 */
export async function salesRegister(p: Period): Promise<SalesRow[]> {
  const { start, end } = periodBounds(p);
  const since = await invoicingStart();
  const orderSelect = { number: true, createdAt: true, channel: true, status: true, paymentMethod: true, paymentStatus: true, subtotal: true, discount: true, pointsDiscount: true, shippingFee: true, total: true, shippingAddress: true, pickupStoreId: true, tenders: { select: { method: true } } } as const;
  const [invoices, legacy] = await Promise.all([
    db.taxInvoice.findMany({ where: { issuedAt: { gte: start, lt: end } }, orderBy: [{ issuedAt: "asc" }, { number: "asc" }], include: { order: { select: orderSelect } }, take: 100_000 }),
    since && since <= start ? [] : db.order.findMany({
      where: { createdAt: { gte: start, lt: since && since < end ? since : end }, status: { not: "CANCELLED" }, invoice: null },
      orderBy: [{ createdAt: "asc" }, { number: "asc" }], select: orderSelect, take: 100_000,
    }),
  ]);
  const legacyPay = (o: (typeof legacy)[number]) => (o.channel === "STORE" ? [...new Set(o.tenders.map((t) => t.method))].join("+") || "IN_STORE" : o.paymentMethod === "COD" ? (o.pickupStoreId ? "PAY_AT_SHOP" : "COD") : o.paymentMethod);
  return [
    ...invoices.map((i) => ({ date: i.dateAd, dateBs: i.dateBs, invoice: i.number, order: formatOrderNumber(i.order.number), customer: i.buyerName, pan: i.buyerPan ?? "", channel: channelOf(i.order), payment: i.paymentMethod, status: i.order.status, paid: i.order.paymentStatus, goods: i.order.subtotal, discount: i.order.discount + i.order.pointsDiscount, delivery: i.order.shippingFee, total: i.total, taxable: i.taxable, vat: i.vat })),
    ...legacy.map((o) => {
      const { taxable, vat } = splitVat(o.total);
      const who = (o.shippingAddress as { fullName?: string } | null)?.fullName || (o.channel === "STORE" ? "Walk-in customer" : "");
      const date = ktmDate(o.createdAt);
      return { date, dateBs: bsOf(date), invoice: formatOrderNumber(o.number), order: formatOrderNumber(o.number), customer: who, pan: "", channel: channelOf(o), payment: legacyPay(o), status: o.status, paid: o.paymentStatus, goods: o.subtotal, discount: o.discount + o.pointsDiscount, delivery: o.shippingFee, total: o.total, taxable, vat };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

/** BS date for a register row, or blank outside the calendar table. */
const bsOf = (ad: string) => { try { return bsIso(toBs(ad)); } catch { return ""; } };

/**
 * Sales returns: the credit notes issued in the period, each against its invoice. Returns of sales from before
 * invoicing started (no invoice to credit) stay in as before: till returns by their R number, whole online
 * returns as RET-<order>.
 */
export async function returnsRegister(p: Period) {
  const { start, end } = periodBounds(p);
  const [notes, storeReturns, fullReturns] = await Promise.all([
    db.creditNote.findMany({ where: { issuedAt: { gte: start, lt: end } }, orderBy: [{ issuedAt: "asc" }, { number: "asc" }], include: { invoice: { select: { number: true } }, return: { select: { refundMethod: true } } } }),
    db.return.findMany({ where: { createdAt: { gte: start, lt: end }, creditNote: null, order: { invoice: null } }, orderBy: { createdAt: "asc" }, select: { number: true, createdAt: true, refundMethod: true, refundAmount: true, reason: true, order: { select: { number: true } } } }),
    // online orders returned through the admin workflow (no store Return rows): the goods value came back
    db.order.findMany({ where: { status: "RETURNED", updatedAt: { gte: start, lt: end }, returns: { none: {} }, invoice: null }, orderBy: { updatedAt: "asc" }, select: { number: true, updatedAt: true, paymentMethod: true, subtotal: true, discount: true, pointsDiscount: true } }),
  ]);
  return [
    ...notes.map((c) => ({ date: c.dateAd, note: c.number, invoice: c.invoice.number, refund: (c.return?.refundMethod as string | undefined) ?? "ORDER_RETURNED", reason: c.reason, amount: c.total, taxable: c.taxable, vat: c.vat })),
    ...storeReturns.map((r) => ({ date: ktmDate(r.createdAt), note: `R${r.number}`, invoice: formatOrderNumber(r.order.number), refund: r.refundMethod as string, reason: r.reason, amount: r.refundAmount, ...splitVat(r.refundAmount) })),
    ...fullReturns.map((o) => {
      const amount = o.subtotal - o.discount - o.pointsDiscount;
      return { date: ktmDate(o.updatedAt), note: `RET-${formatOrderNumber(o.number)}`, invoice: formatOrderNumber(o.number), refund: o.paymentMethod as string, reason: "Online order returned", amount, ...splitVat(amount) };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export async function purchaseRegister(p: Period) {
  const { start, end } = periodBounds(p);
  const bills = await db.supplierBill.findMany({
    where: { status: { not: "VOID" }, billDate: { gte: start, lt: end } },
    orderBy: [{ billDate: "asc" }, { number: "asc" }],
    select: { number: true, billDate: true, dueDate: true, reference: true, amount: true, vatAmount: true, paid: true, status: true, supplier: { select: { name: true, pan: true } }, purchaseOrder: { select: { number: true } } },
  });
  return bills.map((b) => ({ date: ktmDate(b.billDate), bill: billNo(b.number), supplier: b.supplier.name, pan: b.supplier.pan ?? "", invoice: b.reference, taxable: b.amount - b.vatAmount, vat: b.vatAmount, total: b.amount, paid: b.paid, due: ktmDate(b.dueDate), po: b.purchaseOrder ? `PO-${String(b.purchaseOrder.number).padStart(5, "0")}` : "" }));
}

export async function paymentsRegister(p: Period) {
  const { start, end } = periodBounds(p);
  const payments = await db.supplierPayment.findMany({
    where: { voidedAt: null, paidAt: { gte: start, lt: end } },
    orderBy: [{ paidAt: "asc" }, { number: "asc" }],
    select: { number: true, paidAt: true, amount: true, method: true, reference: true, unallocated: true, supplier: { select: { name: true, pan: true } }, allocations: { select: { amount: true, bill: { select: { number: true, reference: true, status: true } } } } },
  });
  return payments.map((x) => ({ date: ktmDate(x.paidAt), payment: paymentNo(x.number), supplier: x.supplier.name, pan: x.supplier.pan ?? "", method: PAY_METHOD_LABEL[x.method], reference: x.reference ?? "", amount: x.amount, bills: x.allocations.filter((a) => a.bill.status !== "VOID").map((a) => `${billNo(a.bill.number)} (${a.bill.reference}) ${rs(a.amount)}`).join("; "), credit: x.unallocated }));
}

export async function expensesRegister(p: Period) {
  const rows = await db.expense.findMany({ where: { date: { gte: p.from, lte: p.to } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  return rows.map((e) => ({ date: e.date, category: EXPENSE_LABEL[e.category], description: e.description, paidVia: e.paidVia ?? "", amount: e.amount }));
}

/** Totals for the period, including the VAT position (output VAT on sales less returns, minus input VAT on supplier bills). */
export async function accountingSummary(p: Period) {
  const { start, end } = periodBounds(p);
  const since = await invoicingStart();
  const [sales, returns, purchases, payments, expenses, uninvoiced] = await Promise.all([salesRegister(p), returnsRegister(p), purchaseRegister(p), paymentsRegister(p), expensesRegister(p),
    // orders placed in the period that aren't invoiced yet (on their way): the timing difference with the P&L
    since ? db.order.aggregate({ where: { createdAt: { gte: since > start ? since : start, lt: end }, status: { not: "CANCELLED" }, invoice: null, total: { gt: 0 } }, _count: { _all: true }, _sum: { total: true } }) : null]);
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
  const outputVat = sum(sales, (r) => r.vat) - sum(returns, (r) => r.vat);
  const inputVat = sum(purchases, (r) => r.vat);
  return {
    sales: { count: sales.length, total: sum(sales, (r) => r.total), taxable: sum(sales, (r) => r.taxable), vat: sum(sales, (r) => r.vat) },
    returns: { count: returns.length, total: sum(returns, (r) => r.amount), taxable: sum(returns, (r) => r.taxable), vat: sum(returns, (r) => r.vat) },
    purchases: { count: purchases.length, total: sum(purchases, (r) => r.total), taxable: sum(purchases, (r) => r.taxable), vat: inputVat, missingPan: purchases.filter((r) => r.vat > 0 && !r.pan).length },
    payments: { count: payments.length, total: sum(payments, (r) => r.amount) },
    expenses: { count: expenses.length, total: sum(expenses, (r) => r.amount) },
    vat: { output: outputVat, input: inputVat, payable: outputVat - inputVat },
    uninvoiced: { count: uninvoiced?._count._all ?? 0, total: uninvoiced?._sum.total ?? 0 },
  };
}

// ---------- CSV layouts (one header row, plain numbers in rupees) ----------

export const REGISTERS = {
  sales: { label: "Sales register", load: salesRegister, header: ["Date", "Invoice", "Customer", "Buyer PAN", "Date (BS)", "Order", "Channel", "Payment", "Status", "Payment status", "Goods", "Discount", "Delivery", "Total (incl. VAT)", "Taxable value", "VAT"], row: (r: Awaited<ReturnType<typeof salesRegister>>[number]) => [r.date, r.invoice, r.customer, r.pan, r.dateBs, r.order, r.channel, r.payment, r.status, r.paid, rs(r.goods), rs(r.discount), rs(r.delivery), rs(r.total), rs(r.taxable), rs(r.vat)] },
  returns: { label: "Sales returns", load: returnsRegister, header: ["Date", "Credit note", "Original invoice", "Refund method", "Reason", "Amount (incl. VAT)", "Taxable value", "VAT"], row: (r: Awaited<ReturnType<typeof returnsRegister>>[number]) => [r.date, r.note, r.invoice, r.refund, r.reason, rs(r.amount), rs(r.taxable), rs(r.vat)] },
  purchases: { label: "Purchase register", load: purchaseRegister, header: ["Bill date", "Bill", "Supplier", "Supplier PAN", "Supplier invoice", "Taxable value", "VAT", "Total", "Paid so far", "Due date", "Purchase order"], row: (r: Awaited<ReturnType<typeof purchaseRegister>>[number]) => [r.date, r.bill, r.supplier, r.pan, r.invoice, rs(r.taxable), rs(r.vat), rs(r.total), rs(r.paid), r.due, r.po] },
  payments: { label: "Supplier payments", load: paymentsRegister, header: ["Date", "Payment", "Supplier", "Supplier PAN", "Method", "Reference", "Amount", "Against bills", "Kept as credit"], row: (r: Awaited<ReturnType<typeof paymentsRegister>>[number]) => [r.date, r.payment, r.supplier, r.pan, r.method, r.reference, rs(r.amount), r.bills, rs(r.credit)] },
  expenses: { label: "Expenses", load: expensesRegister, header: ["Date", "Category", "Description", "Paid via", "Amount"], row: (r: Awaited<ReturnType<typeof expensesRegister>>[number]) => [r.date, r.category, r.description, r.paidVia, rs(r.amount)] },
} as const;
export type RegisterKey = keyof typeof REGISTERS;
