import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { splitVat } from "./accounting";
import { formatPrice } from "./utils";

// Till sales commission. A sale belongs to the cashier who rang it, at the shop of their shift. The base is
// the sale value excluding VAT; refunds given this month on that person's sales at that shop come off
// (whenever the sale was). Commission = rate × base, once the month's base at that shop reaches the shop's
// threshold. The shop's own rule wins over the "every shop" rule. Raw SQL compares stored UTC times with
// AT TIME ZONE 'UTC' (gotcha 30b).

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class CommissionError extends Error {}

export type Rule = { storeId: string | null; rateBp: number; threshold: number; active: boolean };
export type CommissionRow = { userId: string; storeId: string; sales: number; orders: number; refunds: number; base: number; rateBp: number; threshold: number; commission: number };

const monthBounds = (month: string) => {
  const from = new Date(`${month}-01T00:00:00+05:45`);
  const to = new Date(from); to.setUTCMonth(to.getUTCMonth() + 1);
  return { from, to };
};

export const ruleFor = (rules: Rule[], storeId: string) => rules.find((r) => r.storeId === storeId) ?? rules.find((r) => r.storeId === null) ?? null;

/** Commission earned in a Nepal month, per person and shop. Optionally only some people. */
export async function commissionsFor(month: string, opts: { userIds?: string[] } = {}): Promise<CommissionRow[]> {
  const { from, to } = monthBounds(month);
  const [rules, sales, refunds] = await Promise.all([
    db.commissionRule.findMany({ select: { storeId: true, rateBp: true, threshold: true, active: true } }),
    db.$queryRaw<{ userId: string; storeId: string; total: bigint; orders: bigint }[]>`
      SELECT o."cashierId" AS "userId", s."storeId", SUM(o."total") AS "total", COUNT(*) AS "orders"
      FROM "Order" o JOIN "Shift" s ON s."id" = o."shiftId"
      WHERE o."channel" = 'STORE' AND o."status" <> 'CANCELLED' AND o."cashierId" IS NOT NULL
        AND o."createdAt" >= (${from}::timestamptz AT TIME ZONE 'UTC') AND o."createdAt" < (${to}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY 1, 2`,
    db.$queryRaw<{ userId: string; storeId: string; total: bigint }[]>`
      SELECT o."cashierId" AS "userId", s."storeId", SUM(r."refundAmount") AS "total"
      FROM "Return" r JOIN "Order" o ON o."id" = r."orderId" JOIN "Shift" s ON s."id" = o."shiftId"
      WHERE o."channel" = 'STORE' AND o."cashierId" IS NOT NULL
        AND r."createdAt" >= (${from}::timestamptz AT TIME ZONE 'UTC') AND r."createdAt" < (${to}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY 1, 2`,
  ]);
  const key = (u: string, s: string) => `${u}|${s}`;
  const rows = new Map<string, CommissionRow>();
  const get = (userId: string, storeId: string) => rows.get(key(userId, storeId)) ?? (rows.set(key(userId, storeId), { userId, storeId, sales: 0, orders: 0, refunds: 0, base: 0, rateBp: 0, threshold: 0, commission: 0 }).get(key(userId, storeId))!);
  for (const s of sales) { const r = get(s.userId, s.storeId); r.sales = splitVat(Number(s.total)).taxable; r.orders = Number(s.orders); }
  for (const f of refunds) get(f.userId, f.storeId).refunds = splitVat(Number(f.total)).taxable;
  const active = rules.filter((r) => r.active);
  return [...rows.values()]
    .filter((r) => !opts.userIds || opts.userIds.includes(r.userId))
    .map((r) => {
      const rule = ruleFor(active, r.storeId);
      const base = Math.max(0, r.sales - r.refunds);
      const commission = rule && base >= rule.threshold ? Math.round((base * rule.rateBp) / 10_000) : 0;
      return { ...r, base, rateBp: rule?.rateBp ?? 0, threshold: rule?.threshold ?? 0, commission };
    });
}

/** Total commission per person for a month (all shops), for payroll. */
export async function commissionByPerson(month: string, userIds?: string[]) {
  const m = new Map<string, number>();
  for (const r of await commissionsFor(month, { userIds })) m.set(r.userId, (m.get(r.userId) ?? 0) + r.commission);
  return m;
}

export async function saveRule(tx: Tx, owner: Actor, d: Rule) {
  if (!(d.rateBp >= 0 && d.rateBp <= 2000)) throw new CommissionError("The rate is between 0% and 20%.");
  if (d.threshold < 0) throw new CommissionError("The target can't be negative.");
  const existing = await tx.commissionRule.findFirst({ where: { storeId: d.storeId } });
  if (existing) await tx.commissionRule.update({ where: { id: existing.id }, data: { rateBp: d.rateBp, threshold: d.threshold, active: d.active } });
  else await tx.commissionRule.create({ data: d });
  const where = d.storeId ? (await tx.store.findUnique({ where: { id: d.storeId }, select: { name: true } }))?.name ?? "a shop" : "every shop";
  await audit(tx, owner, { action: "commission.rule", entity: ["CommissionRule", d.storeId ?? "default"], summary: `Commission for ${where}: ${d.rateBp / 100}% of sales excl. VAT${d.threshold ? ` once ${formatPrice(d.threshold)} a month is reached` : ""}${d.active ? "" : " (off)"}`, changes: { ...d } });
}
