import "server-only";
import { assertMonthOpen, CloseError } from "./month-close";
import type { Prisma, SupplierPayMethod } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { ktmDate } from "./pos";
import { formatPrice } from "./utils";

// Accounts payable: supplier bills (what we owe) and payments (what we paid).
//  - a payment is allocated to bills, oldest due date first unless bills are picked; the rest is credit
//  - new bills use up existing credit automatically (oldest payment first)
//  - nothing is deleted: a wrong bill or payment is voided with a reason, which releases its allocations
//  - bill.paid / payment.unallocated move only by conditional updates; CHECKs in the database keep
//    0 ≤ paid ≤ amount and 0 ≤ unallocated ≤ amount even if code is wrong
// An allocation counts only while its payment isn't voided and its bill isn't void.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class PayablesError extends Error {}

/** Bills and payments dated in a closed month are refused (the database refuses them too). */
async function monthOpen(tx: Tx, when: string | Date, what: string) {
  try { await assertMonthOpen(tx, when, what); } catch (e) { if (e instanceof CloseError) throw new PayablesError(e.message); throw e; }
}

export const billNo = (n: number) => `BILL-${String(n).padStart(5, "0")}`;
export const paymentNo = (n: number) => `PAY-${String(n).padStart(5, "0")}`;
export const PAY_METHOD_LABEL: Record<SupplierPayMethod, string> = { CASH: "Cash", BANK: "Bank transfer", CHEQUE: "Cheque", ESEWA: "eSewa", KHALTI: "Khalti", FONEPAY: "Fonepay" };

/** A Nepal calendar date (YYYY-MM-DD) as a moment: midday in Kathmandu, so it never slips a day in UTC. */
export const nepalDay = (d: string) => new Date(`${d}T12:00:00+05:45`);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
/** Start of today in Nepal: bills due before this are overdue. */
export const todayStart = () => new Date(`${ktmDate()}T00:00:00+05:45`);

/** Move `amount` from a payment onto a bill. Fails (rolls back) rather than overpay anything. */
async function allocate(tx: Tx, paymentId: string, billId: string, amount: number) {
  if (amount <= 0) return;
  const bill = await tx.supplierBill.updateMany({ where: { id: billId, status: "OPEN" }, data: { paid: { increment: amount } } });
  const pay = await tx.supplierPayment.updateMany({ where: { id: paymentId, voidedAt: null, unallocated: { gte: amount } }, data: { unallocated: { decrement: amount } } });
  if (!bill.count || !pay.count) throw new PayablesError("That bill or payment just changed. Refresh and try again.");
  // the CHECK (paid <= amount) has already rejected an overpayment; mark fully paid bills
  await tx.supplierBill.updateMany({ where: { id: billId, status: "OPEN", paid: { equals: tx.supplierBill.fields.amount } }, data: { status: "PAID" } });
  await tx.paymentAllocation.upsert({ where: { paymentId_billId: { paymentId, billId } }, create: { paymentId, billId, amount }, update: { amount: { increment: amount } } });
}

/** Open bills of a supplier with what's still owed, oldest due first; rows locked for this transaction. */
async function openBills(tx: Tx, supplierId: string, only?: string[]) {
  const rows = await tx.$queryRaw<{ id: string; amount: number; paid: number }[]>`
    SELECT "id", "amount", "paid" FROM "SupplierBill"
    WHERE "supplierId" = ${supplierId} AND "status" = 'OPEN'
    ORDER BY "dueDate", "billDate", "number" FOR UPDATE`;
  const list = rows.map((r) => ({ id: r.id, outstanding: r.amount - r.paid }));
  return only ? only.flatMap((id) => list.filter((b) => b.id === id)) : list;
}

/** Use the supplier's unallocated payments against open bills (oldest payment → oldest due bill). */
export async function applyCredit(tx: Tx, supplierId: string) {
  const credits = await tx.$queryRaw<{ id: string; unallocated: number }[]>`
    SELECT "id", "unallocated" FROM "SupplierPayment"
    WHERE "supplierId" = ${supplierId} AND "voidedAt" IS NULL AND "unallocated" > 0
    ORDER BY "paidAt", "number" FOR UPDATE`;
  if (!credits.length) return 0;
  const bills = await openBills(tx, supplierId);
  let used = 0;
  for (const c of credits) {
    let left = c.unallocated;
    for (const b of bills) {
      if (!left) break;
      const n = Math.min(left, b.outstanding);
      if (n <= 0) continue;
      await allocate(tx, c.id, b.id, n);
      b.outstanding -= n; left -= n; used += n;
    }
  }
  return used;
}

