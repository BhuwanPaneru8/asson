import "server-only";
import type { ExpenseCategory } from "@prisma/client";
import { db } from "./db";
import { marginPercent } from "./costing";

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  RENT: "Rent", SALARIES: "Salaries & wages", UTILITIES: "Electricity, water & internet", MARKETING: "Marketing & ads",
  PACKAGING: "Packaging", DELIVERY: "Courier & delivery", EQUIPMENT: "Equipment & fit-out", FEES: "Bank, wallet & govt fees", OTHER: "Other",
};

/** UTC bounds for a Nepal calendar month "YYYY-MM". */
export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(`${month}-01T00:00:00+05:45`);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start, end: new Date(`${next}-01T00:00:00+05:45`), next };
}

/**
 * Profit & loss for a period on an accrual basis (by order date).
 * COGS uses the cost snapshotted on each order line at the time of sale; units that come back
 * resellable are credited back to COGS, damaged ones stay as a loss.
 */
export async function profitAndLoss(start: Date, end: Date, expenseFrom: string, expenseTo: string) {
  const live = { createdAt: { gte: start, lt: end }, status: { not: "CANCELLED" as const } };
  const [orders, items, storeReturns, fullReturns, expenses, damageCredits] = await Promise.all([
    db.order.aggregate({ where: live, _sum: { subtotal: true, discount: true, pointsDiscount: true, shippingFee: true }, _count: { _all: true } }),
    db.orderItem.findMany({ where: { order: live }, select: { productId: true, name: true, unitPrice: true, unitCost: true, quantity: true, order: { select: { subtotal: true, discount: true, pointsDiscount: true } } } }),
    db.returnItem.findMany({ where: { return: { createdAt: { gte: start, lt: end } } }, select: { quantity: true, amount: true, condition: true, orderItem: { select: { unitCost: true } } } }),
    // online orders returned through the admin workflow (no store Return rows): everything came back
    db.order.findMany({ where: { status: "RETURNED", updatedAt: { gte: start, lt: end }, returns: { none: {} } }, select: { subtotal: true, discount: true, pointsDiscount: true, items: { select: { unitCost: true, quantity: true } } } }),
    db.expense.groupBy({ by: ["category"], where: { date: { gte: expenseFrom, lt: expenseTo } }, _sum: { amount: true } }),
    // supplier credit notes for damaged goods sent back: their cost was already in COGS, so the credit comes off it
    db.supplierCredit.findMany({ where: { voidedAt: null, date: { gte: start, lt: end }, damage: { some: {} } }, select: { amount: true, vatAmount: true } }),
  ]);

  const gross = orders._sum.subtotal ?? 0;
  const discounts = (orders._sum.discount ?? 0) + (orders._sum.pointsDiscount ?? 0); // coupons, till discounts and loyalty points
  const deliveryIncome = orders._sum.shippingFee ?? 0;
  const refunds = storeReturns.reduce((s, r) => s + r.amount, 0) + fullReturns.reduce((s, o) => s + o.subtotal - o.discount - o.pointsDiscount, 0);
  const netSales = gross - discounts - refunds;

  let cogs = 0;
  let unitsWithoutCost = 0;
  const byProduct = new Map<string, { name: string; units: number; revenue: number; cost: number }>();
  for (const i of items) {
    const share = i.order.subtotal ? (i.order.subtotal - i.order.discount - i.order.pointsDiscount) / i.order.subtotal : 1;
    const revenue = Math.round(i.unitPrice * i.quantity * share);
    const cost = (i.unitCost ?? 0) * i.quantity;
    if (i.unitCost == null) unitsWithoutCost += i.quantity;
    cogs += cost;
    const p = byProduct.get(i.productId) ?? { name: i.name, units: 0, revenue: 0, cost: 0 };
    p.units += i.quantity; p.revenue += revenue; p.cost += cost;
    byProduct.set(i.productId, p);
  }
  const returnedCost =
    storeReturns.filter((r) => r.condition === "RESELLABLE").reduce((s, r) => s + (r.orderItem.unitCost ?? 0) * r.quantity, 0) +
    fullReturns.flatMap((o) => o.items).reduce((s, i) => s + (i.unitCost ?? 0) * i.quantity, 0);
  cogs -= returnedCost;
  const supplierCredits = damageCredits.reduce((s, c) => s + c.amount - c.vatAmount, 0);
  cogs -= supplierCredits;

  const grossProfit = netSales - cogs;
  const expenseRows = expenses.map((e) => ({ category: e.category, label: EXPENSE_LABEL[e.category], amount: e._sum.amount ?? 0 })).sort((a, b) => b.amount - a.amount);
  const totalExpenses = expenseRows.reduce((s, e) => s + e.amount, 0);

  return {
    orders: orders._count._all,
    gross, discounts, refunds, netSales, deliveryIncome,
    cogs, supplierCredits, grossProfit, grossMargin: marginPercent(netSales, cogs),
    expenses: expenseRows, totalExpenses,
    netProfit: grossProfit + deliveryIncome - totalExpenses,
    unitsWithoutCost,
    products: [...byProduct.entries()]
      .map(([id, p]) => ({ id, ...p, profit: p.revenue - p.cost, margin: marginPercent(p.revenue, p.cost) }))
      .sort((a, b) => b.profit - a.profit),
  };
}

/** Inventory valued at weighted-average cost. */
export async function stockValuation() {
  const rows = await db.variant.findMany({ where: { stock: { gt: 0 }, product: { status: { not: "ARCHIVED" } } }, select: { stock: true, costPrice: true, product: { select: { price: true } } } });
  return {
    atCost: rows.reduce((s, r) => s + r.stock * (r.costPrice ?? 0), 0),
    atRetail: rows.reduce((s, r) => s + r.stock * r.product.price, 0),
    units: rows.reduce((s, r) => s + r.stock, 0),
    skusWithoutCost: rows.filter((r) => r.costPrice == null).length,
  };
}
