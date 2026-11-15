import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { scopeFor, canActAt } from "@/lib/scope";
import { getLocations } from "@/lib/stock";
import { getCategoryTree } from "@/lib/catalog";
import { countNo } from "@/lib/counts";
import { formatDateTime } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { StartCount } from "@/components/admin/start-count";

export const metadata = { title: "Stock counts" };

const LABEL = { COUNTING: "Counting", SUBMITTED: "Waiting for approval", APPROVED: "Approved", CANCELLED: "Cancelled" } as const;
const TONE = { COUNTING: "warn", SUBMITTED: "warn", APPROVED: "success", CANCELLED: "neutral" } as const;

export default async function CountsPage() {
  const me = await requirePermission("stock.count");
  const scope = await scopeFor(me);
  const [all, tree, counts] = await Promise.all([
    getLocations(),
    getCategoryTree(),
    db.stockCount.findMany({
      where: scope.all ? {} : { storeId: { in: scope.storeIds } },
      orderBy: { createdAt: "desc" }, take: 50,
      include: { store: { select: { name: true } }, _count: { select: { lines: true } }, lines: { where: { counted: { not: null } }, select: { id: true } } },
    }),
  ]);
  const locations = all.filter((l) => canActAt(scope, l.id));
  const categories = tree.flatMap((r) => [{ id: r.id, name: r.name }, ...r.children.map((c) => ({ id: c.id, name: `${r.name} / ${c.name}` }))]);
  return (
    <>
      <PageHeader title="Stock counts" description="Count what's really on the shelves. Counting is blind and the shop stays open: sales during the count are allowed for. A manager approves the differences before stock changes." />
      {locations.length
        ? <Card title="Start a count" className="mb-4"><StartCount locations={locations.map((l) => ({ id: l.id, name: l.name }))} categories={categories} /></Card>
        : <p className="mb-4 rounded-lg border border-line bg-white p-5 text-[14px] text-muted">You&apos;re not assigned to a location yet, so you can&apos;t start a count. Ask the owner to add you under Customers &amp; team.</p>}
      <Card title="Counts">
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[12px] uppercase tracking-wider text-muted"><th className="px-4 py-2.5">Count</th><th className="px-3">Location · scope</th><th className="px-3 text-right">Counted</th><th className="px-3">Status</th><th className="px-3">Started</th></tr></thead>
            <tbody className="divide-y divide-line">
              {counts.map((c) => (
                <tr key={c.id} className="hover:bg-cloud/40">
                  <td className="px-4 py-2.5"><Link href={`/admin/counts/${c.id}`} className="font-mono font-medium underline">{countNo(c.number)}</Link></td>
                  <td className="px-3">{c.store.name} · <span className="text-muted">{c.scopeLabel}</span></td>
                  <td className="px-3 text-right tabular-nums">{c.lines.length} / {c._count.lines}</td>
                  <td className="px-3"><Pill tone={TONE[c.status]}>{LABEL[c.status]}</Pill></td>
                  <td className="px-3 text-muted">{formatDateTime(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!counts.length && <p className="p-10 text-center text-muted">No counts yet. Start with one category at one shop: a cycle count takes minutes.</p>}
        </div>
      </Card>
    </>
  );
}
