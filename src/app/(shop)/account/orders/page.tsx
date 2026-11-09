import Link from "next/link";
import { Package } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrderList } from "@/components/account/order-list";
import { EmptyState } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "Your orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser("/account/orders");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const take = 10;
  const [orders, total] = await Promise.all([
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take, include: { items: { select: { image: true, name: true, quantity: true } } } }),
    db.order.count({ where: { userId: user.id } }),
  ]);
  if (!total) return <EmptyState icon={<Package className="h-10 w-10" strokeWidth={1.2} />} title="No orders yet" action={<Link href="/shop" className={buttonClass()}>Start shopping</Link>} />;
  return (
    <div>
      <h2 className="mb-4 text-[18px] font-semibold">Orders ({total})</h2>
      <OrderList orders={orders} />
      <div className="mt-6 flex justify-between">
        {page > 1 ? <Link href={`?page=${page - 1}`} className={buttonClass("secondary", "sm")}>← Newer</Link> : <span />}
        {page * take < total && <Link href={`?page=${page + 1}`} className={buttonClass("secondary", "sm")}>Older →</Link>}
      </div>
    </div>
  );
}
