import Image from "next/image";
import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime, formatOrderNumber, formatPrice, now as nowMs } from "@/lib/utils";
import { Card, PageHeader, StatusPill } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { can } from "@/lib/permissions";
import { profitAndLoss, stockValuation } from "@/lib/finance";
import { ktmDate } from "@/lib/pos";

export const metadata = { title: "Dashboard" };

const DAY = 86400000;

export default async function Dashboard() {
  const me = await requirePermission("dashboard");
  const now = nowMs();
  const since30 = new Date(now - 30 * DAY);
  const since60 = new Date(now - 60 * DAY);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const live = { status: { notIn: ["CANCELLED", "RETURNED"] } } satisfies Prisma.OrderWhereInput;

  const [cur, prev, todayAgg, queue, daily, recent, lowStock, top, newCustomers] = await Promise.all([
    db.order.aggregate({ where: { ...live, createdAt: { gte: since30 } }, _sum: { total: true }, _count: { _all: true } }),
    db.order.aggregate({ where: { ...live, createdAt: { gte: since60, lt: since30 } }, _sum: { total: true }, _count: { _all: true } }),
    db.order.aggregate({ where: { ...live, createdAt: { gte: today } }, _sum: { total: true }, _count: { _all: true } }),
    db.order.groupBy({ by: ["status"], where: { status: { in: ["PENDING", "CONFIRMED", "PACKED", "RETURN_REQUESTED"] } }, _count: { _all: true } }),
    db.$queryRaw<{ day: Date; revenue: bigint; orders: bigint }[]>`
      SELECT d::date AS day, COALESCE(SUM(o.total),0)::bigint AS revenue, COUNT(o.id)::bigint AS orders
      FROM generate_series((now() AT TIME ZONE 'Asia/Kathmandu')::date - 29, (now() AT TIME ZONE 'Asia/Kathmandu')::date, '1 day') d
      LEFT JOIN "Order" o ON (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kathmandu')::date = d::date AND o.status NOT IN ('CANCELLED','RETURNED')
      GROUP BY d ORDER BY d`,
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, email: true, total: true, status: true, createdAt: true, shippingAddress: true } }),
    db.variant.findMany({ where: { stock: { lte: 3 }, product: { status: "ACTIVE" } }, orderBy: [{ stock: "asc" }], take: 8, include: { product: { select: { name: true, id: true } } } }),
    db.orderItem.groupBy({ by: ["productId", "name"], where: { order: { ...live, createdAt: { gte: since30 } } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: since30 } } }),
  ]);

  const rev = cur._sum.total ?? 0, prevRev = prev._sum.total ?? 0;
  const aov = cur._count._all ? Math.round(rev / cur._count._all) : 0;
  const prevAov = prev._count._all ? Math.round(prevRev / prev._count._all) : 0;
  const delta = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);
  const q = Object.fromEntries(queue.map((x) => [x.status, x._count._all]));
  const showFinance = can(me.role, "finance");
  const [pl, stock] = showFinance
    ? await Promise.all([profitAndLoss(since30, new Date(now + 60_000), ktmDate(since30), "9999-12-31"), stockValuation()])
    : [null, null];
  const topImgs = await db.productImage.findMany({ where: { productId: { in: top.map((t) => t.productId) }, position: 0 }, select: { productId: true, url: true } });

  const kpis = [
    { label: "Revenue · 30 days", value: formatPrice(rev), d: delta(rev, prevRev) },
    { label: "Orders · 30 days", value: cur._count._all.toLocaleString("en-IN" /* lakh grouping, as used in Nepal */), d: delta(cur._count._all, prev._count._all) },
    { label: "Avg. order value", value: formatPrice(aov), d: delta(aov, prevAov) },
    { label: "Today", value: formatPrice(todayAgg._sum.total ?? 0), sub: `${todayAgg._count._all} orders` },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description={`${newCustomers} new customers in the last 30 days`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <p className="text-[13px] text-muted">{k.label}</p>
            <p className="mt-1.5 whitespace-nowrap text-[21px] font-semibold tabular-nums tracking-tight xl:text-[24px]">{k.value}</p>
            {k.d != null ? <p className={`text-[12.5px] ${k.d >= 0 ? "text-success" : "text-danger"}`}>{k.d >= 0 ? "▲" : "▼"} {Math.abs(k.d)}% vs previous 30 days</p> : <p className="text-[12.5px] text-muted">{k.sub}</p>}
          </Card>
        ))}
      </div>

      {pl && stock && (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Gross profit · 30 days", formatPrice(pl.grossProfit), `${pl.grossMargin}% margin on net sales`],
            ["Net profit · 30 days", formatPrice(pl.netProfit), `after ${formatPrice(pl.totalExpenses)} expenses`],
            ["Stock value at cost", formatPrice(stock.atCost), `${stock.units.toLocaleString("en-IN")} units on hand`],
            ["Returns & refunds · 30 days", formatPrice(pl.refunds), pl.unitsWithoutCost ? `${pl.unitsWithoutCost} units sold without cost` : "all sales costed"],
          ].map(([l, v, sub]) => (
            <Link key={l} href="/admin/finance" className="rounded-lg border border-line bg-white p-5 hover:border-ink">
              <p className="text-[13px] text-muted">{l}</p>
              <p className="mt-1.5 whitespace-nowrap text-[21px] font-semibold tabular-nums tracking-tight xl:text-[24px]">{v}</p>
              <p className="text-[12.5px] text-muted">{sub}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["PENDING", "To confirm"], ["CONFIRMED", "To pack"], ["PACKED", "To ship"], ["RETURN_REQUESTED", "Returns to process"]].map(([s, l]) => (
          <Link key={s} href={`/admin/orders?status=${s}`} className="group flex items-center justify-between rounded-lg border border-line bg-white p-4 hover:border-ink">
            <div><p className="text-[13px] text-muted">{l}</p><p className="text-[22px] font-semibold tabular-nums">{q[s] ?? 0}</p></div>
            <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Daily revenue · last 30 days" className="xl:col-span-2">
          <RevenueChart data={daily.map((d) => ({ day: new Date(d.day).toISOString(), revenue: Number(d.revenue), orders: Number(d.orders) }))} />
        </Card>
        <Card title="Top sellers · 30 days">
          <ul className="divide-y divide-line">
            {top.map((t, i) => {
              const im = topImgs.find((x) => x.productId === t.productId)?.url;
              return (
                <li key={t.productId} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-4 text-[13px] text-muted">{i + 1}</span>
                  <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded bg-cloud">{im && <Image src={im} alt="" fill sizes="32px" className="object-cover" />}</div>
                  <Link href={`/admin/products/${t.productId}`} className="flex-1 truncate text-[14px] hover:underline">{t.name}</Link>
                  <span className="text-[13.5px] tabular-nums text-muted">{t._sum.quantity} sold</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Recent orders" className="xl:col-span-2" action={<Link href="/admin/orders" className="text-[13px] underline">View all</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <tbody className="divide-y divide-line">
                {recent.map((o) => (
                  <tr key={o.id} className="hover:bg-cloud/50">
                    <td className="px-5 py-3"><Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">{formatOrderNumber(o.number)}</Link></td>
                    <td className="px-5 py-3 text-ink-soft">{(o.shippingAddress as { fullName?: string })?.fullName ?? o.email}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDateTime(o.createdAt)}</td>
                    <td className="px-5 py-3"><StatusPill status={o.status} /></td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Low stock" action={<Link href="/admin/inventory?filter=low" className="text-[13px] underline">Manage</Link>}>
          {lowStock.length === 0 ? <p className="p-5 text-[14px] text-muted">All good — nothing running low.</p> : (
            <ul className="divide-y divide-line">
              {lowStock.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-5 py-2.5 text-[13.5px]">
                  <AlertTriangle className={`h-4 w-4 shrink-0 ${v.stock === 0 ? "text-danger" : "text-warn"}`} />
                  <div className="min-w-0 flex-1"><p className="truncate">{v.product.name}</p><p className="text-[12px] text-muted">{v.color} · {v.size} · {v.sku}</p></div>
                  <span className={`font-semibold tabular-nums ${v.stock === 0 ? "text-danger" : "text-warn"}`}>{v.stock === 0 ? "Out" : v.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
