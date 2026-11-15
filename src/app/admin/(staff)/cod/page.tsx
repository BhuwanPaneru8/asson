import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatOrderNumber, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { CodRemitForm } from "@/components/admin/cod-remit-form";

export const metadata = { title: "COD remittance" };

/** Delivered cash-on-delivery orders the courier still owes us, grouped by courier, plus remittance history. */
export default async function CodPage() {
  await requirePermission("closing");
  const [pending, history] = await Promise.all([
    db.order.findMany({
      where: { channel: "ONLINE", paymentMethod: "COD", status: "DELIVERED", codRemittanceId: null },
      select: { id: true, number: true, total: true, carrier: true, trackingNumber: true, updatedAt: true, shippingAddress: true },
      orderBy: { updatedAt: "asc" },
      take: 1000,
    }),
    db.codRemittance.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { _count: { select: { orders: true } } } }),
  ]);
  const byCarrier = new Map<string, typeof pending>();
  for (const o of pending) byCarrier.set(o.carrier ?? "Unassigned", [...(byCarrier.get(o.carrier ?? "Unassigned") ?? []), o]);
  const owed = pending.reduce((s, o) => s + o.total, 0);
  return (
    <>
      <PageHeader title="COD remittance" description={`Couriers collect cash on delivery and pay it to us in batches. ${pending.length} delivered COD orders · ${formatPrice(owed)} still owed by couriers.`} />
      <div className="space-y-4">
        {[...byCarrier.entries()].map(([carrier, orders]) => (
          <CodRemitForm
            key={carrier}
            carrier={carrier}
            orders={orders.map((o) => ({ id: o.id, number: formatOrderNumber(o.number), total: o.total, tracking: o.trackingNumber, deliveredOn: formatDate(o.updatedAt), name: (o.shippingAddress as { fullName?: string })?.fullName ?? "", ageDays: Math.floor((Date.now() - o.updatedAt.getTime()) / 86_400_000) }))}
          />
        ))}
        {!pending.length && <Card><p className="p-8 text-center text-muted">Nothing outstanding — every delivered COD order has been remitted.</p></Card>}
        <Card title="Remittance history">
          <table className="w-full text-[13.5px]">
            <thead><tr className="text-left text-[11.5px] uppercase tracking-wider text-muted"><th className="px-5 py-2">Date</th><th>Courier</th><th>Reference</th><th className="text-right">Orders</th><th className="text-right">Expected</th><th className="px-5 text-right">Received</th></tr></thead>
            <tbody className="divide-y divide-line">
              {history.map((h) => (
                <tr key={h.id}><td className="px-5 py-2 text-muted">{formatDate(h.createdAt)}</td><td>{h.carrier}</td><td className="font-mono text-[12.5px]">{h.reference}</td><td className="text-right tabular-nums">{h._count.orders}</td><td className="text-right tabular-nums">{formatPrice(h.expected)}</td>
                  <td className="px-5 text-right tabular-nums">{formatPrice(h.received)} {h.received !== h.expected && <Pill tone="danger">{h.received < h.expected ? "short " : "over "}{formatPrice(Math.abs(h.received - h.expected))}</Pill>}</td></tr>
              ))}
            </tbody>
          </table>
          {!history.length && <p className="px-5 pb-5 text-muted">No remittances recorded yet.</p>}
        </Card>
      </div>
    </>
  );
}
