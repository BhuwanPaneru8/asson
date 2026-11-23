/**
 * State shared by the history generators (online orders, tills, supply): the catalogue and locations, the stock
 * ledger, row buffers written in bulk at the end, document numbers, loyalty balances and the day's task queue.
 */
import type { OrderStatus, Prisma } from "@prisma/client";
import { tierFor, pointsToEarn } from "../../src/lib/loyalty-shared";
import { Ledger } from "./ledger";
import type { Person, Shop } from "./people";
import { DAY, chance, int, newId, pick, weighted } from "./shared";

export type V = { id: string; sku: string; color: string; size: string; costPrice: number | null; productId: string };
export type P = { id: string; name: string; slug: string; cat: string; gender: string; brand: string; price: number; status: string; createdAt: Date; image: string; popularity: number; tags: string[]; variants: V[] };
export type Customer = { id: string | null; email: string; phone: string; name: string; district: string; address: Record<string, unknown>; createdAt: Date; zone: string; home: string | null };

export type Ctx = ReturnType<typeof makeContext>;

export function makeContext(opts: { products: P[]; shops: Record<string, Shop>; people: Record<string, Person>; suppliers: { id: string; name: string; country: string; pan: string | null }[] }) {
  const ledger = new Ledger();
  const rows = {
    orders: [] as (Prisma.OrderCreateManyInput & { id: string; number: number })[],
    items: [] as (Prisma.OrderItemCreateManyInput & { id: string })[],
    events: [] as Prisma.OrderEventCreateManyInput[],
    allocations: [] as Prisma.OrderAllocationCreateManyInput[],
    tenders: [] as Prisma.TenderCreateManyInput[],
    payments: [] as Prisma.PaymentCreateManyInput[],
    shifts: [] as (Prisma.ShiftCreateManyInput & { id: string })[],
    cash: [] as Prisma.CashEntryCreateManyInput[],
    deposits: [] as (Prisma.BankDepositCreateManyInput & { id: string })[],
    returns: [] as (Prisma.ReturnCreateManyInput & { id: string; number: number })[],
    returnItems: [] as Prisma.ReturnItemCreateManyInput[],
    exchanges: [] as Prisma.ExchangeCreateManyInput[],
    exchangeItems: [] as Prisma.ExchangeItemCreateManyInput[],
    attempts: [] as Prisma.DeliveryAttemptCreateManyInput[],
    rtos: [] as Prisma.ReturnToOriginCreateManyInput[],
    damage: [] as Prisma.DamageEntryCreateManyInput[],
    points: [] as Prisma.PointsEntryCreateManyInput[],
    vouchers: [] as Prisma.CouponCreateManyInput[],
    expenses: [] as Prisma.ExpenseCreateManyInput[],
    packChecks: [] as Prisma.PackCheckCreateManyInput[],
    manifests: [] as (Prisma.ManifestCreateManyInput & { id: string })[],
    manifestOrders: [] as Prisma.ManifestOrderCreateManyInput[],
    audit: [] as Prisma.AuditLogCreateManyInput[],
  };
  /** documents issued with the app's own invoice code once the rows are in (in date order, per series) */
  const invoices: { orderId: string; at: Date; actorId: string | null; buyerPan?: string; buyerName?: string }[] = [];
  const credits: { orderId: string; returnId: string | null; lines: { name: string; sku: string; quantity: number; amount: number }[]; reason: string; storeId: string | null; at: Date; actorId: string | null }[] = [];

  let orderNo = 1000, returnNo = 100, exchangeNo = 10, depositNo = 100, manifestNo = 100, voucherNo = 100100;
  const next = { order: () => ++orderNo, ret: () => ++returnNo, exchange: () => ++exchangeNo, deposit: () => ++depositNo, manifest: () => ++manifestNo, voucher: () => `SC${++voucherNo}` };
  const ref = (n: number) => `AS${String(n).padStart(6, "0")}`;

  // ---------- loyalty: balances and 12-month spend over time ----------
  const pts = new Map<string, { t: number; d: number }[]>();
  const spend = new Map<string, { t: number; amount: number }[]>();
  const balanceAt = (userId: string, t: Date) => (pts.get(userId) ?? []).reduce((s, e) => s + (e.t <= t.getTime() ? e.d : 0), 0);
  function point(userId: string, delta: number, reason: string, t: Date, orderId: string | null, note?: string) {
    if (!delta) return;
    (pts.get(userId) ?? pts.set(userId, []).get(userId)!).push({ t: t.getTime(), d: delta });
    rows.points.push({ userId, delta, reason, orderId, note: note ?? null, createdAt: t });
  }
  /** points for goods delivered or sold at the till, at the customer's tier then (like earnForOrder) */
  function earn(userId: string, orderId: string, goods: number, t: Date) {
    const since = t.getTime() - 365 * DAY;
    const spent = (spend.get(userId) ?? []).reduce((s, e) => s + (e.t >= since && e.t < t.getTime() ? e.amount : 0), 0);
    const tier = tierFor(spent);
    const n = pointsToEarn(goods, tier);
    (spend.get(userId) ?? spend.set(userId, []).get(userId)!).push({ t: t.getTime(), amount: goods });
    point(userId, n, "EARN", t, orderId, `${tier.name} tier`);
    return n;
  }

  // ---------- the catalogue ----------
  const live = (t: Date) => opts.products.filter((p) => p.status !== "DRAFT" && p.createdAt <= t && (p.status === "ACTIVE" || t.getTime() < Date.now() - 120 * DAY));
  /** seasonal appetite for a product in a month (winter wear in Poush, linen in Jestha, festive in Asoj–Kartik) */
  function season(p: P, t: Date, festive: boolean) {
    const m = t.getUTCMonth() + 1;
    const winter = [11, 12, 1, 2].includes(m), summer = [4, 5, 6, 7, 8].includes(m);
    let w = p.popularity;
    if (p.tags.some((x) => ["winter", "wool", "puffer", "merino", "hoodie", "coat", "sweater", "cardigan", "shawl", "flannel"].includes(x))) w *= winter ? 2.6 : summer ? 0.25 : 0.9;
    if (p.tags.some((x) => ["linen", "summer", "camp collar", "maxi"].includes(x))) w *= summer ? 2.2 : winter ? 0.3 : 1;
    if (p.tags.some((x) => ["festive", "dashain", "tihar", "kurta", "saree", "daura suruwal", "gunyu cholo", "teej"].includes(x))) w *= festive ? 4 : m === 8 || m === 9 ? 1.6 : 0.7;
    return w;
  }
  const sizeWeight = (v: V, p: P) => { const sizes = [...new Set(p.variants.map((x) => x.size))]; const i = sizes.indexOf(v.size); const mid = (sizes.length - 1) / 2; return 1 / (1 + Math.abs(i - mid)); };

  /** A shopper's lines: products by season and popularity, sizes toward the middle; `at` limits to what a place has. */
  function chooseLines(t: Date, festive: boolean, n: number, gender: string | null, inStock: (v: V) => boolean) {
    const pool = live(t).filter((p) => !gender || p.gender === gender || chance(0.25));
    const lines: { p: P; v: V; q: number }[] = [];
    for (let k = 0; k < n * 4 && lines.length < n; k++) {
      const p = weighted(pool, (x) => season(x, t, festive));
      if (lines.some((l) => l.p.id === p.id)) continue;
      const options = p.variants.filter(inStock);
      if (!options.length) continue;
      const v = weighted(options, (x) => sizeWeight(x, p));
      lines.push({ p, v, q: chance(0.12) ? 2 : 1 });
    }
    return lines;
  }

  // ---------- order timelines ----------
  function event(orderId: string, status: OrderStatus | null, message: string, actor: string, createdAt: Date) {
    rows.events.push({ orderId, status, message, actor, createdAt });
  }
  function item(orderId: string, p: P, v: V, unitPrice: number, quantity: number) {
    const id = newId("oi");
    rows.items.push({ id, orderId, variantId: v.id, productId: p.id, name: p.name, slug: p.slug, sku: v.sku, color: v.color, size: v.size, image: p.image, unitPrice, quantity, unitCost: v.costPrice });
    return id;
  }
  function audit(actor: Person, at: Date, action: string, entity: [string, string | null], summary: string) {
    rows.audit.push({ at, actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, entityType: entity[0], entityId: entity[1], summary });
  }

  return { ...opts, ledger, rows, invoices, credits, next, ref, earn, point, balanceAt, chooseLines, event, item, audit, season, pick, int };
}
