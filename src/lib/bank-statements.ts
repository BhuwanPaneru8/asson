import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { checkDeposit, CashError, depositRef } from "./cash";
import { parseCsv } from "./csv";
import { formatPrice } from "./utils";
import { assertMonthOpen, CloseError } from "./month-close";
import { ktmDate } from "./pos";
import { paymentNo } from "./payables";
import type { ExpenseCategory } from "@prisma/client";

// Bank statements: finance uploads the bank's CSV export; each credit is matched to what explains it, a shop's
// bank deposit (which then counts as checked against the statement) or a courier's COD remittance. Matching
// goes through checkDeposit, so the same rules hold as for a manual check: nobody verifies a deposit they made,
// and a different amount is a dispute that puts the gap back on the shop's cash book. Importing the same file
// twice adds nothing: each line has a unique key.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class StatementError extends Error {}

export type ParsedLine = { date: string; amount: number; description: string; reference: string; row: number };

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** Dates as banks in Nepal export them: 2026-11-05, 05/11/2026, 05-11-2026, 05.11.2026, 05-Nov-2026, 5 Nov 2026. Day first. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let r: RegExpExecArray | null;
  if ((r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s))) [d, m, y] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{1,2})[-\s/]([A-Za-z]{3})[A-Za-z]*[-\s/,]+(\d{2,4})/.exec(s))) [d, m, y] = [+r[1], MONTHS[r[2].toLowerCase()] ?? 0, +r[3]];
  else return null;
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (!m || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** "1,23,456.50", "Rs. 500", "(250.00)", "500 Cr", "500 DR" → paisa (negative for debits/parentheses), or null. */
export function parseMoney(raw: string): number | null {
  let s = raw.trim();
  if (!s || s === "-") return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  if (/\bdr\.?$/i.test(s)) { sign = -1; s = s.replace(/\bdr\.?$/i, ""); }
  s = s.replace(/\bcr\.?$/i, "").replace(/^(npr|rs\.?)\s*/i, "").replace(/,/g, "").trim();
  if (s.startsWith("-")) { sign *= -1; s = s.slice(1); }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return sign * Math.round(Number(s) * 100);
}

const find = (head: string[], ...res: RegExp[]) => { for (const re of res) { const i = head.findIndex((h) => re.test(h)); if (i >= 0) return i; } return -1; };

/** Read a statement CSV: find the header row and the columns by their names, then every transaction line. */
export function parseStatement(text: string) {
  const rows = parseCsv(text);
  const hi = rows.findIndex((r) => r.some((c) => /date/i.test(c)) && r.some((c) => /(debit|credit|withdraw|deposit|amount)/i.test(c)));
  if (hi < 0) throw new StatementError("Couldn't find the header row (it needs a date column and debit/credit or amount columns).");
  const head = rows[hi].map((h) => h.trim().toLowerCase());
  const col = {
    date: find(head, /^(txn|tran|transaction)\.?\s*date/, /^date$/, /^(posting|post)\s*date/, /date/),
    desc: find(head, /narration/, /description/, /particular/, /remark/, /details/),
    ref: find(head, /cheque|chq|instrument/, /ref/),
    debit: find(head, /debit|withdraw|\bdr\b/),
    credit: find(head, /credit|deposit|\bcr\b/),
    amount: find(head, /^amount/),
  };
  if (col.date < 0 || (col.credit < 0 && col.amount < 0)) throw new StatementError("The file needs a date column and a credit (or amount) column.");
  const lines: ParsedLine[] = [], skipped: number[] = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i], get = (c: number) => (c >= 0 ? (r[c] ?? "").trim() : "");
    const date = parseDate(get(col.date));
    if (!date) { if (r.some((c) => c.trim())) skipped.push(i + 1); continue; } // totals, opening balance, footers
    let amount: number | null = null;
    const cr = col.credit >= 0 ? parseMoney(get(col.credit)) : null, dr = col.debit >= 0 ? parseMoney(get(col.debit)) : null;
    if (cr) amount = Math.abs(cr);
    else if (dr) amount = -Math.abs(dr);
    else if (col.amount >= 0) amount = parseMoney(get(col.amount));
    if (!amount) { skipped.push(i + 1); continue; }
    lines.push({ date, amount, description: get(col.desc).slice(0, 300), reference: get(col.ref).slice(0, 80), row: i + 1 });
  }
  return { lines, skipped, columns: Object.fromEntries(Object.entries(col).map(([k, v]) => [k, v >= 0 ? rows[hi][v] : null])) };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** The account finance named ("NIC Asia current") and the bank a shop typed ("NIC Asia"): one contains the other.
 *  No looser rule: "Nepal Bank" and "Nepal Investment" must never match. */
