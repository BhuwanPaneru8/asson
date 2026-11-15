import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { store } from "./config";
import { audit, type AuditActor } from "./audit";
import { ktmDate, TENDER_LABEL } from "./pos";
import { bsIso, fiscalYearOf, toBs } from "./nepali-calendar";
import { documentFigures, type DocLine, type InLine } from "./invoice-math";
import { addressLines, formatOrderNumber, formatPrice } from "./utils";

// Tax invoices and credit notes (docs/Tax-Invoices.md). Issued inside the business transaction that makes the
// sale final: a till sale (createPosSale), an online order delivered or collected (transitionOrder → DELIVERED),
// a till return (processReturn) or an online order returned whole (transitionOrder → RETURNED). Numbers are
// gap-free per fiscal year (Shrawan–Asar) and series (the till's location code, or WEB online), taken from
// InvoiceSeries under a row lock, so a sale that rolls back gives its number back. Issued documents are frozen
// by database triggers; prints are counted ("Copy of original (n)") and audited; every document is queued for
// the IRD's CBMS (lib/cbms.ts).

type Tx = Prisma.TransactionClient;
export class InvoiceError extends Error {}

const PAN = /^\d{9}$/;
export const isPan = (s: string) => PAN.test(s);

/** "2083/84" → "8384" (in document numbers). */
const fyShort = (fy: string) => `${fy.slice(2, 4)}${fy.slice(5, 7)}`;
const seriesCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "MAIN";

/** Take the next number in a series. The row stays locked until the caller's transaction ends. */
async function nextSeq(tx: Tx, fiscalYear: string, series: string, doc: "INV" | "CN") {
  await tx.$executeRaw`INSERT INTO "InvoiceSeries" ("fiscalYear", "series", "doc", "last") VALUES (${fiscalYear}, ${series}, ${doc}, 0) ON CONFLICT DO NOTHING`;
  const [row] = await tx.$queryRaw<{ last: number }[]>`UPDATE "InvoiceSeries" SET "last" = "last" + 1 WHERE "fiscalYear" = ${fiscalYear} AND "series" = ${series} AND "doc" = ${doc} RETURNING "last"`;
  return row.last;
}

function dates(now: Date) {
  const dateAd = ktmDate(now);
  const bs = toBs(dateAd);
  return { dateAd, dateBs: bsIso(bs), fiscalYear: fiscalYearOf(bs) };
}

const seller = (address: string) => ({ sellerName: store.legalName || store.name, sellerAddress: address, sellerPan: store.vatNumber });

type Addr = { fullName?: string; line1?: string; line2?: string | null; city?: string; district?: string; state?: string; postalCode?: string | null };

/**
 * Issue the order's tax invoice (once: a second call returns the first). Free orders (a size exchange's
 * replacement) get none: the original sale's invoice covers the goods. `buyerPan` makes it a full invoice.
 */
export async function issueInvoice(tx: Tx, orderId: string, opts: { actorId?: string | null; buyerPan?: string | null; buyerName?: string | null; full?: boolean; now?: Date } = {}) {
  const existing = await tx.taxInvoice.findUnique({ where: { orderId } });
  if (existing) return existing;
  const o = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, tenders: { select: { method: true } }, shift: { select: { store: { select: { id: true, code: true, address: true } } } } },
  });
  if (o.total <= 0) return null;
  const pan = opts.buyerPan?.trim() || null;
  if (pan && !isPan(pan)) throw new InvoiceError("A PAN is 9 digits.");
  const till = o.channel === "STORE" ? o.shift?.store : null;
  if (o.channel === "STORE" && !till) throw new InvoiceError("A till sale needs its shift's shop for the invoice series.");
  const series = till ? seriesCode(till.code) : seriesCode(store.invoices.onlineSeries);
  const now = opts.now ?? new Date();
  const d = dates(now);
  const seq = await nextSeq(tx, d.fiscalYear, series, "INV");
  const addr = o.shippingAddress as Addr;
  const lines: InLine[] = o.items.map((i) => ({ name: `${i.name} (${i.color}/${i.size})`, sku: i.sku, quantity: i.quantity, amount: i.unitPrice * i.quantity }));
  if (o.shippingFee > 0) lines.push({ name: "Delivery charge", quantity: 1, amount: o.shippingFee });
  const f = documentFigures(lines, o.total, store.vatPercent);
  const methods = [...new Set(o.tenders.map((t) => TENDER_LABEL[t.method]))];
  const paymentMethod = methods.length ? methods.join(" + ") : o.paymentMethod === "COD" ? "Cash on delivery" : o.paymentMethod === "ONLINE" ? (o.paymentProvider === "KHALTI" ? "Khalti" : o.paymentProvider === "ESEWA" ? "eSewa" : "Online payment") : "Cash";
  const buyerName = (opts.buyerName?.trim() || addr?.fullName || "").slice(0, 80) || (till ? "Walk-in customer" : "Customer");
  const abbreviated = !!till && store.invoices.abbreviated && !pan && !opts.full && o.total <= store.invoices.abbreviatedMax;
  const inv = await tx.taxInvoice.create({
    data: {
      number: `${series}-${fyShort(d.fiscalYear)}-${String(seq).padStart(6, "0")}`, fiscalYear: d.fiscalYear, series, seq, abbreviated,
      orderId: o.id, storeId: till?.id ?? null, issuedAt: now, dateAd: d.dateAd, dateBs: d.dateBs,
      ...seller(till?.address || store.storeAddress),
      buyerName, buyerPan: pan, buyerAddress: addressLines(addr as Parameters<typeof addressLines>[0]).join(", ") || null,
      paymentMethod, lines: f.lines as unknown as Prisma.InputJsonValue,
      gross: f.gross, discount: f.discount, taxable: f.taxable, vat: f.vat, total: f.total, issuedById: opts.actorId ?? null,
      cbms: { create: {} },
    },
  });
  return inv;
}

