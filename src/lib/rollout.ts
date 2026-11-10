import "server-only";
import type { Prisma } from "@prisma/client";
import { store } from "./config";
import { audit, type AuditActor } from "./audit";
import { salesVelocity } from "./insights";
import { createTransfer } from "./transfers";
import { inChunks } from "./batch";

// Opening a new shop from a template: the location, its staff and an opening-stock transfer draft from
// a warehouse, in one transaction. Opening stock is either a copy of a similar shop's current stock
// (scaled) or a best-seller starter (the network's top products, a few of every size that sells).
// Quantities never exceed what the warehouse can spare after keeping its own online reserve.

type Tx = Prisma.TransactionClient;
const DAY = 86_400_000;

export type OpeningPlan =
  | { mode: "copy"; fromStoreId: string; percent: number }
  | { mode: "bestsellers"; products: number; perSize: number };

/** What the warehouse can give: on hand − its own drafted outgoing − warehouseReserveDays of its online sales. */
async function warehouseSpare(reader: Tx, warehouseId: string) {
  const since30 = new Date(Date.now() - 30 * DAY), since90 = new Date(Date.now() - 90 * DAY);
  const [stock, drafts, s30, s90] = await Promise.all([
    reader.storeStock.findMany({ where: { storeId: warehouseId, quantity: { gt: 0 } }, select: { variantId: true, quantity: true } }),
    reader.stockTransferItem.groupBy({ by: ["variantId"], where: { transfer: { fromId: warehouseId, status: "DRAFT" } }, _sum: { quantity: true } }),
    reader.inventoryLog.groupBy({ by: ["variantId"], where: { storeId: warehouseId, reason: "SALE", createdAt: { gte: since30 } }, _sum: { delta: true } }),
    reader.inventoryLog.groupBy({ by: ["variantId"], where: { storeId: warehouseId, reason: "SALE", createdAt: { gte: since90 } }, _sum: { delta: true } }),
  ]);
  const spare = new Map<string, number>();
  for (const s of stock) {
    const pd = salesVelocity(-(s30.find((x) => x.variantId === s.variantId)?._sum.delta ?? 0), -(s90.find((x) => x.variantId === s.variantId)?._sum.delta ?? 0));
    const out = drafts.find((d) => d.variantId === s.variantId)?._sum.quantity ?? 0;
    spare.set(s.variantId, Math.max(0, s.quantity - out - Math.ceil(pd * store.replenishment.warehouseReserveDays)));
  }
  return spare;
}

/** The opening assortment: variant → units, capped by the warehouse's spare stock. */
export async function openingAssortment(reader: Tx, warehouseId: string, plan: OpeningPlan): Promise<{ variantId: string; quantity: number }[]> {
  const spare = await warehouseSpare(reader, warehouseId);
  const want = new Map<string, number>();
  if (plan.mode === "copy") {
    const rows = await reader.storeStock.findMany({ where: { storeId: plan.fromStoreId, quantity: { gt: 0 }, variant: { product: { status: "ACTIVE" } } }, select: { variantId: true, quantity: true } });
    for (const r of rows) want.set(r.variantId, Math.max(1, Math.round((r.quantity * plan.percent) / 100)));
  } else {
    // the network's best sellers over 90 days, and the sizes of them that actually sell
    const sold = await reader.inventoryLog.groupBy({ by: ["variantId"], where: { reason: "SALE", createdAt: { gte: new Date(Date.now() - 90 * DAY) }, variant: { product: { status: "ACTIVE" } } }, _sum: { delta: true } });
    const variants = await inChunks(sold.map((s) => s.variantId), (chunk) => reader.variant.findMany({ where: { id: { in: chunk } }, select: { id: true, productId: true } }));
    const productOf = new Map(variants.map((v) => [v.id, v.productId]));
    const byProduct = new Map<string, number>();
    for (const s of sold) { const pid = productOf.get(s.variantId); if (pid) byProduct.set(pid, (byProduct.get(pid) ?? 0) - (s._sum.delta ?? 0)); }
    const top = new Set([...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, plan.products).map(([pid]) => pid));
    for (const v of variants) if (top.has(v.productId)) want.set(v.id, plan.perSize);
  }
  return [...want.entries()].map(([variantId, q]) => ({ variantId, quantity: Math.min(q, spare.get(variantId) ?? 0) })).filter((l) => l.quantity > 0);
}

export type NewShop = {
  code: string; name: string; district: string; address: string; phone?: string | null; hours?: string | null;
  pickup: boolean; shipsOnline: boolean; priority: number; staffIds: string[]; warehouseId: string; plan: OpeningPlan;
};

export async function openShop(tx: Tx, actor: NonNullable<AuditActor>, d: NewShop) {
  const wh = await tx.store.findFirst({ where: { id: d.warehouseId, active: true }, select: { id: true, name: true } });
  if (!wh) throw new Error("Choose an active warehouse to send the opening stock from.");
  const shop = await tx.store.create({ data: { code: d.code, name: d.name, kind: "SHOP", district: d.district, address: d.address, phone: d.phone || null, hours: d.hours || null, pickup: d.pickup, shipsOnline: d.shipsOnline, priority: d.priority } });
  const staff = await tx.user.findMany({ where: { id: { in: d.staffIds }, role: { in: ["CASHIER", "STAFF", "MANAGER"] } }, select: { id: true, name: true } });
  if (staff.length) await tx.staffLocation.createMany({ data: staff.map((s) => ({ userId: s.id, storeId: shop.id })), skipDuplicates: true });
  const lines = await openingAssortment(tx, wh.id, d.plan);
  const transfer = lines.length ? await createTransfer(tx, actor, { fromId: wh.id, toId: shop.id, note: `Opening stock for ${d.name}`, items: lines }) : null;
  const units = lines.reduce((s, l) => s + l.quantity, 0);
  await audit(tx, actor, {
    action: "location.open", entity: ["Store", shop.id],
    summary: `Opened ${d.name} (${d.code}) in ${d.district}: ${staff.length} staff assigned${staff.length ? ` (${staff.map((s) => s.name).join(", ")})` : ""}; opening stock ${units} units from ${wh.name}${transfer ? " drafted" : " (nothing available to send)"}`,
  });
  return { shopId: shop.id, transferId: transfer?.id ?? null, units, sizes: lines.length, staff: staff.length };
}
