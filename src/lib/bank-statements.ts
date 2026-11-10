import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { checkDeposit, CashError, depositRef } from "./cash";
import { parseCsv } from "./csv";
import { formatPrice } from "./utils";

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
    return { account: acct, date: l.date, amount: l.amount, description: l.description, reference: l.reference, key: createHash("sha256").update(`${base}|${n}`).digest("hex"), status: (l.amount < 0 ? "DEBIT" : "UNMATCHED") as "DEBIT" | "UNMATCHED", importedById: finance.id };
  });
  const r = await tx.statementLine.createMany({ data, skipDuplicates: true });
  const matched = await autoMatch(tx, finance, acct);
  await audit(tx, finance, { action: "bank.import", entity: ["StatementLine", acct], summary: `Statement ${acct}: ${r.count} new line(s) of ${lines.length}, ${matched.deposits + matched.remittances} matched` });
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

/**
 * Match every unmatched credit that has exactly one explanation: a recorded deposit at a bank like this account,
 * same amount, deposited 0–4 days before the statement date (a slip number in the narration settles a tie);
 * or a courier remittance of the same amount within 7 days (its reference or the courier's name settles a tie).
 * Deposits the importer made are left for someone else.
 */
export async function autoMatch(tx: Tx, finance: Actor, account?: string) {
  const lines = await tx.statementLine.findMany({ where: { status: "UNMATCHED", ...(account ? { account } : {}) }, orderBy: [{ date: "asc" }, { id: "asc" }], take: 5000 });
  if (!lines.length) return { deposits: 0, remittances: 0, leftForOthers: 0 };
  const [deposits, remittances] = await Promise.all([
    tx.bankDeposit.findMany({ where: { status: "RECORDED" } }),
    tx.codRemittance.findMany({ where: { statementLine: null } }),
  ]);
  const usedD = new Set<string>(), usedR = new Set<string>();
  let nD = 0, nR = 0, left = 0;
  for (const l of lines) {
    const text = norm(`${l.description} ${l.reference}`);
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
  return { deposits: nD, remittances: nR, leftForOthers: left };
}

/** Finance ties a line by hand (deposit or remittance), or sets it aside with a reason. */
export async function resolveLine(tx: Tx, finance: Actor, lineId: string, d: { depositId?: string; remittanceId?: string; ignore?: string }) {
  try {
    if (d.depositId) return await matchDeposit(tx, finance, lineId, d.depositId);
    if (d.remittanceId) return await matchRemittance(tx, finance, lineId, d.remittanceId);
  } catch (e) {
    if (e instanceof CashError) throw new StatementError(e.message);
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
  const [accounts, unmatched, pendingDeposits, unseenRemittances] = await Promise.all([
    db.statementLine.groupBy({ by: ["account"], _max: { date: true }, _count: { _all: true } }),
    db.statementLine.findMany({ where: { status: "UNMATCHED" }, orderBy: [{ date: "desc" }], take: 300 }),
    db.bankDeposit.findMany({ where: { status: "RECORDED" }, orderBy: { depositedOn: "asc" }, include: { store: { select: { name: true } } } }),
    db.codRemittance.findMany({ where: { statementLine: null }, orderBy: { createdAt: "asc" }, take: 300 }),
  ]);
  const lastDate = (bank: string) => accounts.filter((a) => sameBank(a.account, bank)).map((a) => a._max.date ?? "").sort().pop() ?? null;
  const latest = accounts.map((a) => a._max.date ?? "").sort().pop() ?? null;
  return {
    accounts: accounts.map((a) => ({ account: a.account, lastDate: a._max.date, lines: a._count._all })),
    unmatched: unmatched.map((l) => ({
      ...l,
      // likely explanations to pick from: same amount first, then any recorded deposit at that bank within 10 days
      depositOptions: pendingDeposits.filter((d) => sameBank(l.account, d.bank) && Math.abs(dayDiff(l.date, d.depositedOn)) <= 10).sort((a, b) => Number(b.amount === l.amount) - Number(a.amount === l.amount)).slice(0, 8).map((d) => ({ id: d.id, label: `${depositRef(d.number)} ${d.store.name} ${formatPrice(d.amount)} on ${d.depositedOn}` })),
      remittanceOptions: unseenRemittances.filter((r) => r.received === l.amount).slice(0, 5).map((r) => ({ id: r.id, label: `${r.carrier} ${formatPrice(r.received)} (${r.reference})` })),
    })),
    // a deposit made 3+ days before the last statement of its bank, still not seen: chase it
    notOnStatement: pendingDeposits.filter((d) => { const ld = lastDate(d.bank); return ld && dayDiff(ld, d.depositedOn) >= 3; }).map((d) => ({ id: d.id, number: d.number, store: d.store.name, amount: d.amount, bank: d.bank, slipNo: d.slipNo, depositedOn: d.depositedOn, lastStatement: lastDate(d.bank) })),
    unseenRemittances: unseenRemittances.filter((r) => latest && dayDiff(latest, r.createdAt.toISOString().slice(0, 10)) >= 3),
    now,
  };
}