const sameBank = (account: string, bank: string) => { const a = norm(account), b = norm(bank); return !!a && !!b && (a.includes(b) || b.includes(a)); };
/** A cheque/transfer reference appears in the narration: its digits (4+) or the whole of it, ignoring spaces and words
 *  like "CHQ" ("CHQ 000124" matches "CHQ PAID 000124"). */
const refIn = (ref: string | null, text: string) => { if (!ref) return false; const digits = ref.replace(/\D/g, ""); return digits.length >= 4 ? text.includes(digits) : text.includes(norm(ref)); };
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/** Store the lines (new ones only), then match what can be matched. */
export async function importStatement(tx: Tx, finance: Actor, account: string, lines: ParsedLine[]) {
  const acct = account.trim();
  if (acct.length < 2) throw new StatementError("Name the bank account, e.g. NIC Asia current.");
  if (!lines.length) throw new StatementError("No transactions found in the file.");
  if (lines.length > 20_000) throw new StatementError("Up to 20,000 lines per file.");
  const seen = new Map<string, number>();
  const data = lines.map((l) => {
    const base = [acct.toLowerCase(), l.date, l.amount, l.description, l.reference].join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { account: acct, date: l.date, amount: l.amount, description: l.description, reference: l.reference, key: createHash("sha256").update(`${base}|${n}`).digest("hex"), status: "UNMATCHED" as const, importedById: finance.id };
  });
  const r = await tx.statementLine.createMany({ data, skipDuplicates: true });
  const matched = await autoMatch(tx, finance, acct);
  await audit(tx, finance, { action: "bank.import", entity: ["StatementLine", acct], summary: `Statement ${acct}: ${r.count} new line(s) of ${lines.length}, ${matched.deposits + matched.remittances + matched.payments + matched.expenses + matched.vat} matched` });
  return { added: r.count, duplicates: lines.length - r.count, ...matched };
}

