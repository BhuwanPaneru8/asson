import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { expectedCashForShift, getOpenShift, getShops } from "@/lib/pos";
import { can, discountLimitPercent } from "@/lib/permissions";
import { PosTerminal } from "@/components/pos/pos-terminal";

export const metadata = { title: "Point of sale" };

export default async function PosPage() {
  const me = await requirePermission("pos.sell");
  const shift = await getOpenShift(me.id);
  const shops = shift ? [] : await getShops();
  const store = shift ? await db.store.findUnique({ where: { id: shift.storeId }, select: { name: true } }) : null;
  const stats = shift
    ? await db.order.aggregate({ where: { shiftId: shift.id }, _count: { _all: true }, _sum: { total: true } })
    : null;
  return (
    <PosTerminal
      cashier={{ name: me.name, discountLimit: discountLimitPercent(me.role), canApproveReturns: can(me.role, "approve.return") }}
      shops={shops.map((s) => ({ id: s.id, name: s.name }))}
      shift={shift && {
        store: store?.name ?? "",
        openedAt: shift.openedAt.toISOString(),
        openingFloat: shift.openingFloat,
        expectedCash: await expectedCashForShift(shift.id),
        sales: stats?._count._all ?? 0,
        total: stats?._sum.total ?? 0,
      }}
    />
  );
}