export type BillInput = { supplierId: string; reference: string; billDate: string; dueDate?: string; amount: number; vatAmount: number; purchaseOrderId?: string | null; note?: string };

export async function recordBill(tx: Tx, actor: Actor, d: BillInput) {
  const supplier = await tx.supplier.findUnique({ where: { id: d.supplierId }, select: { id: true, name: true, paymentTermsDays: true } });
  if (!supplier) throw new PayablesError("Supplier not found.");
  if (d.purchaseOrderId) {
    const po = await tx.purchaseOrder.findUnique({ where: { id: d.purchaseOrderId }, select: { supplierId: true } });
    if (po?.supplierId !== supplier.id) throw new PayablesError("That purchase order is from another supplier.");
  }
  if (d.vatAmount > d.amount) throw new PayablesError("VAT can't be more than the bill total.");
  await monthOpen(tx, d.billDate, "a bill");
  const billDate = nepalDay(d.billDate);
  const dueDate = d.dueDate ? nepalDay(d.dueDate) : addDays(billDate, supplier.paymentTermsDays);
  if (dueDate < billDate) throw new PayablesError("The due date is before the bill date.");
  const dup = await tx.supplierBill.findUnique({ where: { supplierId_reference: { supplierId: supplier.id, reference: d.reference } }, select: { number: true } });
  if (dup) throw new PayablesError(`Invoice ${d.reference} from ${supplier.name} is already recorded as ${billNo(dup.number)}.`);
  const bill = await tx.supplierBill.create({
    data: { supplierId: supplier.id, reference: d.reference, billDate, dueDate, amount: d.amount, vatAmount: d.vatAmount, purchaseOrderId: d.purchaseOrderId || null, note: d.note || null, createdById: actor.id },
    select: { id: true, number: true },
  });
  const credit = await applyCredit(tx, supplier.id);
  await audit(tx, actor, {
    action: "bill.record", entity: ["SupplierBill", bill.id],
    summary: `${billNo(bill.number)} from ${supplier.name}: invoice ${d.reference}, ${formatPrice(d.amount)} (VAT ${formatPrice(d.vatAmount)}), due ${dueDate.toISOString().slice(0, 10)}${credit ? `; ${formatPrice(credit)} paid from existing credit` : ""}`,
  });
  return { ...bill, creditUsed: credit };
}

export type PaymentInput = { supplierId: string; amount: number; method: SupplierPayMethod; reference?: string; paidAt: string; note?: string; billIds?: string[] };

export async function recordPayment(tx: Tx, actor: Actor, d: PaymentInput) {
  const supplier = await tx.supplier.findUnique({ where: { id: d.supplierId }, select: { id: true, name: true } });
  if (!supplier) throw new PayablesError("Supplier not found.");
  if (d.method !== "CASH" && !d.reference) throw new PayablesError("Enter the cheque, bank or wallet reference.");
  await monthOpen(tx, d.paidAt, "a payment");
  const payment = await tx.supplierPayment.create({
    data: { supplierId: supplier.id, amount: d.amount, unallocated: d.amount, method: d.method, reference: d.reference || null, paidAt: nepalDay(d.paidAt), note: d.note || null, createdById: actor.id },
    select: { id: true, number: true },
  });
  const bills = await openBills(tx, supplier.id, d.billIds?.length ? d.billIds : undefined);
  if (d.billIds?.length && bills.length !== d.billIds.length) throw new PayablesError("One of the chosen bills is already paid or void.");
  let left = d.amount;
  const paidBills: string[] = [];
  for (const b of bills) {
    if (!left) break;
    const n = Math.min(left, b.outstanding);
    if (n <= 0) continue;
    await allocate(tx, payment.id, b.id, n);
    left -= n;
    paidBills.push(b.id);
  }
  await audit(tx, actor, {
    action: "payment.record", entity: ["SupplierPayment", payment.id],
    summary: `${paymentNo(payment.number)} to ${supplier.name}: ${formatPrice(d.amount)} by ${PAY_METHOD_LABEL[d.method]}${d.reference ? ` (${d.reference})` : ""} against ${paidBills.length} bill${paidBills.length === 1 ? "" : "s"}${left ? `; ${formatPrice(left)} kept as credit` : ""}`,
  });
  return { ...payment, credit: left, bills: paidBills.length };
}

