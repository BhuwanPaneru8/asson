import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDeliveryRates } from "@/lib/delivery";
import { store } from "@/lib/config";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui";
import { DeliveryRatesEditor } from "@/components/admin/delivery-rates-editor";

export const metadata = { title: "Delivery rates" };

export default async function DeliveryPage() {
  await requireAdmin();
  const [rates, demand] = await Promise.all([
    getDeliveryRates(),
    // where customers actually are — helps price and prioritise districts
    db.$queryRaw<{ district: string; orders: bigint; revenue: bigint }[]>`
      SELECT "shippingAddress"->>'district' AS district, COUNT(*)::bigint AS orders, COALESCE(SUM(total),0)::bigint AS revenue
      FROM "Order"
      WHERE "createdAt" > now() - interval '90 days' AND status NOT IN ('CANCELLED')
      GROUP BY 1`,
  ]);
  const stats = Object.fromEntries(demand.filter((d) => d.district).map((d) => [d.district, { orders: Number(d.orders), revenue: Number(d.revenue) }]));
  return (
    <>
      <PageHeader
        title="Delivery rates"
        description={`Set the fee and delivery time for every district. Customers see the exact price for their district on product pages, the bag and checkout. Standard delivery is free above ${formatPrice(store.shipping.freeThreshold)}; express costs ${formatPrice(store.shipping.express.fee)}.`}
      />
      <DeliveryRatesEditor initial={Object.values(rates)} stats={stats} />
    </>
  );
}