async function lockLine(tx: Tx, id: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "StatementLine" WHERE "id" = ${id} FOR UPDATE`;
  if (!row) throw new StatementError("Statement line not found.");
  return tx.statementLine.findUniqueOrThrow({ where: { id } });
}

/** Tie a credit to a shop deposit: the deposit is checked with the bank's amount (a difference is a dispute). */
async function matchDeposit(tx: Tx, finance: Actor, lineId: string, depositId: string) {
  const line = await lockLine(tx, lineId);
  if (line.status !== "UNMATCHED") throw new StatementError("That line is already dealt with.");
  const dep = await tx.bankDeposit.findUnique({ where: { id: depositId } });
  if (!dep) throw new StatementError("Deposit not found.");
  await checkDeposit(tx, finance, depositId, { bankAmount: line.amount, note: line.amount === dep.amount ? `On ${line.account} statement ${line.date}` : `${line.account} statement ${line.date} shows ${formatPrice(line.amount)}` });
  await tx.statementLine.update({ where: { id: lineId }, data: { status: "MATCHED", depositId, matchedById: finance.id, matchedAt: new Date() } });
}

async function matchRemittance(tx: Tx, finance: Actor, lineId: string, remittanceId: string) {
  const line = await lockLine(tx, lineId);
  if (line.status !== "UNMATCHED") throw new StatementError("That line is already dealt with.");
  const rem = await tx.codRemittance.findUnique({ where: { id: remittanceId }, include: { statementLine: { select: { id: true } } } });
  if (!rem) throw new StatementError("Remittance not found.");
  if (rem.statementLine) throw new StatementError("That remittance is already matched to another line.");
  if (rem.received !== line.amount) throw new StatementError(`The courier remittance was recorded as ${formatPrice(rem.received)}; the bank shows ${formatPrice(line.amount)}. Correct the remittance first.`);
  await tx.statementLine.update({ where: { id: lineId }, data: { status: "MATCHED", remittanceId, matchedById: finance.id, matchedAt: new Date() } });
  await audit(tx, finance, { action: "bank.match.cod", entity: ["CodRemittance", remittanceId], summary: `${rem.carrier} COD remittance ${formatPrice(rem.received)} (${rem.reference}) seen on ${line.account} ${line.date}` });
}

/** Tie a debit to a supplier payment made by bank, cheque or wallet (same amount; not void; not already matched). */
async function matchPayment(tx: Tx, finance: Actor, lineId: string, paymentId: string) {
  const line = await lockLine(tx, lineId);
  if (line.status !== "UNMATCHED") throw new StatementError("That line is already dealt with.");
  if (line.amount > 0) throw new StatementError("Money in can't be a supplier payment.");
  const p = await tx.supplierPayment.findUnique({ where: { id: paymentId }, include: { statementLine: { select: { id: true } }, supplier: { select: { name: true } } } });
  if (!p || p.voidedAt) throw new StatementError("Payment not found (or void).");
  if (p.statementLine) throw new StatementError("That payment is already matched to another line.");
  if (p.method === "CASH") throw new StatementError("That payment was in cash: it can't be on the bank statement.");
  if (p.amount !== -line.amount) throw new StatementError(`${paymentNo(p.number)} was recorded as ${formatPrice(p.amount)}; the bank shows ${formatPrice(-line.amount)}. Void and re-record the payment first.`);
  await tx.statementLine.update({ where: { id: lineId }, data: { status: "MATCHED", paymentId, matchedById: finance.id, matchedAt: new Date() } });
  await audit(tx, finance, { action: "bank.match.payment", entity: ["SupplierPayment", paymentId], summary: `${paymentNo(p.number)} to ${p.supplier.name} ${formatPrice(p.amount)} seen on ${line.account} ${line.date}` });
}

/** Tie a debit to an expense already recorded as paid by bank (rent by transfer, a bill paid online). */
async function matchExpense(tx: Tx, finance: Actor, lineId: string, expenseId: string) {
  const line = await lockLine(tx, lineId);
  if (line.status !== "UNMATCHED") throw new StatementError("That line is already dealt with.");
  if (line.amount > 0) throw new StatementError("Money in can't be an expense.");
  const e = await tx.expense.findUnique({ where: { id: expenseId }, include: { statementLine: { select: { id: true } } } });
  if (!e) throw new StatementError("Expense not found.");
  if (e.statementLine) throw new StatementError("That expense is already matched to another line.");
  if (e.amount !== -line.amount) throw new StatementError(`The expense is ${formatPrice(e.amount)}; the bank shows ${formatPrice(-line.amount)}.`);
  await tx.statementLine.update({ where: { id: lineId }, data: { status: "MATCHED", expenseId, matchedById: finance.id, matchedAt: new Date() } });
}

/** A debit nobody recorded (bank charges, a utility paid by standing order): book it as an expense from the line. */
async function bookExpense(tx: Tx, finance: Actor, lineId: string, d: { category: ExpenseCategory; description: string; storeId?: string | null }) {
  const line = await lockLine(tx, lineId);
  if (line.status !== "UNMATCHED") throw new StatementError("That line is already dealt with.");
  if (line.amount > 0) throw new StatementError("Money in can't be booked as an expense.");
  if (d.category === "SALARIES") throw new StatementError("Salaries are booked by payroll: explain the salary batch in words instead.");
  if (d.description.trim().length < 3) throw new StatementError("Say what it was.");
  await assertMonthOpen(tx, line.date, "an expense");
  const e = await tx.expense.create({ data: { date: line.date, category: d.category, amount: -line.amount, storeId: d.storeId || null, description: `${d.description.trim().slice(0, 150)} (from ${line.account} statement)`, paidVia: "Bank", source: `statement:${line.id}`, createdById: finance.id } });
  await tx.statementLine.update({ where: { id: lineId }, data: { status: "MATCHED", expenseId: e.id, matchedById: finance.id, matchedAt: new Date() } });
  await audit(tx, finance, { action: "bank.expense", entity: ["Expense", e.id], summary: `Booked ${formatPrice(e.amount)} ${d.category.toLowerCase()} from ${line.account} ${line.date}: ${d.description.trim().slice(0, 100)}` });
}

/** Tie a debit to a filed VAT return's payment (records the payment from the line if it wasn't yet). */
async function matchVat(tx: Tx, finance: Actor, lineId: string, vatReturnId: string) {
  const line = await lockLine(tx, lineId);
  if (line.status !== "UNMATCHED") throw new StatementError("That line is already dealt with.");
  if (line.amount > 0) throw new StatementError("Money in can't be a VAT payment.");
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "VatReturn" WHERE "id" = ${vatReturnId} FOR UPDATE`;
  if (!row) throw new StatementError("VAT return not found.");
  const v = await tx.vatReturn.findUniqueOrThrow({ where: { id: vatReturnId }, include: { statementLine: { select: { id: true } } } });
  if (v.status !== "FILED") throw new StatementError("That return isn't filed.");
  if (v.statementLine) throw new StatementError("That VAT payment is already matched to another line.");
  const due = v.paidAmount ?? v.payable;
  if (due !== -line.amount) throw new StatementError(`${v.label} ${v.paidAmount ? "was paid as" : "has payable"} ${formatPrice(due)}; the bank shows ${formatPrice(-line.amount)}.`);
  if (!v.paidOn) await tx.vatReturn.update({ where: { id: v.id }, data: { paidOn: line.date, paidAmount: -line.amount, paidRef: (line.reference || line.description).slice(0, 80) } });
  await tx.statementLine.update({ where: { id: lineId }, data: { status: "MATCHED", vatReturnId: v.id, matchedById: finance.id, matchedAt: new Date() } });
  await audit(tx, finance, { action: "bank.match.vat", entity: ["VatReturn", v.id], summary: `VAT ${v.label} payment ${formatPrice(-line.amount)} seen on ${line.account} ${line.date}` });
}