/** Undo a payment recorded by mistake: its bills owe again. */
export async function voidPayment(tx: Tx, actor: Actor, id: string, reason: string) {
  const p = await tx.supplierPayment.findUnique({ where: { id }, include: { supplier: { select: { name: true } }, allocations: { include: { bill: { select: { status: true } } } } } });
  if (!p) throw new PayablesError("Payment not found.");
  await monthOpen(tx, p.paidAt, "a payment");
  const res = await tx.supplierPayment.updateMany({ where: { id, voidedAt: null }, data: { voidedAt: new Date(), voidReason: reason, unallocated: 0 } });
  if (!res.count) throw new PayablesError("This payment is already void.");
  for (const a of p.allocations) {
    if (a.bill.status === "VOID") continue; // already released when the bill was voided
    await tx.supplierBill.update({ where: { id: a.billId }, data: { paid: { decrement: a.amount }, status: "OPEN" } });
  }
  await audit(tx, actor, { action: "payment.void", entity: ["SupplierPayment", id], summary: `${paymentNo(p.number)} to ${p.supplier.name} (${formatPrice(p.amount)}) voided — ${reason}` });
}

/** Void a bill entered by mistake. Anything paid on it goes back to the supplier's credit and is re-used. */
export async function voidBill(tx: Tx, actor: Actor, id: string, reason: string) {
  const b = await tx.supplierBill.findUnique({ where: { id }, include: { supplier: { select: { id: true, name: true } }, allocations: { include: { payment: { select: { voidedAt: true } } } } } });
  if (!b) throw new PayablesError("Bill not found.");
  await monthOpen(tx, b.billDate, "a bill");
  const res = await tx.supplierBill.updateMany({ where: { id, status: { not: "VOID" } }, data: { status: "VOID", voidReason: reason, paid: 0 } });
  if (!res.count) throw new PayablesError("This bill is already void.");
  let released = 0;
  for (const a of b.allocations) {
    if (a.payment.voidedAt) continue;
    await tx.supplierPayment.update({ where: { id: a.paymentId }, data: { unallocated: { increment: a.amount } } });
    released += a.amount;
  }
  const reused = released ? await applyCredit(tx, b.supplier.id) : 0;
  await audit(tx, actor, {
    action: "bill.void", entity: ["SupplierBill", id],
    summary: `${billNo(b.number)} from ${b.supplier.name} (invoice ${b.reference}, ${formatPrice(b.amount)}) voided — ${reason}${released ? `; ${formatPrice(released)} paid on it returned to credit${reused ? `, ${formatPrice(reused)} applied to other bills` : ""}` : ""}`,
  });
}

// ---------- Reporting ----------

const AGING = [
  { key: "current", label: "Not yet due", from: -Infinity, to: 0 },
  { key: "d30", label: "1–30 days late", from: 1, to: 30 },
  { key: "d60", label: "31–60 days late", from: 31, to: 60 },
  { key: "d60plus", label: "60+ days late", from: 61, to: Infinity },
] as const;
export const AGING_BUCKETS = AGING.map(({ key, label }) => ({ key, label }));

