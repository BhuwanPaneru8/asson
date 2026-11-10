import Link from "next/link";
import { Package } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrderList } from "@/components/account/order-list";
import { EmptyState } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Your orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser("/account/orders");
  const { t } = await getT();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const take = 10;
  const [orders, total] = await Promise.all([
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take, include: { items: { select: { image: true, name: true, quantity: true } } } }),
    db.order.count({ where: { userId: user.id } }),
  ]);
  if (!total) return <EmptyState icon={<Package className="h-10 w-10" strokeWidth={1.2} />} title={t("acc.noOrders")} action={<Link href="/shop" className={buttonClass()}>{t("home.startShopping")}</Link>} />;
  return (
    <div>
      <h2 className="mb-4 text-[18px] font-semibold">{t("acc.ordersCount", { n: total })}</h2>
      <OrderList orders={orders} t={t} />
      <div className="mt-6 flex justify-between">
        {page > 1 ? <Link href={`?page=${page - 1}`} className={buttonClass("secondary", "sm")}>{t("acc.newer")}</Link> : <span />}
        {page * take < total && <Link href={`?page=${page + 1}`} className={buttonClass("secondary", "sm")}>{t("acc.older")}</Link>}
      </div>
    </div>
  );
}