const cashPaid = (via: string | null) => !!via && /^(cash|petty)/i.test(via.trim());

/**
 * Match every unmatched credit that has exactly one explanation: a recorded deposit at a bank like this account,
 * same amount, deposited 0–4 days before the statement date (a slip number in the narration settles a tie);
 * or a courier remittance of the same amount within 7 days (its reference or the courier's name settles a tie).
 * Deposits the importer made are left for someone else.
 */
export async function autoMatch(tx: Tx, finance: Actor, account?: string) {
  const lines = await tx.statementLine.findMany({ where: { status: "UNMATCHED", ...(account ? { account } : {}) }, orderBy: [{ date: "asc" }, { id: "asc" }], take: 5000 });
  if (!lines.length) return { deposits: 0, remittances: 0, payments: 0, expenses: 0, vat: 0, leftForOthers: 0 };
  const dates = lines.map((l) => l.date).sort();
  const since = new Date(Date.parse(`${dates[0]}T00:00:00Z`) - 10 * 86_400_000);
  const [deposits, remittances, payments, expenseRows, vats] = await Promise.all([
    tx.bankDeposit.findMany({ where: { status: "RECORDED" } }),
    tx.codRemittance.findMany({ where: { statementLine: null } }),
    tx.supplierPayment.findMany({ where: { statementLine: null, voidedAt: null, method: { not: "CASH" }, paidAt: { gte: since } } }),
    tx.expense.findMany({ where: { statementLine: null, date: { gte: since.toISOString().slice(0, 10) }, amount: { gt: 0 }, OR: [{ source: null }, { AND: [{ NOT: { source: { startsWith: "payroll:" } } }, { NOT: { source: { startsWith: "petty:" } } }] }] } }),
    tx.vatReturn.findMany({ where: { status: "FILED", statementLine: null, payable: { gt: 0 } } }),
  ]);
  const expenses = expenseRows.filter((e) => !cashPaid(e.paidVia));
  const usedD = new Set<string>(), usedR = new Set<string>(), usedP = new Set<string>(), usedE = new Set<string>(), usedV = new Set<string>();
  let nD = 0, nR = 0, nP = 0, nE = 0, nV = 0, left = 0;
  for (const l of lines) {
    const text = norm(`${l.description} ${l.reference}`);
    if (l.amount < 0) {
      // a filed VAT return's payment: its amount, within 45 days after the period ends
      const vc = vats.filter((v) => !usedV.has(v.id) && (v.paidAmount ?? v.payable) === -l.amount && dayDiff(l.date, v.to) > 0 && dayDiff(l.date, v.to) <= 45);
      if (vc.length === 1) { usedV.add(vc[0].id); await matchVat(tx, finance, l.id, vc[0].id); nV++; continue; }
      // a supplier payment by bank/cheque/wallet of that amount, paid 0–5 days before the bank shows it (cheques clear late);
      // else an expense paid by bank of that amount within 5 days. The reference settles a tie.
      let pc = payments.filter((p) => !usedP.has(p.id) && p.amount === -l.amount && dayDiff(l.date, ktmDate(p.paidAt)) >= 0 && dayDiff(l.date, ktmDate(p.paidAt)) <= 5);
      if (pc.length > 1) { const byRef = pc.filter((p) => refIn(p.reference, text)); if (byRef.length) pc = byRef; }
      if (pc.length === 1) { usedP.add(pc[0].id); await matchPayment(tx, finance, l.id, pc[0].id); nP++; continue; }
      const ec = expenses.filter((e) => !usedE.has(e.id) && e.amount === -l.amount && Math.abs(dayDiff(l.date, e.date)) <= 5);
      if (ec.length === 1) { usedE.add(ec[0].id); await matchExpense(tx, finance, l.id, ec[0].id); nE++; }
      continue;
    }
    let cands = deposits.filter((d) => !usedD.has(d.id) && d.amount === l.amount && sameBank(l.account, d.bank) && dayDiff(l.date, d.depositedOn) >= 0 && dayDiff(l.date, d.depositedOn) <= 4);
    if (cands.length > 1) { const bySlip = cands.filter((d) => text.includes(norm(d.slipNo))); if (bySlip.length) cands = bySlip; }
    if (cands.length === 1) {
      const d = cands[0];
      usedD.add(d.id);
      if (d.byId === finance.id) { left++; continue; }
      await matchDeposit(tx, finance, l.id, d.id);
      nD++;
      continue;
    }
    let rc = remittances.filter((r) => !usedR.has(r.id) && r.received === l.amount && Math.abs(dayDiff(l.date, r.createdAt.toISOString().slice(0, 10))) <= 7);
    if (rc.length > 1) { const byRef = rc.filter((r) => (r.reference && text.includes(norm(r.reference))) || text.includes(norm(r.carrier))); if (byRef.length) rc = byRef; }
    if (rc.length === 1) { usedR.add(rc[0].id); await matchRemittance(tx, finance, l.id, rc[0].id); nR++; }
  }
  return { deposits: nD, remittances: nR, payments: nP, expenses: nE, vat: nV, leftForOthers: left };
}