export async function payablesSummary() {
  const today = todayStart();
  const [bills, credits] = await Promise.all([
    db.supplierBill.findMany({ where: { status: "OPEN" }, include: { supplier: { select: { id: true, name: true } } }, orderBy: [{ dueDate: "asc" }, { number: "asc" }] }),
    db.supplierPayment.groupBy({ by: ["supplierId"], where: { voidedAt: null, unallocated: { gt: 0 } }, _sum: { unallocated: true } }),
  ]);
  const open = bills.map((b) => ({ ...b, outstanding: b.amount - b.paid, daysLate: Math.floor((today.getTime() - b.dueDate.getTime()) / 86_400_000) + 1 }));
  const bySupplier = new Map<string, { id: string; name: string; total: number; buckets: Record<(typeof AGING)[number]["key"], number>; credit: number }>();
  for (const b of open) {
    const s = bySupplier.get(b.supplier.id) ?? { id: b.supplier.id, name: b.supplier.name, total: 0, buckets: { current: 0, d30: 0, d60: 0, d60plus: 0 }, credit: 0 };
    s.total += b.outstanding;
    const bucket = b.dueDate >= today ? "current" : AGING.find((a) => b.daysLate >= a.from && b.daysLate <= a.to)!.key;
    s.buckets[bucket] += b.outstanding;
    bySupplier.set(b.supplier.id, s);
  }
  for (const c of credits) {
    const s = bySupplier.get(c.supplierId);
    if (s) s.credit = c._sum.unallocated ?? 0;
  }
  const week = addDays(today, 7);
  return {
    open,
    suppliers: [...bySupplier.values()].sort((a, b) => b.total - a.total),
    owed: open.reduce((s, b) => s + b.outstanding, 0),
    overdue: open.filter((b) => b.dueDate < today).reduce((s, b) => s + b.outstanding, 0),
    overdueCount: open.filter((b) => b.dueDate < today).length,
    dueThisWeek: open.filter((b) => b.dueDate >= today && b.dueDate < week).reduce((s, b) => s + b.outstanding, 0),
    credit: credits.reduce((s, c) => s + (c._sum.unallocated ?? 0), 0),
  };
}

/** Goods actually received on a PO, at PO cost (no VAT): what the bill's goods value should be close to. */
export async function poReceivedValue(purchaseOrderId: string) {
  const items = await db.purchaseOrderItem.findMany({ where: { purchaseOrderId }, select: { quantityReceived: true, unitCost: true } });
  return items.reduce((s, i) => s + i.quantityReceived * i.unitCost, 0);
}

/** Flag a bill whose goods value (total − VAT) differs from what was received by more than 1% (min Rs. 100). */
export function billMismatch(bill: { amount: number; vatAmount: number }, received: number) {
  const goods = bill.amount - bill.vatAmount;
  const diff = goods - received;
  return Math.abs(diff) > Math.max(10_000, Math.round(received / 100)) ? diff : 0;
}

/** Every bill and payment for one supplier, oldest first, with a running balance of what we owe. */
export async function supplierStatement(supplierId: string) {
  const [bills, payments] = await Promise.all([
    db.supplierBill.findMany({ where: { supplierId }, include: { purchaseOrder: { select: { id: true, number: true } } } }),
    db.supplierPayment.findMany({ where: { supplierId }, include: { allocations: { select: { amount: true, bill: { select: { number: true } } } } } }),
  ]);
  type Row = { kind: "bill" | "payment"; id: string; date: Date; label: string; detail: string; debit: number; credit: number; void: string | null; balance: number; status?: string; outstanding?: number; po?: { id: string; number: number } | null };
  const rows: Row[] = [
    ...bills.map((b) => ({ kind: "bill" as const, id: b.id, date: b.billDate, label: billNo(b.number), detail: `Invoice ${b.reference} · due ${b.dueDate.toISOString().slice(0, 10)}`, debit: b.amount, credit: 0, void: b.status === "VOID" ? b.voidReason : null, balance: 0, status: b.status, outstanding: b.status === "VOID" ? 0 : b.amount - b.paid, po: b.purchaseOrder })),
    ...payments.map((p) => ({ kind: "payment" as const, id: p.id, date: p.paidAt, label: paymentNo(p.number), detail: `${PAY_METHOD_LABEL[p.method]}${p.reference ? ` ${p.reference}` : ""}${p.allocations.length ? ` · for ${p.allocations.map((a) => billNo(a.bill.number)).join(", ")}` : ""}${!p.voidedAt && p.unallocated ? ` · ${formatPrice(p.unallocated)} credit` : ""}`, debit: 0, credit: p.amount, void: p.voidedAt ? p.voidReason : null, balance: 0 })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.kind === "bill" ? -1 : 1));
  let bal = 0;
  for (const r of rows) {
    if (!r.void) bal += r.debit - r.credit;
    r.balance = bal;
  }
  return rows;
}
