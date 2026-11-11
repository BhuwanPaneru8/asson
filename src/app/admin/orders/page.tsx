import { codRiskFor } from "@/lib/cod-risk";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/orders";
import { parseOrderNumber } from "@/lib/utils";
import { PageHeader, Card } from "@/components/admin/ui";
import { OrdersTable } from "@/components/admin/orders-table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Orders" };
const TAKE = 25;
const TABS: (OrderStatus | "ALL")[] = ["ALL", "PENDING", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "RETURNING", "DELIVERED", "RETURN_REQUESTED", "CANCELLED", "RETURNED"];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; pay?: string; call?: string }> }) {
  await requirePermission("orders");
  const sp = await searchParams;
  const status = TABS.includes(sp.status as OrderStatus) && sp.status !== "ALL" ? (sp.status as OrderStatus) : undefined;
  const q = sp.q?.trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status;
  const toCall = { status: "PENDING" as const, paymentMethod: "COD" as const, channel: "ONLINE" as const, callOutcome: { not: "CONFIRMED" as const } };
  if (sp.call === "1") Object.assign(where, toCall);
  if (sp.pay === "COD" || sp.pay === "ONLINE" || sp.pay === "IN_STORE") where.paymentMethod = sp.pay;
  if (q) {
    const n = parseOrderNumber(q);
    where.OR = [
      ...(n ? [{ number: n }] : []),
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q.replace(/\D/g, "") || q } },
      { trackingNumber: { equals: q, mode: "insensitive" } },
    ];
  }

  const [orders, total, counts, callCount] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * TAKE, take: TAKE, include: { _count: { select: { items: true } } } }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.count({ where: toCall }),
  ]);
  // COD risk for orders still waiting for their confirmation call
  const risk = await codRiskFor(orders.filter((o) => o.status === "PENDING" && o.paymentMethod === "COD" && o.channel === "ONLINE"));
  const countOf = (s: string) => (s === "ALL" ? counts.reduce((a, c) => a + c._count._all, 0) : counts.find((c) => c.status === s)?._count._all ?? 0);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ status: sp.status, q: sp.q, pay: sp.pay, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/orders${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Orders" description="Confirm, pack and ship. Select multiple orders to move them forward together." />
      <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto border-b border-line">
        <Link href="/admin/orders?call=1" className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px]", sp.call === "1" ? "border-ink font-semibold" : "border-transparent text-accent hover:text-ink")}>
          To call <span className="rounded-full bg-accent-soft px-1.5 text-[11.5px]">{callCount}</span>
        </Link>
        {TABS.map((t) => {
          const active = sp.call !== "1" && (status ?? "ALL") === t;
          return (
            <Link key={t} href={qs({ status: t === "ALL" ? undefined : t, page: undefined })} className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px]", active ? "border-ink font-semibold" : "border-transparent text-muted hover:text-ink")}>
              {t === "ALL" ? "All" : STATUS_LABEL[t]} <span className="rounded-full bg-cloud px-1.5 text-[11.5px]">{countOf(t)}</span>
            </Link>
          );
        })}
      </div>
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/orders">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Search order #, email, phone or AWB" className="h-10 w-full max-w-sm rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink" />
        <select name="pay" defaultValue={sp.pay ?? ""} className="h-10 rounded-md border border-line bg-white px-3 text-[14px]"><option value="">All payments</option><option value="COD">COD</option><option value="ONLINE">Prepaid</option><option value="IN_STORE">Store sales</option></select>
        <button className="h-10 rounded-md bg-ink px-4 text-[14px] text-white">Search</button>
        {(q || sp.pay) && <Link href={qs({ q: undefined, pay: undefined })} className="flex h-10 items-center px-2 text-[14px] underline">Clear</Link>}
      </form>
      <Card>
        <OrdersTable
          orders={orders.map((o) => ({ id: o.id, number: o.number, name: (o.shippingAddress as { fullName?: string })?.fullName ?? "", email: o.email, city: (o.shippingAddress as { city?: string })?.city ?? "", status: o.status, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, total: o.total, items: o._count.items, createdAt: o.createdAt.toISOString(), risk: risk.get(o.id) ?? null }))}
          page={page}
          pages={Math.max(1, Math.ceil(total / TAKE))}
          total={total}
        />
      </Card>
    </>
  );
}
