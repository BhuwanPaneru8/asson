import "server-only";
import type { ExpenseCategory, Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { monthBounds, profitAndLoss } from "./finance";
import { ktmDate } from "./pos";
import { formatPrice } from "./utils";

// Profit and loss per location for a month, on exactly the rules of the company P&L (lib/finance.ts):
// accrual by order date, VAT-inclusive sales after discounts, refunds and resellable returns in the period,
// cost of goods from the cost snapshotted on each line. Sales, refunds and cost are credited to the location
// the goods came from (OrderAllocation). Whatever can't be tied to a location (orders from before allocations
// existed, rounding) is its own row, so the rows always add up to the company P&L to the paisa.
// Costs: expenses carry their location (payroll posts per person's location; recurring costs post themselves);
// expenses without one are HQ's. "After HQ" spreads HQ's net cost over locations by their share of sales.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class CostError extends Error {}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// ---------- recurring costs ----------

export async function saveRecurringCost(tx: Tx, owner: Actor, d: { id?: string; storeId: string | null; category: ExpenseCategory; amount: number; description: string; startMonth: string; endMonth?: string | null; active: boolean }) {
  if (!MONTH.test(d.startMonth) || (d.endMonth && !MONTH.test(d.endMonth))) throw new CostError("Months are YYYY-MM.");
  if (d.endMonth && d.endMonth < d.startMonth) throw new CostError("The last month can't be before the first.");
  if (!Number.isInteger(d.amount) || d.amount <= 0) throw new CostError("Enter the monthly amount.");
  if (d.storeId && !(await tx.store.findUnique({ where: { id: d.storeId }, select: { id: true } }))) throw new CostError("Location not found.");
  const data = { storeId: d.storeId, category: d.category, amount: d.amount, description: d.description.trim(), startMonth: d.startMonth, endMonth: d.endMonth || null, active: d.active };
  const c = d.id ? await tx.recurringCost.update({ where: { id: d.id }, data }) : await tx.recurringCost.create({ data: { ...data, createdById: owner.id } });
  await audit(tx, owner, { action: "cost.recurring", entity: ["RecurringCost", c.id], summary: `Monthly ${c.category.toLowerCase()} ${formatPrice(c.amount)} · ${c.description} from ${c.startMonth}${c.endMonth ? ` to ${c.endMonth}` : ""}${c.active ? "" : " (off)"}` });
  return c;
}

/** Post every recurring cost that applies to `month` (once each: the source key is unique). Safe to run any number of times. */
export async function postRecurring(month = ktmDate().slice(0, 7)) {
  const costs = await db.recurringCost.findMany({ where: { active: true, startMonth: { lte: month }, OR: [{ endMonth: null }, { endMonth: { gte: month } }] } });
  if (!costs.length) return { posted: 0 };
  const owner = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const r = await db.expense.createMany({
    data: costs.map((c) => ({ date: `${month}-01`, category: c.category, amount: c.amount, storeId: c.storeId, description: `${c.description} (monthly)`, source: `recurring:${c.id}:${month}`, createdById: c.createdById ?? owner?.id ?? "system" })),
    skipDuplicates: true,
  });
  return { posted: r.count };
}

// ---------- the report ----------

export type PlRow = {
  storeId: string | null; name: string; kind: "SHOP" | "WAREHOUSE" | "HQ" | "UNLINKED";
  netSales: number; cogs: number; grossProfit: number; grossMargin: number | null;
  staff: number; rent: number; other: number; deliveryIncome: number;
  profit: number; margin: number | null; hqShare: number; afterHq: number;
};

type Money = { revenue: number; cogs: number; refunds: number; costBack: number };

/** Sales, cost of goods, refunds and cost back per location for a period (the P&L's rules, split by allocation). */
export async function locationMoney(start: Date, end: Date, storeIds: string[] | null = null) {
  const ids = storeIds;
  const [sold, back, full] = await Promise.all([
    db.$queryRaw<{ storeId: string; revenue: number; cogs: number }[]>`
      SELECT a."storeId",
        SUM(a."quantity" * oi."unitPrice" * CASE WHEN o."subtotal" > 0 THEN (o."subtotal" - o."discount" - o."pointsDiscount")::numeric / o."subtotal" ELSE 1 END)::float AS "revenue",
        SUM(a."quantity" * COALESCE(oi."unitCost", 0))::float AS "cogs"
      FROM "OrderAllocation" a JOIN "OrderItem" oi ON oi."id" = a."orderItemId" JOIN "Order" o ON o."id" = a."orderId"
      WHERE o."status" <> 'CANCELLED' AND o."createdAt" >= (${start}::timestamptz AT TIME ZONE 'UTC') AND o."createdAt" < (${end}::timestamptz AT TIME ZONE 'UTC')
        AND (${ids}::text[] IS NULL OR a."storeId" = ANY(${ids}::text[]))
      GROUP BY a."storeId"`,
    // till/online partial returns in the period, shared over the locations that sold the line
    db.$queryRaw<{ storeId: string; refunds: number; costBack: number }[]>`
      SELECT a."storeId",
        SUM(ri."amount" * a."quantity"::numeric / NULLIF(oi."quantity", 0))::float AS "refunds",
        SUM(CASE WHEN ri."condition" = 'RESELLABLE' THEN COALESCE(oi."unitCost", 0) * ri."quantity" * a."quantity"::numeric / NULLIF(oi."quantity", 0) ELSE 0 END)::float AS "costBack"
      FROM "ReturnItem" ri JOIN "Return" r ON r."id" = ri."returnId" JOIN "OrderItem" oi ON oi."id" = ri."orderItemId" JOIN "OrderAllocation" a ON a."orderItemId" = oi."id"
      WHERE r."createdAt" >= (${start}::timestamptz AT TIME ZONE 'UTC') AND r."createdAt" < (${end}::timestamptz AT TIME ZONE 'UTC')
        AND (${ids}::text[] IS NULL OR a."storeId" = ANY(${ids}::text[]))
      GROUP BY a."storeId"`,
    // whole orders returned through the admin workflow
    db.$queryRaw<{ storeId: string; refunds: number; costBack: number }[]>`
      SELECT a."storeId",
        SUM(a."quantity" * oi."unitPrice" * CASE WHEN o."subtotal" > 0 THEN (o."subtotal" - o."discount" - o."pointsDiscount")::numeric / o."subtotal" ELSE 1 END)::float AS "refunds",
        SUM(a."quantity" * COALESCE(oi."unitCost", 0))::float AS "costBack"
      FROM "OrderAllocation" a JOIN "OrderItem" oi ON oi."id" = a."orderItemId" JOIN "Order" o ON o."id" = a."orderId"
      WHERE o."status" = 'RETURNED' AND o."updatedAt" >= (${start}::timestamptz AT TIME ZONE 'UTC') AND o."updatedAt" < (${end}::timestamptz AT TIME ZONE 'UTC')
        AND NOT EXISTS (SELECT 1 FROM "Return" r WHERE r."orderId" = o."id")
        AND (${ids}::text[] IS NULL OR a."storeId" = ANY(${ids}::text[]))
      GROUP BY a."storeId"`,
  ]);
  const money = new Map<string, Money>();
  const get = (id: string) => money.get(id) ?? (money.set(id, { revenue: 0, cogs: 0, refunds: 0, costBack: 0 }), money.get(id)!);
  for (const r of sold) { const m = get(r.storeId); m.revenue += r.revenue; m.cogs += r.cogs; }
  for (const r of [...back, ...full]) { const m = get(r.storeId); m.refunds += r.refunds ?? 0; m.costBack += r.costBack ?? 0; }
  return money;
}

/** Net sales for some locations so far in a period (fast: no company P&L), e.g. for target progress. */
export async function netSalesAt(start: Date, end: Date, storeIds: string[]) {
  const m = await locationMoney(start, end, storeIds);
  return new Map(storeIds.map((id) => { const x = m.get(id); return [id, x ? Math.round(x.revenue - x.refunds) : 0]; }));
}

export async function shopPl(month: string, opts: { storeIds?: string[] | null } = {}) {
  if (!MONTH.test(month)) throw new CostError("Months are YYYY-MM.");
  const { start, end, next } = monthBounds(month);
  const from = `${month}-01`, to = `${next}-01`;
  const [company, money, expenses, stores] = await Promise.all([
    profitAndLoss(start, end, from, to),
    locationMoney(start, end),
    db.expense.groupBy({ by: ["storeId", "category"], where: { date: { gte: from, lt: to } }, _sum: { amount: true } }),
    db.store.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true, kind: true } }),
  ]);

  const cost = new Map<string | null, { staff: number; rent: number; other: number }>();
  for (const e of expenses) {
    const c = cost.get(e.storeId) ?? { staff: 0, rent: 0, other: 0 };
    const amt = e._sum.amount ?? 0;
    if (e.category === "SALARIES") c.staff += amt; else if (e.category === "RENT") c.rent += amt; else c.other += amt;
    cost.set(e.storeId, c);
  }

  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);
  const row = (storeId: string | null, name: string, kind: PlRow["kind"], netSales: number, cogs: number, deliveryIncome = 0): PlRow => {
    const c = cost.get(storeId) ?? { staff: 0, rent: 0, other: 0 };
    const grossProfit = netSales - cogs;
    const profit = grossProfit + deliveryIncome - c.staff - c.rent - c.other;
    return { storeId, name, kind, netSales, cogs, grossProfit, grossMargin: pct(grossProfit, netSales), staff: c.staff, rent: c.rent, other: c.other, deliveryIncome, profit, margin: pct(profit, netSales), hqShare: 0, afterHq: profit };
  };
  // locations that sold, cost something, or are active
  const known = new Map(stores.map((s) => [s.id, s]));
  const ids = new Set<string>([...stores.map((s) => s.id), ...money.keys(), ...[...cost.keys()].filter((k): k is string => !!k)]);
  const extra = await db.store.findMany({ where: { id: { in: [...ids].filter((i) => !known.has(i)) } }, select: { id: true, name: true, kind: true } });
  for (const s of extra) known.set(s.id, s);
  const locRows = [...ids].map((id) => {
    const m = money.get(id) ?? { revenue: 0, cogs: 0, refunds: 0, costBack: 0 };
    const s = known.get(id)!;
    return row(id, s.name, s.kind, Math.round(m.revenue - m.refunds), Math.round(m.cogs - m.costBack));
  });

  // what isn't tied to a location, so the total is the company P&L exactly
  const sumSales = locRows.reduce((a, r) => a + r.netSales, 0), sumCogs = locRows.reduce((a, r) => a + r.cogs, 0);
  const unlinked = row("unlinked", "Not linked to a location", "UNLINKED", company.netSales - sumSales, company.cogs - sumCogs);
  unlinked.staff = unlinked.rent = unlinked.other = 0; unlinked.profit = unlinked.grossProfit; unlinked.afterHq = unlinked.profit; unlinked.margin = pct(unlinked.profit, unlinked.netSales);
  const hq = row(null, "HQ and online (central costs, delivery income)", "HQ", 0, 0, company.deliveryIncome);

  // spread HQ's net cost over locations by share of sales
  const hqNet = -hq.profit; // positive when HQ costs more than delivery brings in
  const base = locRows.filter((r) => r.netSales > 0);
  const totalSales = base.reduce((a, r) => a + r.netSales, 0);
  let left = hqNet;
  base.sort((a, b) => b.netSales - a.netSales).forEach((r, i) => {
    const share = i === base.length - 1 ? left : Math.round((hqNet * r.netSales) / (totalSales || 1));
    r.hqShare = share; r.afterHq = r.profit - share; left -= share;
  });

  const visible = (r: PlRow) => !opts.storeIds || (r.storeId !== null && opts.storeIds.includes(r.storeId));
  const rows = locRows.filter(visible).filter((r) => r.netSales || r.cogs || r.staff || r.rent || r.other || known.get(r.storeId!)?.kind === "SHOP").sort((a, b) => b.profit - a.profit);
  const total = { netSales: company.netSales, cogs: company.cogs, grossProfit: company.grossProfit, deliveryIncome: company.deliveryIncome, expenses: company.totalExpenses, profit: company.netProfit };
  return { month, rows, hq: opts.storeIds ? null : hq, unlinked: opts.storeIds || (!unlinked.netSales && !unlinked.cogs) ? null : unlinked, total, unitsWithoutCost: company.unitsWithoutCost };
}
