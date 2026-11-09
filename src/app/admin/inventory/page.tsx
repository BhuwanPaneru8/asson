import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { scopeFor, canActAt } from "@/lib/scope";
import { defaultReceivingLocation, getLocations } from "@/lib/stock";
import { AdminPager, Card, PageHeader } from "@/components/admin/ui";
import { StockRow } from "@/components/admin/stock-row";
import { cn } from "@/lib/utils";

export const metadata = { title: "Inventory" };
const TAKE = 50;
const LOW = 5;

export default async function Inventory({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string; at?: string }> }) {
  const me = await requirePermission("catalog.view");
  const canAdjust = can(me.role, "inventory.adjust");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [locations, main, scope] = await Promise.all([getLocations(), defaultReceivingLocation(), scopeFor(me)]);
  // everyone may see stock everywhere; adjusting is only at their own locations
  const mine = locations.filter((l) => canActAt(scope, l.id));
  const here = locations.find((l) => l.id === sp.at);

  // low / out of stock: at the chosen location, else across the business
  const live = { product: { status: { not: "ARCHIVED" as const } } };
  const lowW: Prisma.VariantWhereInput = here ? { storeStock: { some: { storeId: here.id, quantity: { gt: 0, lte: LOW } } } } : { stock: { gt: 0, lte: LOW } };
  const outW: Prisma.VariantWhereInput = here ? { NOT: { storeStock: { some: { storeId: here.id, quantity: { gt: 0 } } } } } : { stock: 0 };
  const where: Prisma.VariantWhereInput = { ...live, ...(sp.filter === "low" ? lowW : sp.filter === "out" ? outW : {}) };
  if (sp.q) where.OR = [{ sku: { contains: sp.q, mode: "insensitive" } }, { product: { name: { contains: sp.q, mode: "insensitive" } } }];
  const unitsWhere: Prisma.StoreStockWhereInput = { variant: { product: { status: "ACTIVE" } }, ...(here ? { storeId: here.id } : {}) };

  const [rows, total, units, out, low] = await Promise.all([
    db.variant.findMany({ where, orderBy: [{ stock: "asc" }, { sku: "asc" }], skip: (page - 1) * TAKE, take: TAKE, include: { product: { select: { id: true, name: true } }, storeStock: { select: { storeId: true, quantity: true } } } }),
    db.variant.count({ where }),
    db.storeStock.aggregate({ where: unitsWhere, _sum: { quantity: true } }),
    db.variant.count({ where: { ...outW, product: { status: "ACTIVE" } } }),
    db.variant.count({ where: { ...lowW, product: { status: "ACTIVE" } } }),
  ]);
  // one column per location while it fits; otherwise just the chosen one
  const columns = here && locations.length > 4 ? [here] : locations;
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ at: here?.id, filter: sp.filter, q: sp.q, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/inventory${s ? `?${s}` : ""}`;
  };
  const tab = (f: string | undefined, l: string, n?: number) => (
    <Link href={qs({ filter: f, page: undefined })} className={cn("rounded-md px-3 py-1.5 text-[13.5px]", sp.filter === f ? "bg-ink text-white" : "border border-line bg-white hover:border-ink")}>{l}{n != null && ` (${n})`}</Link>
  );
  return (
    <>
      <PageHeader title="Inventory" description={`${(units._sum.quantity ?? 0).toLocaleString("en-IN" /* lakh grouping, as used in Nepal */)} units on hand ${here ? `at ${here.name}` : "across all locations"}. Every adjustment is logged against a location.`} />
      {locations.length > 1 && (
        <nav className="mb-3 flex flex-wrap gap-2" aria-label="Location">
          <Link href={qs({ at: undefined, page: undefined })} className={cn("rounded-md px-3 py-1.5 text-[13.5px]", !here ? "bg-ink text-white" : "border border-line bg-white hover:border-ink")}>All locations</Link>
          {locations.map((l) => <Link key={l.id} href={qs({ at: l.id, page: undefined })} className={cn("rounded-md px-3 py-1.5 text-[13.5px]", here?.id === l.id ? "bg-ink text-white" : "border border-line bg-white hover:border-ink")}>{l.name}</Link>)}
        </nav>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab(undefined, "All SKUs")}{tab("low", "Low stock", low)}{tab("out", "Out of stock", out)}
        <form className="ml-auto flex gap-2">
          {here && <input type="hidden" name="at" value={here.id} />}
          {sp.filter && <input type="hidden" name="filter" value={sp.filter} />}
          <input name="q" defaultValue={sp.q} placeholder="SKU or product name" aria-label="Search SKU or product" className="h-9 w-56 rounded-md border border-line bg-white px-3 text-[13.5px] outline-none focus:border-ink" />
          <button className="h-9 rounded-md bg-ink px-3 text-[13.5px] text-white">Search</button>
        </form>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="border-b border-line bg-cloud/40">
              <tr className="text-left text-[12px] uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5">SKU</th><th className="px-4">Product</th><th className="px-4">Variant</th>
                {locations.length > 1 && columns.map((l) => <th key={l.id} className={cn("px-3 text-right", here?.id === l.id && "text-ink")}>{l.code}</th>)}
                <th className="px-4 text-right">Total</th><th className="px-4">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((v) => (
                <StockRow
                  key={v.id}
                  canAdjust={canAdjust && mine.length > 0}
                  locations={mine.map((l) => ({ id: l.id, code: l.code, name: l.name }))}
                  adjustAt={here && canActAt(scope, here.id) ? here.id : canActAt(scope, main.id) ? main.id : mine[0]?.id ?? main.id}
                  columns={locations.length > 1 ? columns.map((l) => ({ id: l.id, quantity: v.storeStock.find((s) => s.storeId === l.id)?.quantity ?? 0, highlight: here?.id === l.id })) : []}
                  v={{ id: v.id, sku: v.sku, stock: v.stock, color: v.color, colorHex: v.colorHex, size: v.size, productId: v.product.id, productName: v.product.name }}
                />
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-10 text-center text-muted">Nothing here.</p>}
        </div>
        <AdminPager page={page} pages={Math.max(1, Math.ceil(total / TAKE))} href={(p) => qs({ page: String(p) })} />
      </Card>
    </>
  );
}
