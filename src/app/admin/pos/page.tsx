import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { expectedCashForShift, getOpenShift } from "@/lib/pos";
import { can, discountLimitPercent } from "@/lib/permissions";
import { PosTerminal } from "@/components/pos/pos-terminal";

export const metadata = { title: "Point of sale" };

export default async function PosPage() {
  const me = await requirePermission("pos.sell");
  const shift = await getOpenShift(me.id);
  const stats = shift
    ? await db.order.aggregate({ where: { shiftId: shift.id }, _count: { _all: true }, _sum: { total: true } })
    : null;
  return (
    <PosTerminal
      cashier={{ name: me.name, discountLimit: discountLimitPercent(me.role), canApproveReturns: can(me.role, "approve.return") }}
      shift={shift && {
        openedAt: shift.openedAt.toISOString(),
        openingFloat: shift.openingFloat,
        expectedCash: await expectedCashForShift(shift.id),
        sales: stats?._count._all ?? 0,
        total: stats?._sum.total ?? 0,
      }}
    />
  );
}
