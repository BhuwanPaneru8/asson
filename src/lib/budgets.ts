import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { monthBounds } from "./finance";
import { ktmDate } from "./pos";
import { netSalesAt, shopPl, type PlRow } from "./shop-pl";
import { formatPrice } from "./utils";

// Budgets per location: a monthly sales target (same basis as the P&L: net sales incl. VAT), an optional
// gross-margin target and a cost budget. The owner sets them for all shops at once (seeded from the same
// month last year or last month, plus an uplift). The report compares the month's actuals (lib/shop-pl.ts)
// with the plan and, for the month in progress, the pace: where a shop should be by now and where it's heading.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class BudgetError extends Error {}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const shiftMonth = (m: string, by: number) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + by, 1)); return d.toISOString().slice(0, 7); };

export type BudgetInput = { storeId: string; sales: number; marginPm: number | null; costs: number; note?: string };

/** Save the plan for many locations at once (insert or replace each, atomically per row). */
export async function saveBudgets(tx: Tx, owner: Actor, month: string, rows: BudgetInput[]) {
  if (!MONTH.test(month)) throw new BudgetError("Months are YYYY-MM.");
  if (new Set(rows.map((r) => r.storeId)).size !== rows.length) throw new BudgetError("Each location once.");
  for (const r of rows) {
    if (!Number.isInteger(r.sales) || r.sales < 0 || !Number.isInteger(r.costs) || r.costs < 0) throw new BudgetError("Targets and budgets can't be negative.");
    if (r.marginPm !== null && (!Number.isInteger(r.marginPm) || r.marginPm < 0 || r.marginPm > 1000)) throw new BudgetError("Margin target is 0–100%.");
  }
  const known = await tx.store.count({ where: { id: { in: rows.map((r) => r.storeId) } } });
  if (known !== rows.length) throw new BudgetError("Location not found.");
  for (const r of rows) {
    await tx.$executeRaw`INSERT INTO "ShopBudget" ("id", "storeId", "month", "sales", "marginPm", "costs", "note", "updatedById", "updatedAt")
      VALUES (${`sb_${crypto.randomUUID()}`}, ${r.storeId}, ${month}, ${r.sales}, ${r.marginPm}, ${r.costs}, ${(r.note ?? "").slice(0, 300)}, ${owner.id}, NOW())
      ON CONFLICT ("storeId", "month") DO UPDATE SET "sales" = EXCLUDED."sales", "marginPm" = EXCLUDED."marginPm", "costs" = EXCLUDED."costs", "note" = EXCLUDED."note", "updatedById" = EXCLUDED."updatedById", "updatedAt" = NOW()`;
  }
  const total = rows.reduce((a, r) => a + r.sales, 0);
  await audit(tx, owner, { action: "budget.save", entity: ["ShopBudget", month], summary: `Budgets for ${month}: ${rows.length} location(s), sales target ${formatPrice(total)}, costs ${formatPrice(rows.reduce((a, r) => a + r.costs, 0))}` });
}

/**
 * A starting point for a month's plan: each location's actual net sales and costs in the same month last year
 * (or last month), with `upliftPct` added to sales; its last margin as the margin target. Not saved.
 */
export async function suggestBudgets(month: string, from: "lastYear" | "lastMonth", upliftPct: number) {
  if (!MONTH.test(month)) throw new BudgetError("Months are YYYY-MM.");
  const base = from === "lastYear" ? shiftMonth(month, -12) : shiftMonth(month, -1);
  const pl = await shopPl(base);
  return {
    base,
    rows: pl.rows.map((r) => ({
      storeId: r.storeId!, name: r.name,
      sales: Math.max(0, Math.round((r.netSales * (100 + upliftPct)) / 100)),
      marginPm: r.grossMargin === null ? null : Math.round(r.grossMargin * 10),
      costs: r.staff + r.rent + r.other,
      basis: r.netSales,
    })),
  };
}

export type Pace = "ahead" | "on track" | "behind" | null;

/** How far through the month we are (0–1) at `now`; 1 for past months, 0 for future ones. */
export function monthProgress(month: string, now = new Date()) {
  const { start, end } = monthBounds(month);
  if (now <= start) return 0;
  if (now >= end) return 1;
  return (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
}

const paceOf = (forecast: number, target: number): Pace => (!target ? null : forecast >= target ? "ahead" : forecast >= target * 0.9 ? "on track" : "behind");

export type BudgetRow = PlRow & {
  target: number | null; achieved: number | null; expectedByNow: number | null; forecast: number | null; pace: Pace;
  marginTarget: number | null; costBudget: number | null; costVariance: number | null; profitPlan: number | null; profitVariance: number | null;
};

/** Plan vs actual for every location in a month (scope with `storeIds` for a manager). */
export async function budgetReport(month: string, opts: { now?: Date; storeIds?: string[] | null } = {}) {
  const now = opts.now ?? new Date();
  const [pl, budgets] = await Promise.all([shopPl(month, { storeIds: opts.storeIds }), db.shopBudget.findMany({ where: { month } })]);
  const by = new Map(budgets.map((b) => [b.storeId, b]));
  const f = monthProgress(month, now);
  const rows: BudgetRow[] = pl.rows.map((r) => {
    const b = by.get(r.storeId!);
    const target = b?.sales ?? null;
    const costs = r.staff + r.rent + r.other;
    const forecast = f > 0 ? Math.round(r.netSales / f) : null;
    const profitPlan = b && b.marginPm !== null ? Math.round((b.sales * b.marginPm) / 1000) - b.costs : null;
    return {
      ...r, target,
      achieved: target ? Math.round((r.netSales / target) * 1000) / 10 : null,
      expectedByNow: target !== null ? Math.round(target * f) : null,
      forecast, pace: target && forecast !== null ? paceOf(forecast, target) : null,
      marginTarget: b?.marginPm != null ? b.marginPm / 10 : null,
      costBudget: b ? b.costs : null, costVariance: b ? b.costs - costs : null, // positive = under budget
      profitPlan, profitVariance: profitPlan !== null ? r.profit - profitPlan : null,
    };
  });
  const planned = rows.filter((r) => r.target);
  const total = {
    target: planned.reduce((a, r) => a + (r.target ?? 0), 0), actual: planned.reduce((a, r) => a + r.netSales, 0),
    forecast: planned.reduce((a, r) => a + (r.forecast ?? 0), 0), behind: planned.filter((r) => r.pace === "behind").length,
  };
  return { month, progress: f, rows, total, unplanned: rows.filter((r) => !r.target && r.kind === "SHOP").length };
}

/** For a shop's Today page: this month's sales against target and the pace (no costs: staff see this). */
export async function targetProgress(storeId: string, now = new Date(), month = ktmDate(now).slice(0, 7)) {
  const b = await db.shopBudget.findUnique({ where: { storeId_month: { storeId, month } } });
  if (!b || !b.sales) return null;
  const { start, end } = monthBounds(month);
  const actual = (await netSalesAt(start, now < end ? now : end, [storeId])).get(storeId) ?? 0;
  const f = monthProgress(month, now);
  const forecast = f > 0 ? Math.round(actual / f) : 0;
  return { month, target: b.sales, actual, achieved: Math.round((actual / b.sales) * 1000) / 10, expectedByNow: Math.round(b.sales * f), forecast, pace: paceOf(forecast, b.sales) };
}
