import "server-only";
import { db } from "./db";
import { store } from "./config";
import { distanceTier } from "./geo";
import { salesVelocity } from "./insights";
import { createTransfer, transferNo } from "./transfers";
import type { Scope } from "./scope";

// Keeping every shop stocked. For each shop and size:
//   target = max(minDisplay if it sold there in 90 days, ceil(its own daily sales × shopCoverDays))
//   need   = target − on hand − units already on their way (transfers drafted or sent to it)
// Needs are filled from the nearest warehouse first (which keeps warehouseReserveDays of its own online
// sales back), then by moving stock a shop hasn't sold in rebalanceAfterDays to a shop that sells it.
// The result is a list of suggested transfers per route; drafting them is one click (or a nightly job).

const DAY = 86_400_000;
type Key = string; // `${storeId}|${variantId}`
const k = (storeId: string, variantId: string): Key => `${storeId}|${variantId}`;

export type ReplenishLine = { variantId: string; sku: string; name: string; color: string; size: string; quantity: number; reason: "warehouse" | "rebalance"; coverDays: number | null };
export type ReplenishRoute = { fromId: string; fromName: string; toId: string; toName: string; lines: ReplenishLine[]; units: number };

export async function replenishmentPlan(now = new Date()): Promise<ReplenishRoute[]> {
  const cfg = store.replenishment;
  const since90 = new Date(now.getTime() - 90 * DAY), since30 = new Date(now.getTime() - 30 * DAY), sinceIdle = new Date(now.getTime() - cfg.rebalanceAfterDays * DAY);
  const [locations, stock, s30, s90, sIdle, pipeline] = await Promise.all([
    db.store.findMany({ where: { active: true }, select: { id: true, name: true, kind: true, district: true, priority: true } }),
    db.storeStock.findMany({ where: { quantity: { gt: 0 }, variant: { product: { status: "ACTIVE" } } }, select: { storeId: true, variantId: true, quantity: true } }),
    db.inventoryLog.groupBy({ by: ["storeId", "variantId"], where: { reason: "SALE", storeId: { not: null }, createdAt: { gte: since30 } }, _sum: { delta: true } }),
    db.inventoryLog.groupBy({ by: ["storeId", "variantId"], where: { reason: "SALE", storeId: { not: null }, createdAt: { gte: since90 } }, _sum: { delta: true } }),
    db.inventoryLog.groupBy({ by: ["storeId", "variantId"], where: { reason: "SALE", storeId: { not: null }, createdAt: { gte: sinceIdle } }, _sum: { delta: true } }),
    // drafted or in-transit transfers: incoming units count as coming, outgoing drafts as spoken for
    db.stockTransferItem.findMany({ where: { transfer: { status: { in: ["DRAFT", "SENT"] } } }, select: { variantId: true, quantity: true, transfer: { select: { fromId: true, toId: true, status: true } } } }),
  ]);
  const onHand = new Map<Key, number>(stock.map((r) => [k(r.storeId, r.variantId), r.quantity]));
  const sold = (rows: typeof s30) => new Map<Key, number>(rows.map((r) => [k(r.storeId!, r.variantId), -(r._sum.delta ?? 0)]));
  const sold30 = sold(s30), sold90 = sold(s90), soldIdle = sold(sIdle);
  const incoming = new Map<Key, number>(), outgoingDraft = new Map<Key, number>();
  for (const i of pipeline) {
    incoming.set(k(i.transfer.toId, i.variantId), (incoming.get(k(i.transfer.toId, i.variantId)) ?? 0) + i.quantity);
    if (i.transfer.status === "DRAFT") outgoingDraft.set(k(i.transfer.fromId, i.variantId), (outgoingDraft.get(k(i.transfer.fromId, i.variantId)) ?? 0) + i.quantity);
  }
  const perDay = (key: Key) => salesVelocity(sold30.get(key) ?? 0, sold90.get(key) ?? 0);
  const shops = locations.filter((l) => l.kind === "SHOP");
  const warehouses = locations.filter((l) => l.kind === "WAREHOUSE");
  const shopTarget = (key: Key) => Math.max((sold90.get(key) ?? 0) > 0 ? cfg.minDisplay : 0, Math.ceil(perDay(key) * cfg.shopCoverDays));

  // what each source can give without hurting itself
  const spare = new Map<Key, number>();
  for (const w of warehouses) for (const r of stock.filter((x) => x.storeId === w.id)) {
    const key = k(w.id, r.variantId);
    spare.set(key, Math.max(0, r.quantity - (outgoingDraft.get(key) ?? 0) - Math.ceil(perDay(key) * cfg.warehouseReserveDays)));
  }
  for (const s of shops) for (const r of stock.filter((x) => x.storeId === s.id)) {
    const key = k(s.id, r.variantId);
    // a shop gives up only stock it hasn't sold lately, and keeps its own target
    if ((soldIdle.get(key) ?? 0) === 0) spare.set(key, Math.max(0, r.quantity - (outgoingDraft.get(key) ?? 0) - shopTarget(key)));
  }

  // needs, most urgent first (fewest days of cover)
  const variantIds = new Set<string>([...sold90.keys()].map((x) => x.split("|")[1]));
  const needs: { shop: (typeof shops)[number]; variantId: string; need: number; cover: number | null }[] = [];
  for (const s of shops) for (const v of variantIds) {
    const key = k(s.id, v);
    const target = shopTarget(key);
    if (!target) continue;
    const have = (onHand.get(key) ?? 0) + (incoming.get(key) ?? 0);
    if (have >= target) continue;
    const pd = perDay(key);
    needs.push({ shop: s, variantId: v, need: target - have, cover: pd > 0 ? Math.floor(have / pd) : null });
  }
  needs.sort((a, b) => (a.cover ?? 0) - (b.cover ?? 0));

  const moves: { fromId: string; toId: string; variantId: string; quantity: number; reason: ReplenishLine["reason"]; cover: number | null }[] = [];
  const near = (to: (typeof shops)[number]) => (a: (typeof locations)[number], b: (typeof locations)[number]) => distanceTier(a.district, to.district) - distanceTier(b.district, to.district) || a.priority - b.priority;
  for (const n of needs) {
    let left = n.need;
    const take = (from: (typeof locations)[number], reason: ReplenishLine["reason"]) => {
      const key = k(from.id, n.variantId);
      const q = Math.min(left, spare.get(key) ?? 0);
      if (q <= 0) return;
      spare.set(key, (spare.get(key) ?? 0) - q);
      left -= q;
      moves.push({ fromId: from.id, toId: n.shop.id, variantId: n.variantId, quantity: q, reason, cover: n.cover });
    };
    for (const w of [...warehouses].sort(near(n.shop))) { if (!left) break; take(w, "warehouse"); }
    for (const s of shops.filter((x) => x.id !== n.shop.id).sort(near(n.shop))) { if (!left) break; take(s, "rebalance"); }
  }
  if (!moves.length) return [];

  const variants = await db.variant.findMany({ where: { id: { in: [...new Set(moves.map((m) => m.variantId))] } }, select: { id: true, sku: true, color: true, size: true, product: { select: { name: true } } } });
  const name = (id: string) => locations.find((l) => l.id === id)!.name;
  const routes = new Map<string, ReplenishRoute>();
  for (const m of moves) {
    const v = variants.find((x) => x.id === m.variantId)!;
    const r = routes.get(`${m.fromId}>${m.toId}`) ?? { fromId: m.fromId, fromName: name(m.fromId), toId: m.toId, toName: name(m.toId), lines: [], units: 0 };
    r.lines.push({ variantId: m.variantId, sku: v.sku, name: v.product.name, color: v.color, size: v.size, quantity: m.quantity, reason: m.reason, coverDays: m.cover });
    r.units += m.quantity;
    routes.set(`${m.fromId}>${m.toId}`, r);
  }
  return [...routes.values()].sort((a, b) => b.units - a.units);
}

export const visibleRoutes = (routes: ReplenishRoute[], scope: Scope) => (scope.all ? routes : routes.filter((r) => scope.storeIds.includes(r.fromId) || scope.storeIds.includes(r.toId)));

/** Nightly job: draft every suggested transfer, if the owner switched automation on. Re-running is safe (drafts count as on their way). */
export async function autoDraftReplenishment() {
  if (!store.replenishment.autoDraft) return { skipped: "autoDraft is off" };
  const routes = await replenishmentPlan();
  const actor = { id: "system", name: "Replenishment (automatic)", role: "ADMIN" };
  const made: string[] = [];
  for (const r of routes) {
    const t = await db.$transaction((tx) => createTransfer(tx, actor, { fromId: r.fromId, toId: r.toId, note: "Suggested by replenishment", items: r.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }));
    made.push(transferNo(t.number));
  }
  return { drafted: made };
}
