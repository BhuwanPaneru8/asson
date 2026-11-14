import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { purchaseRegister, returnsRegister, salesRegister } from "./accounting";
import { creditNotesIn } from "./payables";
import { ktmDate } from "./pos";
import { formatPrice } from "./utils";

// VAT returns. Each covers the Nepali month the accountant files for, given as AD dates (we don't convert
// calendars: tax dates must be exact, so the accountant sets them). Output VAT = VAT in sales less VAT in returns
// (credit notes) in the period, on the same documents as the Sales and Returns registers: tax invoices and credit
// notes by their numbers (lib/invoices.ts), and sales from before invoicing started by order number. Input VAT counts only
// for bills from suppliers with a PAN (no PAN, no claim); the rest is shown as unclaimable with the bills listed.
// Credit carries forward from the previous filed return. Returns are filed in order; a filed return locks its
// period's purchase bills in the database (bill_vat_lock) until it's reopened with a reason.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class VatError extends Error {}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** First and last document number per series, e.g. "FLAGSHIP-8384-000001 – 000120; WEB-8384-000007 – 000031". */
function span(numbers: string[]) {
  const bySeries = new Map<string, string[]>();
  for (const n of numbers) { const k = n.replace(/\d+$/, ""); bySeries.set(k, [...(bySeries.get(k) ?? []), n]); }
  return [...bySeries.values()].map((ns) => { const sorted = ns.sort(); return sorted.length > 1 ? `${sorted[0]} – ${sorted.at(-1)!.replace(/^.*-/, "")}` : sorted[0]; }).join("; ");
}

/** The figures for a period (not saved). `broughtForward` is the credit left by the previous filed return. */
export async function computeVat(from: string, to: string, broughtForward = 0) {
  if (!DATE.test(from) || !DATE.test(to) || from > to) throw new VatError("Give the period as two dates, start before end.");
  const [sales, returns, purchases, credits] = await Promise.all([salesRegister({ from, to }), returnsRegister({ from, to }), purchaseRegister({ from, to }), creditNotesIn(new Date(`${from}T00:00:00+05:45`), new Date(`${nextDay(to)}T00:00:00+05:45`))]);
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
  const claimable = purchases.filter((p) => p.vat > 0 && p.pan), noPan = purchases.filter((p) => p.vat > 0 && !p.pan);
  const outputVat = sum(sales, (r) => r.vat) - sum(returns, (r) => r.vat);
  // supplier credit notes give back input VAT that was claimed (only on suppliers with a PAN, as for bills)
  const creditVat = sum(credits.filter((c) => c.supplier.pan), (c) => c.vatAmount);
  const inputVat = sum(claimable, (r) => r.vat) - creditVat, unclaimableVat = sum(noPan, (r) => r.vat);
  const net = outputVat - inputVat - broughtForward;
  return {
    // the tax documents behind the figures: invoice and credit-note numbers (older sales: order numbers)
    sales: { count: sales.length, taxable: sum(sales, (r) => r.taxable), vat: sum(sales, (r) => r.vat), documents: span(sales.map((r) => r.invoice)) },
    returns: { count: returns.length, taxable: sum(returns, (r) => r.taxable), vat: sum(returns, (r) => r.vat), documents: span(returns.map((r) => r.note)) },
    purchases: { count: purchases.length, taxable: sum(claimable, (r) => r.taxable), vat: inputVat + creditVat },
    supplierCredits: { count: credits.length, vat: creditVat },
    noPan: noPan.map((p) => ({ bill: p.bill, supplier: p.supplier, invoice: p.invoice, date: p.date, vat: p.vat })),
    outputVat, inputVat, unclaimableVat, broughtForward,
    payable: Math.max(0, net), carryForward: Math.max(0, -net),
  };
}

/** The return just before a period (filed or not): its carry-forward is what this one starts with. */
async function previousFiled(reader: Tx | typeof db, from: string) {
  return reader.vatReturn.findFirst({ where: { to: { lt: from } }, orderBy: { to: "desc" } });
}

