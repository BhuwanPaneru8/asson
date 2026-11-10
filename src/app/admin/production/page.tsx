import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { prdNo } from "@/lib/production";
import { cn, formatDate, formatPrice, now } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";

export const metadata = { title: "Production" };

const TONE = { DRAFT: "neutral", ISSUED: "warn", PARTIAL: "warn", COMPLETED: "success", CANCELLED: "neutral" } as const;
const LABEL = { DRAFT: "Draft", ISSUED: "At the workshop", PARTIAL: "Part delivered", COMPLETED: "Complete", CANCELLED: "Cancelled" } as const;
const th = "px-4 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";
const navClass = "rounded-md border border-line bg-white px-3 py-2 text-[13.5px] hover:border-ink";

export default async function ProductionPage() {
  const me = await requirePermission("production");
  const showCost = can(me.role, "finance");
  const [orders, low] = await Promise.all([
    db.productionOrder.findMany({ orderBy: [{ createdAt: "desc" }], take: 60, include: { product: { select: { name: true } }, workshop: { select: { name: true } }, store: { select: { name: true } }, lines: { select: { planned: true, received: true, rejected: true } }, receipts: { select: { unitCost: true }, orderBy: { createdAt: "desc" }, take: 1 } } }),
    db.$queryRaw<{ name: string; code: string; unit: string; have: bigint; min: number }[]>`
      SELECT m."name", m."code", m."unit", COALESCE(SUM(s."quantity"), 0) AS "have", m."minStock" AS "min"
      FROM "Material" m LEFT JOIN "MaterialStock" s ON s."materialId" = m."id"
      WHERE m."active" AND m."minStock" > 0 GROUP BY m."id" HAVING COALESCE(SUM(s."quantity"), 0) < m."minStock" ORDER BY m."name"`,
  ]);
  const open = orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED");
  const late = open.filter((o) => o.dueDate && o.dueDate.getTime() < now()).length;
  return (
    <>
      <PageHeader title="Production" description="Our own making: fabric and trims in, finished pieces out. Issue materials to a workshop, count what comes back, and every piece enters stock at its real cost."
        actions={<Link href="/admin/production/new" className="rounded-md bg-ink px-4 py-2 text-[14px] font-medium text-white">New production order</Link>} />
      <div className="mb-4 flex flex-wrap gap-2"><Link href="/admin/production/materials" className={navClass}>Fabric &amp; trims</Link><Link href="/admin/production/products" className={navClass}>Products &amp; bills of materials</Link><Link href="/admin/payables" className={navClass}>Workshop bills</Link></div>
      {low.length > 0 && (
        <Card title={`Running low (${low.length})`} className="mb-4">
          <ul className="divide-y divide-line">{low.map((m) => <li key={m.code} className="flex justify-between px-5 py-2 text-[13.5px]"><span>{m.name} <span className="text-muted">({m.code})</span></span><span className="tabular-nums text-warn">{(Number(m.have) / 1000).toLocaleString("en-IN")} {m.unit} left · reorder at {(m.min / 1000).toLocaleString("en-IN")}</span></li>)}</ul>
        </Card>
      )}
      <Card title={`Orders · ${open.length} open${late ? ` · ${late} late` : ""}`}>
        {!orders.length ? <p className="p-8 text-center text-[14px] text-muted">No production orders yet. Set up a product&apos;s bill of materials, then create an order.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Order</th><th className={th}>Product</th><th className={th}>Workshop</th><th className={cn(th, "text-right")}>Pieces</th><th className={th}>Due</th>{showCost && <th className={cn(th, "text-right")}>Cost/piece</th>}<th className={th}>Status</th></tr></thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => {
                  const planned = o.lines.reduce((s, l) => s + l.planned, 0), got = o.lines.reduce((s, l) => s + l.received, 0);
                  const isLate = o.dueDate && o.dueDate.getTime() < now() && open.includes(o);
                  return (
                    <tr key={o.id} className="hover:bg-cloud/40">
                      <td className="px-4 py-2.5"><Link href={`/admin/production/${o.id}`} className="font-medium underline-offset-4 hover:underline">{prdNo(o.number)}</Link><span className="block text-[12px] text-muted">{o.store.name}</span></td>
                      <td className="px-4 py-2.5">{o.product.name}</td>
                      <td className="px-4 py-2.5">{o.workshop.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{got} / {planned}</td>
                      <td className={cn("px-4 py-2.5", isLate && "font-medium text-danger")}>{o.dueDate ? formatDate(o.dueDate) : "—"}</td>
                      {showCost && <td className="px-4 py-2.5 text-right tabular-nums">{o.receipts[0] ? formatPrice(o.receipts[0].unitCost) : "—"}</td>}
                      <td className="px-4 py-2.5"><Pill tone={TONE[o.status]}>{LABEL[o.status]}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
