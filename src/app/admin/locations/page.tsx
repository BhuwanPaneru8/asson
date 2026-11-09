import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { getLocations } from "@/lib/stock";
import { pickCounts } from "@/lib/picking";
import { Card, PageHeader } from "@/components/admin/ui";
import { LocationManager } from "@/components/admin/location-manager";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  const me = await requirePermission("locations");
  const showCost = can(me.role, "finance");
  const [locations, sums, skus, picks, arriving] = await Promise.all([
    getLocations({ includeInactive: true }),
    db.storeStock.groupBy({ by: ["storeId"], _sum: { quantity: true } }),
    db.storeStock.groupBy({ by: ["storeId"], where: { quantity: { gt: 0 } }, _count: { _all: true } }),
    pickCounts(),
    db.stockTransfer.groupBy({ by: ["toId"], where: { status: "SENT" }, _count: { _all: true } }),
  ]);
  // stock value at weighted-average cost, per location (owner only)
  const values = showCost
    ? await db.$queryRaw<{ storeId: string; value: bigint }[]>`SELECT s."storeId", COALESCE(SUM(s.quantity::bigint * COALESCE(v."costPrice", 0)), 0) AS value FROM "StoreStock" s JOIN "Variant" v ON v.id = s."variantId" GROUP BY s."storeId"`
    : [];
  const rows = locations.map((l) => {
    const value = values.find((v) => v.storeId === l.id)?.value;
    return {
      id: l.id, code: l.code, name: l.name, kind: l.kind, district: l.district ?? "", shipsOnline: l.shipsOnline, address: l.address, phone: l.phone ?? "", hours: l.hours ?? "", priority: l.priority, pickup: l.pickup, active: l.active,
      units: sums.find((s) => s.storeId === l.id)?._sum.quantity ?? 0,
      skus: skus.find((s) => s.storeId === l.id)?._count._all ?? 0,
      value: showCost ? formatPrice(Number(value ?? 0)) : null,
      toPick: picks.get(l.id) ?? 0,
      inTransit: arriving.find((a) => a.toId === l.id)?._count._all ?? 0,
    };
  });
  return (
    <>
      <PageHeader actions={<Link href="/admin/locations/new" className="flex h-10 items-center rounded-md bg-ink px-4 text-[14px] text-white">Open a shop</Link>} title="Locations" description="Shops and warehouses that hold stock. Online orders are filled from the lowest priority number first, preferring one location that has the whole order." />
      <Card><LocationManager rows={rows} /></Card>
    </>
  );
}
