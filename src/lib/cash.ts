import "server-only";
import type { CashKind, ExpenseCategory, Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { store as storeCfg } from "./config";
import { isMediaUrl } from "./media-url";
import { ktmDate } from "./pos";
import { canActAt, requireStoreAccess, scopeFor, type Scope } from "./scope";
import { formatPrice } from "./utils";

// The cash book of each location's safe. Append-only (a trigger blocks UPDATE/DELETE): every movement is an
// entry and the balance is their sum. Tills: a shift's float leaves the safe when it opens and the counted cash
// goes back in when it closes (posted in the same transaction as the shift, once each by `source`). Money out:
// bank deposits (finance checks each against the bank statement; a shortfall goes back on the book, so the shop
// still answers for it) and petty cash (also an expense for that location). Safe counts compare with the book;
// a difference needs a reason. Every movement at a location locks its Store row first, so a count and a deposit
// at the same moment can't both read the same balance.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class CashError extends Error {}

export const KIND_LABEL: Record<CashKind, string> = { OPENING: "Opening balance", FLOAT_OUT: "Till float out", SHIFT_IN: "Shift cash in", DEPOSIT: "Bank deposit", DEPOSIT_FIX: "Deposit correction", PETTY: "Petty cash", COUNT: "Safe count" };
export const depositRef = (n: number) => `DEP-${n}`;

async function lockStore(tx: Tx, storeId: string) {
  const [s] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Store" WHERE "id" = ${storeId} FOR UPDATE`;
  if (!s) throw new CashError("Location not found.");
}

export async function balanceOf(tx: Tx | typeof db, storeId: string) {
  const r = await tx.cashEntry.aggregate({ where: { storeId }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

async function post(tx: Tx, storeId: string, kind: CashKind, amount: number, by: Actor, note = "", source: string | null = null) {
  return tx.cashEntry.create({ data: { storeId, kind, amount, note: note.slice(0, 300), source, byId: by.id, byName: by.name } });
}

// ---------- tills (called inside the shift's own transaction) ----------

export async function onShiftOpen(tx: Tx, shift: { id: string; storeId: string; openingFloat: number }, by: Actor) {
  if (!shift.openingFloat) return;
  await lockStore(tx, shift.storeId);
  await post(tx, shift.storeId, "FLOAT_OUT", -shift.openingFloat, by, "Float for the till", `shift-open:${shift.id}`);
}

export async function onShiftClose(tx: Tx, shift: { id: string; storeId: string }, counted: number, by: Actor) {
  if (!counted) return;
  await lockStore(tx, shift.storeId);
  await post(tx, shift.storeId, "SHIFT_IN", counted, by, "Counted cash from the till", `shift-close:${shift.id}`);
}

// ---------- the safe ----------

/** Count the safe. The first count starts the book; later ones post any difference (which needs a reason). */
export async function countSafe(tx: Tx, user: Actor, storeId: string, counted: number, note: string) {
  await requireStoreAccess(user, storeId, tx);
  if (!Number.isInteger(counted) || counted < 0) throw new CashError("Enter the cash you counted.");
  await lockStore(tx, storeId);
  const entries = await tx.cashEntry.count({ where: { storeId } });
  if (!entries) {
    if (counted) await post(tx, storeId, "OPENING", counted, user, note || "Cash book started");
    else await post(tx, storeId, "COUNT", 0, user, "Cash book started (empty safe)");
    await audit(tx, user, { action: "cash.open", entity: ["Store", storeId], summary: `Cash book started with ${formatPrice(counted)}` });
    return { difference: 0, balance: counted };
  }
  const book = await balanceOf(tx, storeId);
  const difference = counted - book;
  if (difference && !note.trim()) throw new CashError(`The safe is ${difference > 0 ? "over" : "short"} by ${formatPrice(Math.abs(difference))}. Say why.`);
  await post(tx, storeId, "COUNT", difference, user, difference ? note.trim() : "Matched the book");
  await audit(tx, user, { action: "cash.count", entity: ["Store", storeId], summary: `Safe counted: ${formatPrice(counted)}, book ${formatPrice(book)}${difference ? ` — ${difference > 0 ? "over" : "SHORT"} ${formatPrice(Math.abs(difference))}: ${note.trim().slice(0, 120)}` : " — matched"}` });
  return { difference, balance: counted };
}

/** Cash taken to the bank. Can't be more than the safe holds; a slip number can't be used twice at a bank. */
export async function recordDeposit(tx: Tx, user: Actor, d: { storeId: string; amount: number; bank: string; slipNo: string; slipPhoto?: string | null; depositedOn?: string }) {
  await requireStoreAccess(user, d.storeId, tx);
  if (!Number.isInteger(d.amount) || d.amount <= 0) throw new CashError("Enter the amount deposited.");
  if (!d.bank.trim() || !d.slipNo.trim()) throw new CashError("Enter the bank and the deposit slip number.");
  if (d.slipPhoto && !isMediaUrl(d.slipPhoto)) throw new CashError("Upload the slip with the photo button.");
  const on = d.depositedOn ?? ktmDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || on > ktmDate()) throw new CashError("The deposit date can't be in the future.");
  await lockStore(tx, d.storeId);
  const book = await balanceOf(tx, d.storeId);
  if (d.amount > book) throw new CashError(`The safe only holds ${formatPrice(book)} on the book. Count the safe first if that's wrong.`);
  const dup = await tx.bankDeposit.findUnique({ where: { bank_slipNo: { bank: d.bank.trim(), slipNo: d.slipNo.trim() } }, select: { number: true } });
  if (dup) throw new CashError(`That slip is already recorded (${depositRef(dup.number)}).`);
  const dep = await tx.bankDeposit.create({ data: { storeId: d.storeId, amount: d.amount, bank: d.bank.trim(), slipNo: d.slipNo.trim(), slipPhoto: d.slipPhoto ?? null, depositedOn: on, byId: user.id, byName: user.name } });
  await post(tx, d.storeId, "DEPOSIT", -d.amount, user, `${dep.bank} slip ${dep.slipNo}`, `deposit:${dep.id}`);
  await audit(tx, user, { action: "cash.deposit", entity: ["BankDeposit", dep.id], summary: `${depositRef(dep.number)}: ${formatPrice(d.amount)} to ${dep.bank} (slip ${dep.slipNo})` });
  return dep;
}

/**
 * Finance checks a deposit against the bank statement: confirmed, or the amount the bank actually shows.
 * A difference goes back on the location's book, so the shop still has to account for that cash.
 */
export async function checkDeposit(tx: Tx, finance: Actor, id: string, d: { bankAmount: number; note?: string }, now = new Date()) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "BankDeposit" WHERE "id" = ${id} FOR UPDATE`;
  if (!row) throw new CashError("Deposit not found.");
  const dep = await tx.bankDeposit.findUniqueOrThrow({ where: { id } });
  if (dep.status !== "RECORDED") throw new CashError("Already checked.");
  if (dep.byId === finance.id) throw new CashError("Someone else checks a deposit you made.");
  if (!Number.isInteger(d.bankAmount) || d.bankAmount < 0) throw new CashError("Enter what the bank statement shows.");
  const gap = dep.amount - d.bankAmount;
  if (gap && !d.note?.trim()) throw new CashError("Say what the bank showed.");
  await tx.bankDeposit.update({ where: { id }, data: { status: gap ? "DISPUTED" : "VERIFIED", bankAmount: d.bankAmount, checkNote: d.note?.trim() ?? "", checkedById: finance.id, checkedAt: now } });
  if (gap) {
    await lockStore(tx, dep.storeId);
    await post(tx, dep.storeId, "DEPOSIT_FIX", gap, finance, `${depositRef(dep.number)}: bank shows ${formatPrice(d.bankAmount)}. ${d.note?.trim() ?? ""}`, `deposit-fix:${dep.id}`);
  }
  await audit(tx, finance, { action: "cash.deposit.check", entity: ["BankDeposit", id], summary: `${depositRef(dep.number)} ${gap ? `DISPUTED: recorded ${formatPrice(dep.amount)}, bank ${formatPrice(d.bankAmount)}` : "verified"}` });
}

/** Spend from the safe (small things: tea, cleaning, a courier). Also an expense for the location. */
export async function pettySpend(tx: Tx, user: Actor, d: { storeId: string; amount: number; category: ExpenseCategory; description: string; receipt?: string | null }) {
  await requireStoreAccess(user, d.storeId, tx);
  if (!Number.isInteger(d.amount) || d.amount <= 0) throw new CashError("Enter the amount.");
  if (d.amount > storeCfg.cash.pettyMax) throw new CashError(`Petty cash is for up to ${formatPrice(storeCfg.cash.pettyMax)}. Ask HQ to pay bigger costs.`);
  if (d.category === "SALARIES") throw new CashError("Salaries are paid through payroll.");
  if (d.description.trim().length < 3) throw new CashError("Say what it was for.");
  if (d.receipt && !isMediaUrl(d.receipt)) throw new CashError("Upload the receipt with the photo button.");
  await lockStore(tx, d.storeId);
  const book = await balanceOf(tx, d.storeId);
  if (d.amount > book) throw new CashError(`The safe only holds ${formatPrice(book)} on the book.`);
  const e = await post(tx, d.storeId, "PETTY", -d.amount, user, d.description.trim());
  await tx.expense.create({ data: { date: ktmDate(), category: d.category, amount: d.amount, storeId: d.storeId, description: `${d.description.trim()}${d.receipt ? ` (receipt ${d.receipt})` : ""}`, paidVia: "Petty cash", source: `petty:${e.id}`, createdById: user.id } });
  await audit(tx, user, { action: "cash.petty", entity: ["CashEntry", e.id], summary: `Petty cash ${formatPrice(d.amount)}: ${d.description.trim().slice(0, 100)}` });
}

// ---------- reading ----------

export type CashRow = {
  storeId: string; name: string; kind: string; balance: number; inTills: number; started: boolean;
  lastCountAt: Date | null; lastCountDiff: number | null; lastDepositOn: string | null; pending: number; pendingAmount: number; disputed: number;
  flags: string[];
};

/** Every location's cash: on the book, in open tills, deposits waiting for the bank check, and what needs doing. */
export async function cashPosition(scope: Scope, now = new Date()): Promise<CashRow[]> {
  const ids = scope.all ? null : scope.storeIds;
  const rows = await db.$queryRaw<{ storeId: string; name: string; kind: string; balance: number | null; entries: number; lastCountAt: Date | null; lastCountDiff: number | null; lastDepositOn: string | null; pending: number; pendingAmount: number | null; disputed: number; inTills: number | null }[]>`
    SELECT s."id" AS "storeId", s."name", s."kind"::text AS "kind",
      (SELECT SUM(e."amount") FROM "CashEntry" e WHERE e."storeId" = s."id")::int AS "balance",
      (SELECT COUNT(*) FROM "CashEntry" e WHERE e."storeId" = s."id")::int AS "entries",
      c."createdAt" AS "lastCountAt", c."amount" AS "lastCountDiff",
      (SELECT MAX(d."depositedOn") FROM "BankDeposit" d WHERE d."storeId" = s."id") AS "lastDepositOn",
      (SELECT COUNT(*) FROM "BankDeposit" d WHERE d."storeId" = s."id" AND d."status" = 'RECORDED')::int AS "pending",
      (SELECT SUM(d."amount") FROM "BankDeposit" d WHERE d."storeId" = s."id" AND d."status" = 'RECORDED')::int AS "pendingAmount",
      (SELECT COUNT(*) FROM "BankDeposit" d WHERE d."storeId" = s."id" AND d."status" = 'DISPUTED')::int AS "disputed",
      (SELECT SUM(sh."openingFloat"
          + COALESCE((SELECT SUM(t."amount") FROM "Tender" t JOIN "Order" o ON o."id" = t."orderId" WHERE o."shiftId" = sh."id" AND t."method" = 'CASH'), 0)
          - COALESCE((SELECT SUM(r."refundAmount") FROM "Return" r WHERE r."shiftId" = sh."id" AND r."refundMethod" = 'CASH'), 0))
        FROM "Shift" sh WHERE sh."storeId" = s."id" AND sh."status" = 'OPEN')::int AS "inTills"
    FROM "Store" s
    LEFT JOIN LATERAL (SELECT e."createdAt", CASE WHEN e."kind" = 'OPENING' THEN 0 ELSE e."amount" END AS "amount" FROM "CashEntry" e WHERE e."storeId" = s."id" AND e."kind" IN ('COUNT', 'OPENING') ORDER BY e."createdAt" DESC LIMIT 1) c ON TRUE
    WHERE s."active" AND (${ids}::text[] IS NULL OR s."id" = ANY(${ids}::text[]))
    ORDER BY s."kind", s."name"`;
  const today = ktmDate(now);
  const daysSince = (d: string) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86_400_000);
  return rows.map((r) => {
    const balance = r.balance ?? 0, flags: string[] = [];
    if (r.entries && balance > storeCfg.cash.holdLimit) flags.push(`over the ${formatPrice(storeCfg.cash.holdLimit)} limit: deposit`);
    if (r.entries && balance > 0 && (!r.lastDepositOn || daysSince(r.lastDepositOn) > storeCfg.cash.depositEveryDays)) flags.push(r.lastDepositOn ? `no deposit for ${daysSince(r.lastDepositOn)} days` : "never deposited");
    if (balance < 0) flags.push("book below zero: count the safe");
    if (r.disputed) flags.push(`${r.disputed} deposit${r.disputed > 1 ? "s" : ""} disputed`);
    if (r.lastCountDiff) flags.push(`last count ${r.lastCountDiff > 0 ? "over" : "short"} ${formatPrice(Math.abs(r.lastCountDiff))}`);
    if (!r.entries && r.kind === "SHOP") flags.push("cash book not started: count the safe");
    return { storeId: r.storeId, name: r.name, kind: r.kind, balance, inTills: r.inTills ?? 0, started: r.entries > 0, lastCountAt: r.lastCountAt, lastCountDiff: r.lastCountAt ? r.lastCountDiff : null, lastDepositOn: r.lastDepositOn, pending: r.pending, pendingAmount: r.pendingAmount ?? 0, disputed: r.disputed, flags };
  });
}

/** A location's cash book, newest first, with the running balance after each entry. */
export async function cashBook(user: { id: string; role: string }, storeId: string, take = 100) {
  if (!canActAt(await scopeFor(user), storeId)) return null;
  const [entries, total, deposits] = await Promise.all([
    db.cashEntry.findMany({ where: { storeId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take }),
    balanceOf(db, storeId),
    db.bankDeposit.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  let running = total;
  const rows = entries.map((e) => { const after = running; running -= e.amount; return { ...e, balanceAfter: after }; });
  return { balance: total, entries: rows, deposits };
}

export const depositsToCheck = (take = 100) => db.bankDeposit.findMany({ where: { status: "RECORDED" }, orderBy: { createdAt: "asc" }, take, include: { store: { select: { name: true } } } });