/** Finance ties a line by hand (deposit or remittance), or sets it aside with a reason. */
export async function resolveLine(tx: Tx, finance: Actor, lineId: string, d: { depositId?: string; remittanceId?: string; paymentId?: string; expenseId?: string; vatReturnId?: string; book?: { category: ExpenseCategory; description: string; storeId?: string | null }; ignore?: string }) {
  try {
    if (d.depositId) return await matchDeposit(tx, finance, lineId, d.depositId);
    if (d.remittanceId) return await matchRemittance(tx, finance, lineId, d.remittanceId);
    if (d.paymentId) return await matchPayment(tx, finance, lineId, d.paymentId);
    if (d.expenseId) return await matchExpense(tx, finance, lineId, d.expenseId);
    if (d.vatReturnId) return await matchVat(tx, finance, lineId, d.vatReturnId);
    if (d.book) return await bookExpense(tx, finance, lineId, d.book);
  } catch (e) {
    if (e instanceof CashError || e instanceof CloseError) throw new StatementError(e.message);
    throw e;
  }
  const why = d.ignore?.trim() ?? "";
  if (!why) throw new StatementError("Say what this money is (e.g. interest, wallet settlement, owner top-up).");
  const line = await lockLine(tx, lineId);
  if (line.status !== "UNMATCHED") throw new StatementError("That line is already dealt with.");
  await tx.statementLine.update({ where: { id: lineId }, data: { status: "IGNORED", note: why.slice(0, 300), matchedById: finance.id, matchedAt: new Date() } });
  await audit(tx, finance, { action: "bank.ignore", entity: ["StatementLine", lineId], summary: `${line.account} ${line.date} ${formatPrice(line.amount)} set aside: ${why.slice(0, 120)}` });
}

// ---------- reading ----------

