import { can } from "@/lib/permissions";
import Image from "next/image";
import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import type { Prisma, ProductStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { AdminPager, Card, PageHeader, Pill, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Products" };
const TAKE = 30;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string; page?: string }> }) {
  const user = await requirePermission("catalog.view");
  const canEdit = can(user, "catalog.edit");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ProductWhereInput = {};
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, { brand: { contains: sp.q, mode: "insensitive" } }, { variants: { some: { sku: { equals: sp.q, mode: "insensitive" } } } }];
  if (["DRAFT", "ACTIVE", "ARCHIVED"].includes(sp.status ?? "")) where.status = sp.status as ProductStatus;
  if (sp.category) where.category = { OR: [{ id: sp.category }, { parentId: sp.category }] };

  const [products, total, cats] = await Promise.all([
    db.product.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * TAKE, take: TAKE, include: { category: { select: { name: true, parent: { select: { name: true } } } }, images: { take: 1, orderBy: { position: "asc" } }, _count: { select: { variants: true } } } }),
    db.product.count({ where }),
    db.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" } }),
  ]);
  const stocks = await db.variant.groupBy({ by: ["productId"], where: { productId: { in: products.map((p) => p.id) } }, _sum: { stock: true } });
  const outs = await db.variant.groupBy({ by: ["productId"], where: { productId: { in: products.map((p) => p.id) }, stock: 0 }, _count: { _all: true } });
  const qs = (p: number) => `/admin/products?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), ...(sp.category ? { category: sp.category } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Products" description={`${total} products`} actions={<div className="flex flex-wrap gap-2">{canEdit && <Link href="/admin/products/import" className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-4 text-[14px] hover:border-ink">Import / export</Link>}<Link href="/admin/products/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-[14px] text-white"><Plus className="h-4 w-4" /> Add product</Link></div>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" aria-label="Search products" defaultValue={sp.q} placeholder="Search name, brand or exact SKU" className="h-10 w-full max-w-xs rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink" />
        <select name="status" aria-label="Status" defaultValue={sp.status ?? ""} className="h-10 rounded-md border border-line bg-white px-3 text-[14px]"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></select>
        <select name="category" aria-label="Department" defaultValue={sp.category ?? ""} className="h-10 rounded-md border border-line bg-white px-3 text-[14px]"><option value="">All departments</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button className="h-10 rounded-md bg-ink px-4 text-[14px] text-white">Filter</button>
      </form>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="border-b border-line bg-cloud/40"><tr><Th>Product</Th><Th>Category</Th><Th>Status</Th><Th className="text-right">Price</Th><Th className="text-right">Stock</Th></tr></thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => {
                const s = stocks.find((x) => x.productId === p.id)?._sum.stock ?? 0;
                const o = outs.find((x) => x.productId === p.id)?._count._all ?? 0;
                return (
                  <tr key={p.id} className="hover:bg-cloud/40">
                    <Td>
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                        <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-cloud">{p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="36px" className="object-cover" />}</div>
                        <div><p className="font-medium hover:underline">{p.name}</p><p className="text-[12.5px] text-muted">{p.brand} · {p._count.variants} variants</p></div>
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">{p.category.parent?.name} / {p.category.name}</Td>
                    <Td><Pill tone={p.status === "ACTIVE" ? "success" : p.status === "DRAFT" ? "warn" : "neutral"}>{p.status.toLowerCase()}</Pill></Td>
                    <Td className="text-right tabular-nums">{formatPrice(p.price)}{p.compareAtPrice && <p className="text-[12px] text-muted line-through">{formatPrice(p.compareAtPrice)}</p>}</Td>
                    <Td className="text-right tabular-nums"><span className={s === 0 ? "text-danger" : ""}>{s}</span>{o > 0 && <p className="text-[12px] text-warn">{o} sizes out</p>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AdminPager page={page} pages={Math.max(1, Math.ceil(total / TAKE))} href={qs} />
      </Card>
    </>
  );
}
