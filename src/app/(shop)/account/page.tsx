import Link from "next/link";
import { careRef, casesForUser } from "@/lib/care";
import { Package } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrderList } from "@/components/account/order-list";
import { EmptyState } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { formatOrderNumber, formatPrice } from "@/lib/utils";
import { PointsCard } from "@/components/account/points-card";
import { spendLast12Months } from "@/lib/loyalty";
import { ensureReferralCode } from "@/lib/referrals";
import { store } from "@/lib/config";
import { ReferralCard } from "@/components/account/referral-card";
import { getT } from "@/lib/i18n/server";

export default async function AccountHome() {
  const user = await requireUser();
  const { t } = await getT();
  const [orders, count, wish, spent, me, entries, spend12m] = await Promise.all([
    db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 3, include: { items: { select: { image: true, name: true, quantity: true } } } }),
    db.order.count({ where: { userId: user.id } }),
    db.wishlistItem.count({ where: { userId: user.id } }),
    db.order.aggregate({ where: { userId: user.id, status: { notIn: ["CANCELLED", "RETURNED"] } }, _sum: { total: true } }),
    db.user.findUnique({ where: { id: user.id }, select: { points: true } }),
    db.pointsEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    spendLast12Months(db, user.id),
  ]);
  const requests = await casesForUser(user.id);
  const [code, friends, referralPoints] = await Promise.all([
    ensureReferralCode(user.id),
    db.order.count({ where: { referrerId: user.id, status: { not: "CANCELLED" } } }),
    db.pointsEntry.aggregate({ where: { userId: user.id, reason: { in: ["REFERRAL", "REFERRAL_REVERSE"] } }, _sum: { delta: true } }),
  ]);
  const orderNos = new Map((await db.order.findMany({ where: { id: { in: entries.flatMap((e) => (e.orderId ? [e.orderId] : [])) } }, select: { id: true, number: true } })).map((o) => [o.id, formatOrderNumber(o.number)]));
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-3 gap-3">
        {[[t("footer.orders"), count, "/account/orders"], [t("nav.wishlist"), wish, "/account/wishlist"], [t("acc.totalSpent"), formatPrice(spent._sum.total ?? 0), "/account/orders"]].map(([l, v, h]) => (
          <Link key={l as string} href={h as string} className="min-w-0 border border-line bg-white p-3 hover:border-ink sm:p-4"><p className="truncate text-[13px] text-muted">{l}</p><p className="mt-1 whitespace-nowrap text-[clamp(1.05rem,5vw,1.5rem)] font-semibold tabular-nums">{v}</p></Link>
        ))}
      </div>
      <ReferralCard
        code={code}
        link={`${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/r/${code}`}
        friendOff={formatPrice(store.referral.friendDiscount)}
        minSpend={formatPrice(store.referral.friendMinSubtotal)}
        reward={formatPrice(store.referral.referrerPoints * store.loyalty.pointValue)}
        friends={friends}
        earned={referralPoints._sum.delta ?? 0}
      />
      <PointsCard t={t} balance={me?.points ?? 0} spend12m={spend12m} entries={entries.map((e) => ({ ...e, orderNumber: e.orderId ? orderNos.get(e.orderId) : undefined }))} />
      <section>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-[18px] font-semibold">{t("acc.recent")}</h2>{count > 3 && <Link href="/account/orders" className="text-[14px] underline underline-offset-4">{t("rail.viewAll")}</Link>}</div>
        {orders.length ? <OrderList orders={orders} t={t} /> : <EmptyState icon={<Package className="h-10 w-10" strokeWidth={1.2} />} title={t("acc.noOrders")} body={t("acc.noOrdersBody")} action={<Link href="/shop" className={buttonClass()}>{t("home.startShopping")}</Link>} />}
      </section>
      {requests.length > 0 && (
        <section>
          <h2 className="mb-4 text-[18px] font-semibold">{t("care.yourRequests")}</h2>
          <ul className="divide-y divide-line border-y border-line">{requests.map((r) => (
            <li key={r.number}><Link href={`/help/case/${r.token}`} className="flex items-center justify-between gap-3 py-3 text-[14.5px] hover:text-accent"><span className="min-w-0 truncate"><span className="text-muted">{careRef(r.number)}</span> {r.subject}</span><span className="shrink-0 text-[13px] text-muted">{t(`care.status.${r.status}`)}</span></Link></li>
          ))}</ul>
        </section>
      )}
    </div>
  );
}