/** The dates the next return probably covers: the day after the last one, about a month long (check them). */
export async function suggestNextPeriod() {
  const last = await db.vatReturn.findFirst({ orderBy: { to: "desc" }, select: { to: true } });
  if (!last) return null;
  const from = nextDay(last.to);
  const to = new Date(Date.parse(`${from}T00:00:00Z`) + 29 * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

export async function createReturn(tx: Tx, owner: Actor, d: { label: string; from: string; to: string }) {
  if (d.label.trim().length < 3) throw new VatError("Name the period, e.g. Kartik 2083.");
  if (!DATE.test(d.from) || !DATE.test(d.to) || d.from > d.to) throw new VatError("Give the period as two dates, start before end.");
  const days = (Date.parse(`${d.to}T00:00:00Z`) - Date.parse(`${d.from}T00:00:00Z`)) / 86_400_000 + 1;
  if (days < 28 || days > 33) throw new VatError("A Nepali month is 29–32 days: check the dates.");
  const clash = await tx.vatReturn.findFirst({ where: { from: { lte: d.to }, to: { gte: d.from } }, select: { label: true } });
  if (clash) throw new VatError(`That overlaps ${clash.label}.`);
  const r = await tx.vatReturn.create({ data: { label: d.label.trim(), from: d.from, to: d.to, createdById: owner.id } });
  await audit(tx, owner, { action: "vat.create", entity: ["VatReturn", r.id], summary: `VAT return ${r.label} (${d.from} to ${d.to}) started` });
  return r;
}

async function lockReturn(tx: Tx, id: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "VatReturn" WHERE "id" = ${id} FOR UPDATE`;
  if (!row) throw new VatError("Return not found.");
  return tx.vatReturn.findUniqueOrThrow({ where: { id } });
}

/** File it: the previous return must be filed first (so the credit carried in is final). Figures are frozen. */
export async function fileReturn(tx: Tx, owner: Actor, id: string, ackNo: string, now = new Date()) {
  const r = await lockReturn(tx, id);
  if (r.status === "FILED") throw new VatError("Already filed.");
  if (!ackNo.trim()) throw new VatError("Enter the acknowledgement number from the IRD portal.");
  if (r.to >= ktmDate(now)) throw new VatError("The period hasn't ended yet.");
  const prev = await previousFiled(tx, r.from);
  if (prev && prev.status !== "FILED") throw new VatError(`File ${prev.label} first: its carry-forward goes into this one.`);
  const v = await computeVat(r.from, r.to, prev?.carryForward ?? 0);
  await tx.vatReturn.update({
    where: { id },
    data: {
      status: "FILED", filedAt: now, filedById: owner.id, ackNo: ackNo.trim().slice(0, 60),
      outputVat: v.outputVat, inputVat: v.inputVat, unclaimableVat: v.unclaimableVat, broughtForward: v.broughtForward, payable: v.payable, carryForward: v.carryForward,
      snapshot: { sales: v.sales, returns: v.returns, purchases: v.purchases, noPan: v.noPan } as Prisma.InputJsonValue,
    },
  });
  await audit(tx, owner, { action: "vat.file", entity: ["VatReturn", id], summary: `VAT ${r.label} filed (ack ${ackNo.trim()}): output ${formatPrice(v.outputVat)}, input ${formatPrice(v.inputVat)}, ${v.payable ? `payable ${formatPrice(v.payable)}` : `credit carried ${formatPrice(v.carryForward)}`}` });
  return v;
}

/** Undo a filing to amend it: not once paid, and not when a later return already carried its credit. */
export async function reopenReturn(tx: Tx, owner: Actor, id: string, reason: string) {
  const r = await lockReturn(tx, id);
  if (r.status !== "FILED") throw new VatError("It isn't filed.");
  if (!reason.trim()) throw new VatError("Say why it's being reopened.");
  if (r.paidOn) throw new VatError("It's been paid: amend it with the IRD and record the difference on the next return.");
  const later = await tx.vatReturn.findFirst({ where: { from: { gt: r.to }, status: "FILED" }, select: { label: true } });
  if (later) throw new VatError(`${later.label} is already filed with this return's figures: reopen that first.`);
  await tx.vatReturn.update({ where: { id }, data: { status: "DRAFT", filedAt: null, filedById: null, ackNo: null, reopenReason: reason.trim().slice(0, 300) } });
  await audit(tx, owner, { action: "vat.reopen", entity: ["VatReturn", id], summary: `VAT ${r.label} reopened: ${reason.trim().slice(0, 150)}` });
}

export async function recordVatPayment(tx: Tx, owner: Actor, id: string, d: { paidOn: string; amount: number; ref: string }) {
  const r = await lockReturn(tx, id);
  if (r.status !== "FILED") throw new VatError("File the return before paying it.");
  if (r.paidOn) throw new VatError("Already recorded as paid.");
  if (!r.payable) throw new VatError("Nothing to pay: the return carries credit forward.");
  if (!DATE.test(d.paidOn)) throw new VatError("Enter the payment date.");
  if (!Number.isInteger(d.amount) || d.amount <= 0) throw new VatError("Enter the amount paid.");
  await tx.vatReturn.update({ where: { id }, data: { paidOn: d.paidOn, paidAmount: d.amount, paidRef: d.ref.trim().slice(0, 80) || null } });
  await audit(tx, owner, { action: "vat.pay", entity: ["VatReturn", id], summary: `VAT ${r.label}: ${formatPrice(d.amount)} paid on ${d.paidOn}${d.amount !== r.payable ? ` (payable was ${formatPrice(r.payable)})` : ""}` });
}

/** VAT returns, newest first, each with live figures while still a draft. */
export async function vatOverview() {
  const rows = await db.vatReturn.findMany({ orderBy: { from: "desc" }, take: 24, include: { statementLine: { select: { date: true } } } });
  return Promise.all(rows.map(async (r) => {
    if (r.status === "FILED") return { ...r, live: null };
    const prev = await previousFiled(db, r.from);
    return { ...r, live: await computeVat(r.from, r.to, prev?.status === "FILED" ? prev.carryForward : 0), prevLabel: prev?.label ?? null, prevFiled: !prev || prev.status === "FILED" };
  }));
}
