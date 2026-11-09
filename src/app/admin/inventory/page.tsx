import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AdminPager, Card, PageHeader } from "@/components/admin/ui";
import { StockRow } from "@/components/admin/stock-row";
import { cn } from "@/lib/utils";

export const metadata = { title: "Inventory" };
const TAKE = 50;

export default async function Inventory({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const me = await requirePermission("catalog.view");
  const canAdjust = can(me.role, "inventory.adjust");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.VariantWhereInput = { product: { status: { not: "ARCHIVED" } } };
  if (sp.filter === "low") where.stock = { gt: 0, lte: 5 };
  if (sp.filter === "out") where.stock = 0;
  if (sp.q) where.OR = [{ sku: { contains: sp.q, mode: "insensitive" } }, { product: { name: { contains: sp.q, mode: "insensitive" } } }];

  const [rows, total, units, out, low] = await Promise.all([
    db.variant.findMany({ where, orderBy: [{ stock: "asc" }, { sku: "asc" }], skip: (page - 1) * TAKE, take: TAKE, include: { product: { select: { id: true, name: true } } } }),
    db.variant.count({ where }),
    db.variant.aggregate({ where: { product: { status: "ACTIVE" } }, _sum: { stock: true } }),
    db.variant.count({ where: { stock: 0, product: { status: "ACTIVE" } } }),
    db.variant.count({ where: { stock: { gt: 0, lte: 5 }, product: { status: "ACTIVE" } } }),
  ]);
  const tab = (f: string | undefined, l: string, n?: number) => (
    <Link href={`/admin/inventory${f ? `?filter=${f}` : ""}`} className={cn("rounded-md px-3 py-1.5 text-[13.5px]", sp.filter === f ? "bg-ink text-white" : "border border-line bg-white hover:border-ink")}>{l}{n != null && ` (${n})`}</Link>
  );
  return (
    <>
      <PageHeader title="Inventory" description={`${(units._sum.stock ?? 0).toLocaleString("en-IN" /* lakh grouping, as used in Nepal */)} units on hand across live products. Every adjustment is logged.`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab(undefined, "All SKUs")}{tab("low", "Low stock", low)}{tab("out", "Out of stock", out)}
        <form className="ml-auto flex gap-2">{sp.filter && <input type="hidden" name="filter" value={sp.filter} />}<input name="q" defaultValue={sp.q} placeholder="SKU or product name" className="h-9 w-56 rounded-md border border-line bg-white px-3 text-[13.5px] outline-none focus:border-ink" /><button className="h-9 rounded-md bg-ink px-3 text-[13.5px] text-white">Search</button></form>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[12px] uppercase tracking-wider text-muted"><th className="px-4 py-2.5">SKU</th><th className="px-4">Product</th><th className="px-4">Variant</th><th className="px-4 text-right">On hand</th><th className="px-4">Adjust</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((v) => <StockRow key={v.id} canAdjust={canAdjust} v={{ id: v.id, sku: v.sku, stock: v.stock, color: v.color, colorHex: v.colorHex, size: v.size, productId: v.product.id, productName: v.product.name }} />)}
            </tbody>
          </table>
          {!rows.length && <p className="p-10 text-center text-muted">Nothing here.</p>}
        </div>
        <AdminPager page={page} pages={Math.max(1, Math.ceil(total / TAKE))} href={(p) => `/admin/inventory?${new URLSearchParams({ ...(sp.filter ? { filter: sp.filter } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
      </Card>
    </>
  );
}
