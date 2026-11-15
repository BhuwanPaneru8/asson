import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { store as storeCfg } from "./config";
import { type Permission, type Role, type Subject, can } from "./permissions";
import { ktmDate } from "./pos";
import type { Scope } from "./scope";
import { addDays, rosterOverview, weekStartOf } from "./rosters";
import { pulseToday } from "./pulse";
import { swapsToApprove } from "./shift-swaps";
import { trainingMatrix } from "./training";
import { cashPosition } from "./cash";
import { formatPrice } from "./utils";

// "Needs your attention": the exceptions across the business in one list, each with a count and a link to the page
// that deals with it. Only what the viewer can act on (by permission) and only at their locations (HQ sees all).
// Nothing here changes anything; it's counts. Items with nothing to do aren't shown.

export type Attention = { key: string; tone: "danger" | "warn"; text: string; href: string };

const H = 3_600_000, DAY = 24 * H;

export async function attention(user: { id: string; role: string; permissions?: readonly Permission[] }, scope: Scope, now = new Date()): Promise<Attention[]> {
  // the person's own access (their job), not just their role
  const role: Subject = { role: user.role, permissions: user.permissions };
  const ids = scope.all ? null : scope.storeIds;
  const here = <T extends object>(w: T) => (ids ? { ...w, storeId: { in: ids } } : w);
  const atMine: Prisma.OrderWhereInput = ids ? { allocations: { some: { storeId: { in: ids } } } } : {};
  const today = ktmDate(now), yesterday = ktmDate(new Date(now.getTime() - DAY));
  const dayStart = (d: string) => new Date(`${d}T00:00:00+05:45`);
  const out: Attention[] = [];
  const add = (key: string, tone: Attention["tone"], n: number, text: (n: number) => string, href: string) => { if (n > 0) out.push({ key, tone, text: text(n), href }); };
  const s = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const jobs: Promise<void>[] = [];

  if (can(role, "orders")) jobs.push((async () => {
    const stuckBefore = new Date(now.getTime() - storeCfg.delivery.stuckDays * DAY);
    const scopeSql = ids ? Prisma.sql`AND EXISTS (SELECT 1 FROM "OrderAllocation" al WHERE al."orderId" = o."id" AND al."storeId" = ANY(${ids}))` : Prisma.empty;
    const [backlog, calls, pickups, rto, stuck] = await Promise.all([
      db.order.count({ where: { channel: "ONLINE", status: "CONFIRMED", createdAt: { lt: new Date(now.getTime() - DAY) }, ...atMine } }),
      db.order.count({ where: { channel: "ONLINE", status: "PENDING", paymentMethod: "COD", callOutcome: { not: "CONFIRMED" }, createdAt: { lt: new Date(now.getTime() - 4 * H) }, ...atMine } }),
      db.order.count({ where: { status: "PACKED", pickupStoreId: ids ? { in: ids } : { not: null }, updatedAt: { lt: new Date(now.getTime() - storeCfg.pickup.holdDays * DAY) } } }),
      db.returnToOrigin.count({ where: { state: "IN_TRANSIT", startedAt: { lt: new Date(now.getTime() - storeCfg.delivery.chaseReturnDays * DAY) }, ...(ids ? { order: atMine } : {}) } }),
      db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS "n" FROM "Order" o WHERE o."status" IN ('SHIPPED', 'OUT_FOR_DELIVERY') ${scopeSql}
        AND (SELECT MAX(e."createdAt") FROM "OrderEvent" e WHERE e."orderId" = o."id" AND e."status" = 'SHIPPED') < (${stuckBefore}::timestamptz AT TIME ZONE 'UTC')`,
    ]);
    add("backlog", "danger", backlog, (n) => `${s(n, "confirmed order")} waiting more than a day to be packed`, "/admin/fulfilment");
    add("calls", "warn", calls, (n) => `${s(n, "COD order")} waiting for the confirmation call over 4 hours`, "/admin/orders?call=1");
    add("stuck", "warn", stuck[0]?.n ?? 0, (n) => `${s(n, "parcel")} with couriers for ${storeCfg.delivery.stuckDays}+ days`, "/admin/fulfilment/deliveries");
    add("rto", "warn", rto, (n) => `${s(n, "returned parcel")} not back after ${storeCfg.delivery.chaseReturnDays} days: chase the courier`, "/admin/fulfilment/deliveries");
    add("pickups", "warn", pickups, (n) => `${s(n, "pickup order")} uncollected past ${storeCfg.pickup.holdDays} days`, "/admin/orders?status=PACKED");
  })());

  if (can(role, "closing")) jobs.push((async () => {
    const [diffs, cash, sold, locked, offline] = await Promise.all([
      db.shift.count({ where: here({ status: "CLOSED" as const, closedAt: { gte: dayStart(yesterday) }, NOT: { difference: 0 } }) }),
      cashPosition(scope, now),
      db.order.groupBy({ by: ["shiftId"], where: { channel: "STORE", createdAt: { gte: dayStart(yesterday), lt: dayStart(today) }, shift: ids ? { storeId: { in: ids } } : {} }, _count: { _all: true } }),
      db.dayClose.findMany({ where: here({ date: yesterday }), select: { storeId: true } }),
      db.posException.count({ where: here({ resolvedAt: null }) }),
    ]);
    add("offline", "danger", offline, (n) => `${s(n, "offline-sale exception")} to check (stock sold that the system didn't have, or a sale that arrived late)`, "/admin/closing");
    add("cashdiff", "danger", diffs, (n) => `${s(n, "till")} closed with a cash difference since yesterday`, "/admin/closing");
    const flagged = cash.filter((c) => c.flags.length);
    add("cash", "warn", flagged.length, (n) => `${s(n, "location")} with a cash to-do (bank it, check a deposit or count the safe)`, "/admin/cash");
    const shiftIds = sold.map((g) => g.shiftId).filter((x): x is string => !!x);
    const soldAt = shiftIds.length ? new Set((await db.shift.findMany({ where: { id: { in: shiftIds } }, select: { storeId: true } })).map((x) => x.storeId)) : new Set<string>();
    const unlocked = [...soldAt].filter((sid) => !locked.some((l) => l.storeId === sid)).length;
    add("unlocked", "warn", unlocked, (n) => `${s(n, "shop")} sold yesterday but hasn't locked the day`, "/admin/closing");
  })());

  if (can(role, "care")) jobs.push((async () => {
    const n = await db.careCase.count({ where: { status: { in: ["NEW", "OPEN"] }, respondBy: { lt: now }, ...(ids ? { OR: [{ storeId: null }, { storeId: { in: ids } }] } : {}) } });
    add("care", "danger", n, (n) => `${s(n, "customer")} waiting past the reply deadline`, "/admin/care");
  })());

  if (can(role, "people")) jobs.push((async () => {
    const nextWeek = addDays(weekStartOf(today), 7);
    const [issues, leave, swaps, rosters, absences, training] = await Promise.all([
      db.issue.count({ where: here({ status: { not: "RESOLVED" as const }, dueAt: { lt: now } }) }),
      db.leaveRequest.count({ where: { status: "PENDING", userId: { not: user.id }, ...(ids ? { user: { locations: { some: { storeId: { in: ids } } } } } : {}) } }),
      swapsToApprove(scope, now),
      rosterOverview(scope, nextWeek),
      db.absence.count({ where: { status: "OPEN", userId: { not: user.id }, ...(ids ? { storeId: { in: ids } } : {}) } }),
      trainingMatrix(scope),
    ]);
    add("issues", "warn", issues, (n) => `${s(n, "shop issue")} past its due time`, "/admin/issues");
    add("leave", "warn", leave, (n) => `${s(n, "leave request")} to decide`, "/admin/people");
    add("swaps", "warn", swaps.length, (n) => `${s(n, "shift swap")} to approve`, "/admin/rosters");
    add("noshow", "danger", absences, (n) => `${s(n, "missed shift")} to decide: unpaid, leave or worked`, "/admin/people/absences");
    add("rosters", "warn", rosters.filter((r) => r.shifts > 0 ? !r.published : true).length, (n) => `${s(n, "location")} without a published roster for next week`, `/admin/rosters?week=${nextWeek}`);
    add("training", "warn", training.rows.filter((r) => r.of > 0 && r.done < r.of).length, (n) => `${s(n, "person", "people")} with training still to sign`, "/admin/training");
  })());

  // the business's vital signs: a KPI far below (or, for cancellations, above) its usual level for that weekday
  if (can(role, "insights")) jobs.push((async () => {
    const { kpis } = await pulseToday();
    for (const k of kpis) {
      if (k.ownerOnly && !can(role, "finance")) continue;
      const bad = k.verdict.strength === "unusual" && (k.verdict.level === "low") === (k.goodWhen === "high");
      if (!bad || k.yesterday == null) continue;
      const f = (v: number) => (k.format === "money" ? formatPrice(Math.round(v)) : k.format === "pct" ? `${(v * 100).toFixed(1)}%` : String(Math.round(v)));
      add(`kpi-${k.key}`, "danger", 1, () => `${k.label} unusually ${k.verdict.level} yesterday: ${f(k.yesterday!)} vs a usual ${f(k.verdict.usual)}`, "/admin/insights?tab=pulse");
    }
  })());

  if (can(role, "inventory.adjust")) jobs.push((async () => {
    const [r] = await db.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS "n" FROM (SELECT e."storeId", e."variantId" FROM "DamageEntry" e
        ${ids ? Prisma.sql`WHERE e."storeId" = ANY(${ids})` : Prisma.empty}
        GROUP BY 1, 2 HAVING SUM(e."quantity") > 0 AND MIN(e."createdAt") FILTER (WHERE e."kind" = 'IN') < (${new Date(now.getTime() - 30 * DAY)}::timestamptz AT TIME ZONE 'UTC')) x`;
    add("damaged", "warn", r?.n ?? 0, (n) => `${s(n, "damaged size")} held over 30 days: repair, write off or send back`, "/admin/damaged");
  })());

  if (can(role, "finance")) jobs.push((async () => {
    const lastMonth = ktmDate(new Date(dayStart(`${today.slice(0, 7)}-01`).getTime() - DAY)).slice(0, 7);
    const [bills, statutory, vat, close, credits] = await Promise.all([
      db.supplierBill.aggregate({ where: { status: "OPEN", dueDate: { lt: dayStart(today) } }, _count: { _all: true }, _sum: { amount: true, paid: true } }),
      db.statutoryDeposit.count({ where: { paidOn: null, dueOn: { lt: today } } }),
      db.vatReturn.count({ where: { status: { not: "FILED" }, to: { lt: today } } }),
      db.monthClose.findUnique({ where: { month: lastMonth } }),
      db.damageEntry.count({ where: { kind: "TO_SUPPLIER", creditAt: null, createdAt: { lt: new Date(now.getTime() - 30 * DAY) } } }),
    ]);
    add("bills", "danger", bills._count._all, (n) => `${s(n, "supplier bill")} overdue (${formatPrice((bills._sum.amount ?? 0) - (bills._sum.paid ?? 0))})`, "/admin/payables");
    add("statutory", "danger", statutory, (n) => `${s(n, "TDS/SSF deposit")} overdue`, "/admin/payroll/statutory");
    add("vat", "danger", vat, (n) => `${s(n, "VAT return")} for a finished period not filed`, "/admin/finance/vat");
    const closed = !!close?.closedAt && (!close.reopenedAt || close.reopenedAt < close.closedAt);
    add("close", "warn", !closed && Number(today.slice(8)) > 10 ? 1 : 0, () => `${new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${lastMonth}-15T00:00:00Z`))}'s books aren't closed yet`, "/admin/finance/close");
    add("credits", "warn", credits, (n) => `${s(n, "supplier credit")} for damaged goods owed over 30 days`, "/admin/payables");
  })());

  await Promise.all(jobs);
  // most urgent first, then a fixed order (the queries finish in any order)
  return out.sort((a, b) => (a.tone === b.tone ? a.key.localeCompare(b.key) : a.tone === "danger" ? -1 : 1));
}