/**
 * Issue a credit note against the order's invoice for `lines` (VAT-inclusive amounts actually refunded).
 * Returns null for orders that never had an invoice (sales from before invoicing started) or nothing to credit.
 */
export async function issueCreditNote(tx: Tx, d: { orderId: string; returnId?: string | null; lines: InLine[]; reason: string; storeId?: string | null; actorId?: string | null; now?: Date }) {
  const amount = d.lines.reduce((s, l) => s + l.amount, 0);
  if (amount <= 0) return null;
  // lock the invoice row (no UPDATE happens, so the immutability trigger isn't touched) so two returns can't both pass the cap
  const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "TaxInvoice" WHERE "orderId" = ${d.orderId} FOR UPDATE`;
  if (!locked) return null;
  const inv = await tx.taxInvoice.findUniqueOrThrow({ where: { id: locked.id }, include: { creditNotes: { select: { total: true } } } });
  const credited = inv.creditNotes.reduce((s, c) => s + c.total, 0);
  if (credited + amount > inv.total) throw new InvoiceError(`Invoice ${inv.number} has only ${formatPrice(inv.total - credited)} left to credit.`);
  const shop = d.storeId ? await tx.store.findUnique({ where: { id: d.storeId }, select: { code: true } }) : null;
  const series = shop ? seriesCode(shop.code) : seriesCode(store.invoices.onlineSeries);
  const now = d.now ?? new Date();
  const dt = dates(now);
  const seq = await nextSeq(tx, dt.fiscalYear, series, "CN");
  const f = documentFigures(d.lines, amount, store.vatPercent);
  return tx.creditNote.create({
    data: {
      number: `CN-${series}-${fyShort(dt.fiscalYear)}-${String(seq).padStart(6, "0")}`, fiscalYear: dt.fiscalYear, series, seq,
      invoiceId: inv.id, returnId: d.returnId ?? null, storeId: d.storeId ?? null, issuedAt: now, dateAd: dt.dateAd, dateBs: dt.dateBs,
      reason: d.reason.trim().slice(0, 200) || "Goods returned", buyerName: inv.buyerName, buyerPan: inv.buyerPan,
      lines: f.lines as unknown as Prisma.InputJsonValue, gross: f.gross, discount: f.discount, taxable: f.taxable, vat: f.vat, total: f.total,
      issuedById: d.actorId ?? null, cbms: { create: {} },
    },
  });
}

/** The rest of an online order that came back whole (less what till returns already credited). */
export async function creditRemainder(tx: Tx, orderId: string, actorId?: string | null) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { returnItems: { select: { quantity: true, amount: true } } } } } });
  const net = o.subtotal - o.discount - o.pointsDiscount; // the delivery charge isn't refunded
  const refunded = o.items.reduce((s, i) => s + i.returnItems.reduce((a, r) => a + r.amount, 0), 0);
  const left = o.items.map((i) => ({ i, qty: i.quantity - i.returnItems.reduce((a, r) => a + r.quantity, 0) })).filter((x) => x.qty > 0);
  const amount = net - refunded;
  if (amount <= 0 || !left.length) return null;
  // share the amount over the lines still out, by their price
  const value = left.reduce((s, x) => s + x.i.unitPrice * x.qty, 0);
  const lines: InLine[] = left.map((x) => ({ name: `${x.i.name} (${x.i.color}/${x.i.size})`, sku: x.i.sku, quantity: x.qty, amount: Math.floor((amount * x.i.unitPrice * x.qty) / value) }));
  lines[0].amount += amount - lines.reduce((s, l) => s + l.amount, 0);
  return issueCreditNote(tx, { orderId, lines, reason: `Order ${formatOrderNumber(o.number)} returned`, actorId });
}

/**
 * Record a print. The first is the original; later ones print "Copy of original (n)". Returns n (0 = original).
 * Every print is in the audit trail (reprints flagged), as the Electronic Billing Procedure asks.
 */
export async function recordPrint(tx: Tx, actor: NonNullable<AuditActor>, doc: { invoiceId: string } | { creditNoteId: string }) {
  const isInvoice = "invoiceId" in doc;
  const id = isInvoice ? doc.invoiceId : doc.creditNoteId;
  const rows = isInvoice
    ? await tx.$queryRaw<{ number: string }[]>`SELECT "number" FROM "TaxInvoice" WHERE "id" = ${id} FOR UPDATE`
    : await tx.$queryRaw<{ number: string }[]>`SELECT "number" FROM "CreditNote" WHERE "id" = ${id} FOR UPDATE`;
  if (!rows.length) throw new InvoiceError("Document not found.");
  const copy = await tx.invoicePrint.count({ where: isInvoice ? { invoiceId: id } : { creditNoteId: id } });
  await tx.invoicePrint.create({ data: { ...(isInvoice ? { invoiceId: id } : { creditNoteId: id }), copy, printedById: actor.id } });
  const what = isInvoice ? "Invoice" : "Credit note";
  await audit(tx, actor, {
    action: copy ? "invoice.reprint" : "invoice.print", entity: [isInvoice ? "TaxInvoice" : "CreditNote", id],
    summary: copy ? `${what} ${rows[0].number} reprinted: Copy of original (${copy})` : `${what} ${rows[0].number} printed (original)`,
    changes: { copy },
  });
  return copy;
}

/** How many times a document has been printed (the next print's copy number). */
export const printCount = (doc: { invoiceId: string } | { creditNoteId: string }) => db.invoicePrint.count({ where: doc });

/** When invoicing started (the first invoice): earlier sales stay in the registers under their order numbers. */
export async function invoicingStart() {
  const first = await db.taxInvoice.findFirst({ orderBy: { issuedAt: "asc" }, select: { issuedAt: true } });
  return first?.issuedAt ?? null;
}

// ---------- Views for printing (server components render them; components/invoices/tax-document.tsx) ----------

export type DocView = {
  kind: "invoice" | "credit"; id: string; number: string; abbreviated: boolean; fiscalYear: string; dateAd: string; dateBs: string; issuedAt: string;
  seller: { name: string; address: string; pan: string }; buyer: { name: string; pan: string | null; address: string | null };
  paymentMethod: string | null; lines: DocLine[]; gross: number; discount: number; taxable: number; vat: number; total: number;
  /** a credit note's invoice */ against: { number: string; dateAd: string; dateBs: string } | null; reason: string | null;
  orderId: string; orderNumber: string; issuedBy: string | null; nextCopy: number;
};

const issuer = async (id: string | null) => (id ? (await db.user.findUnique({ where: { id }, select: { name: true } }))?.name ?? null : null);

export async function invoiceView(where: { id: string } | { orderId: string }): Promise<DocView | null> {
  const i = await db.taxInvoice.findUnique({ where: "id" in where ? { id: where.id } : { orderId: where.orderId }, include: { order: { select: { number: true } }, _count: { select: { prints: true } } } });
  if (!i) return null;
  return {
    kind: "invoice", id: i.id, number: i.number, abbreviated: i.abbreviated, fiscalYear: i.fiscalYear, dateAd: i.dateAd, dateBs: i.dateBs, issuedAt: i.issuedAt.toISOString(),
    seller: { name: i.sellerName, address: i.sellerAddress, pan: i.sellerPan }, buyer: { name: i.buyerName, pan: i.buyerPan, address: i.buyerAddress },
    paymentMethod: i.paymentMethod, lines: i.lines as unknown as DocLine[], gross: i.gross, discount: i.discount, taxable: i.taxable, vat: i.vat, total: i.total,
    against: null, reason: null, orderId: i.orderId, orderNumber: formatOrderNumber(i.order.number), issuedBy: await issuer(i.issuedById), nextCopy: i._count.prints,
  };
}

export async function creditNoteView(where: { id: string } | { returnId: string }): Promise<DocView | null> {
  const c = await db.creditNote.findUnique({ where: "id" in where ? { id: where.id } : { returnId: where.returnId }, include: { invoice: { include: { order: { select: { number: true } } } }, _count: { select: { prints: true } } } });
  if (!c) return null;
  const inv = c.invoice;
  return {
    kind: "credit", id: c.id, number: c.number, abbreviated: false, fiscalYear: c.fiscalYear, dateAd: c.dateAd, dateBs: c.dateBs, issuedAt: c.issuedAt.toISOString(),
    seller: { name: inv.sellerName, address: inv.sellerAddress, pan: inv.sellerPan }, buyer: { name: c.buyerName, pan: c.buyerPan, address: inv.buyerAddress },
    paymentMethod: null, lines: c.lines as unknown as DocLine[], gross: c.gross, discount: c.discount, taxable: c.taxable, vat: c.vat, total: c.total,
    against: { number: inv.number, dateAd: inv.dateAd, dateBs: inv.dateBs }, reason: c.reason, orderId: inv.orderId, orderNumber: formatOrderNumber(inv.order.number), issuedBy: await issuer(c.issuedById), nextCopy: c._count.prints,
  };
}