/** What finance needs: per account the last statement date and unexplained credits; deposits and remittances the bank hasn't shown. */
export async function reconciliation(now = new Date()) {
  const [accounts, unmatched, pendingDeposits, unseenRemittances, openPayments, openExpenses, openVat] = await Promise.all([
    db.statementLine.groupBy({ by: ["account"], _max: { date: true }, _count: { _all: true } }),
    db.statementLine.findMany({ where: { status: "UNMATCHED" }, orderBy: [{ date: "desc" }], take: 300 }),
    db.bankDeposit.findMany({ where: { status: "RECORDED" }, orderBy: { depositedOn: "asc" }, include: { store: { select: { name: true } } } }),
    db.codRemittance.findMany({ where: { statementLine: null }, orderBy: { createdAt: "asc" }, take: 300 }),
    db.supplierPayment.findMany({ where: { statementLine: null, voidedAt: null, method: { not: "CASH" } }, orderBy: { paidAt: "desc" }, take: 500, include: { supplier: { select: { name: true } } } }),
    db.expense.findMany({ where: { statementLine: null, amount: { gt: 0 }, OR: [{ source: null }, { AND: [{ NOT: { source: { startsWith: "payroll:" } } }, { NOT: { source: { startsWith: "petty:" } } }] }] }, orderBy: { date: "desc" }, take: 500 }),
    db.vatReturn.findMany({ where: { status: "FILED", statementLine: null, payable: { gt: 0 } }, orderBy: { to: "desc" }, take: 12 }),
  ]);
  const lastDate = (bank: string) => accounts.filter((a) => sameBank(a.account, bank)).map((a) => a._max.date ?? "").sort().pop() ?? null;
  const latest = accounts.map((a) => a._max.date ?? "").sort().pop() ?? null;
  return {
    accounts: accounts.map((a) => ({ account: a.account, lastDate: a._max.date, lines: a._count._all })),
    unmatched: unmatched.map((l) => ({
      ...l,
      // likely explanations to pick from: same amount first, then any recorded deposit at that bank within 10 days
      depositOptions: l.amount < 0 ? [] : pendingDeposits.filter((d) => sameBank(l.account, d.bank) && Math.abs(dayDiff(l.date, d.depositedOn)) <= 10).sort((a, b) => Number(b.amount === l.amount) - Number(a.amount === l.amount)).slice(0, 8).map((d) => ({ id: d.id, label: `${depositRef(d.number)} ${d.store.name} ${formatPrice(d.amount)} on ${d.depositedOn}` })),
      remittanceOptions: l.amount > 0 ? unseenRemittances.filter((r) => r.received === l.amount).slice(0, 5).map((r) => ({ id: r.id, label: `${r.carrier} ${formatPrice(r.received)} (${r.reference})` })) : [],
      paymentOptions: l.amount < 0 ? openPayments.filter((p) => Math.abs(dayDiff(l.date, ktmDate(p.paidAt))) <= 15).sort((a, b) => Number(b.amount === -l.amount) - Number(a.amount === -l.amount)).slice(0, 8).map((p) => ({ id: p.id, label: `${paymentNo(p.number)} ${p.supplier.name} ${formatPrice(p.amount)}${p.reference ? ` (${p.reference})` : ""}` })) : [],
      vatOptions: l.amount < 0 ? openVat.map((v) => ({ id: v.id, label: `VAT ${v.label} ${formatPrice(v.paidAmount ?? v.payable)}` })) : [],
      expenseOptions: l.amount < 0 ? openExpenses.filter((e) => e.amount === -l.amount && !cashPaid(e.paidVia) && Math.abs(dayDiff(l.date, e.date)) <= 15).slice(0, 5).map((e) => ({ id: e.id, label: `${e.date} ${e.description} ${formatPrice(e.amount)}` })) : [],
    })),
    // a deposit made 3+ days before the last statement of its bank, still not seen: chase it
    notOnStatement: pendingDeposits.filter((d) => { const ld = lastDate(d.bank); return ld && dayDiff(ld, d.depositedOn) >= 3; }).map((d) => ({ id: d.id, number: d.number, store: d.store.name, amount: d.amount, bank: d.bank, slipNo: d.slipNo, depositedOn: d.depositedOn, lastStatement: lastDate(d.bank) })),
    unseenRemittances: unseenRemittances.filter((r) => latest && dayDiff(latest, r.createdAt.toISOString().slice(0, 10)) >= 3),
    now,
  };
}
