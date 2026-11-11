import "server-only";
import { db } from "./db";
import { store as storeCfg } from "./config";
import { formatPrice } from "./utils";

// Risk of a cash-on-delivery order coming back, shown on the confirmation-call queue so the riskiest are called
// first and asked the right questions. Explainable, not a model: the customer's own record with us (by phone:
// parcels refused or returned vs delivered, orders found fake on the call), the delivery district's return rate
// over 90 days, and a big first order. It only informs the call; it never blocks or cancels anything.

export type RiskLevel = "high" | "medium" | "low";
export type CodRisk = { level: RiskLevel; reasons: string[] };
type In = { id: string; phone: string; total: number; shippingAddress: unknown };

export function scoreRisk(h: { delivered: number; returned: number; refused: number; fake: number }, district: { name: string; shipped: number; returned: number } | null, total: number): CodRisk {
  const reasons: string[] = [];
  let level: RiskLevel = "low";
  const up = (l: RiskLevel) => { if (l === "high" || (l === "medium" && level === "low")) level = l; };
  if (h.refused) { reasons.push(`refused ${h.refused} parcel${h.refused > 1 ? "s" : ""} before${h.delivered ? ` (${h.delivered} delivered)` : ""}`); up(h.delivered ? "medium" : "high"); }
  const otherReturns = h.returned - h.refused;
  if (otherReturns > 0) { reasons.push(`${otherReturns} parcel${otherReturns > 1 ? "s" : ""} came back undelivered`); up(otherReturns >= 2 && otherReturns > h.delivered ? "high" : "medium"); }
  if (h.fake) { reasons.push(`${h.fake} earlier order${h.fake > 1 ? "s" : ""} found fake on the call`); up("high"); }
  if (district && district.shipped >= storeCfg.codRisk.minShipped && district.returned / district.shipped >= storeCfg.codRisk.districtRate) {
    reasons.push(`${district.name} returns ${Math.round((district.returned / district.shipped) * 100)}% of parcels`); up("medium");
  }
  if (!h.delivered && total >= storeCfg.codRisk.bigFirstOrder) { reasons.push(`first delivery, ${formatPrice(total)}`); up("medium"); }
  if (!reasons.length && h.delivered) reasons.push(`${h.delivered} delivered before`);
  return { level, reasons };
}

/** Risk for a batch of orders (one page of the call queue), in three queries. */
export async function codRiskFor(orders: In[], now = new Date()): Promise<Map<string, CodRisk>> {
  if (!orders.length) return new Map();
  const phones = [...new Set(orders.map((o) => o.phone))];
  const ids = orders.map((o) => o.id);
  const districtOf = (o: In) => (o.shippingAddress as { district?: string } | null)?.district?.trim() ?? "";
  const districts = [...new Set(orders.map(districtOf).filter(Boolean))];
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const [hist, dist] = await Promise.all([
    db.$queryRaw<{ phone: string; delivered: number; returned: number; refused: number; fake: number }[]>`
      SELECT o."phone",
        COUNT(*) FILTER (WHERE o."status" IN ('DELIVERED', 'RETURN_REQUESTED', 'RETURNED'))::int AS "delivered",
        COUNT(r."orderId")::int AS "returned",
        COUNT(r."orderId") FILTER (WHERE r."reason" = 'CUSTOMER_REFUSED')::int AS "refused",
        COUNT(*) FILTER (WHERE o."callOutcome" = 'REJECTED')::int AS "fake"
      FROM "Order" o LEFT JOIN "ReturnToOrigin" r ON r."orderId" = o."id"
      WHERE o."phone" = ANY(${phones}) AND NOT (o."id" = ANY(${ids})) AND o."channel" = 'ONLINE'
      GROUP BY o."phone"`,
    districts.length ? db.$queryRaw<{ district: string; shipped: number; returned: number }[]>`
      SELECT o."shippingAddress"->>'district' AS "district", COUNT(*)::int AS "shipped", COUNT(r."orderId")::int AS "returned"
      FROM "Order" o LEFT JOIN "ReturnToOrigin" r ON r."orderId" = o."id"
      WHERE o."shippingAddress"->>'district' = ANY(${districts}) AND o."channel" = 'ONLINE' AND o."createdAt" >= ${since}
        AND (o."status" IN ('SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'RETURNING') OR r."orderId" IS NOT NULL)
      GROUP BY 1` : Promise.resolve([]),
  ]);
  const h = new Map(hist.map((x) => [x.phone, x]));
  const d = new Map(dist.map((x) => [x.district, x]));
  const none = { delivered: 0, returned: 0, refused: 0, fake: 0 };
  return new Map(orders.map((o) => {
    const name = districtOf(o);
    const dd = d.get(name);
    return [o.id, scoreRisk(h.get(o.phone) ?? none, dd ? { name, ...dd } : null, o.total)];
  }));
}
