import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { scopeFor, storeFilter } from "@/lib/scope";
import { binOverview } from "@/lib/bins";
import { cn } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { BulkBins, ScanAssign } from "@/components/admin/bin-forms";

export const metadata = { title: "Bins" };

export default async function BinsPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const me = await requirePermission("stock.count");
  const locations = await db.store.findMany({ where: { active: true, ...storeFilter(await scopeFor(me)) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true, kind: true } });
  const want = (await searchParams).store;
  const here = locations.find((l) => l.id === want) ?? locations.find((l) => l.kind === "WAREHOUSE") ?? locations[0];
  if (!here) return <PageHeader title="Bins" description="You aren't assigned to a location." />;
  const o = await binOverview(here.id);
  const pct = o.units.total ? Math.round((o.units.binned / o.units.total) * 100) : 0;
  return (
    <>
      <PageHeader title={`Bins · ${here.name}`} description="Where each size lives on the shelves. Pick lists, putaway and count sheets walk the bins in order, so one pass covers the floor." />
      {locations.length > 1 && <div className="mb-4 flex flex-wrap gap-1.5">{locations.map((l) => <Link key={l.id} href={`/admin/bins?store=${l.id}`} className={cn("rounded-full border px-3 py-1 text-[13px]", l.id === here.id ? "border-ink bg-ink text-white" : "border-line bg-white")}>{l.name}</Link>)}</div>}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Bins", String(o.bins.length)], ["Stock with a bin", `${pct}%`], ["Sizes in stock with no bin", String(o.unbinnedCount)], ["Units in stock", o.units.total.toLocaleString("en-IN")]].map(([l, v]) => (
          <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className={cn("mt-1 text-[20px] font-semibold tabular-nums", l.startsWith("Sizes") && o.unbinnedCount > 0 && "text-warn")}>{v}</p></div></Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Card title="Scan into a bin"><ScanAssign storeId={here.id} /></Card>
          <Card title="Set up many at once"><BulkBins storeId={here.id} /></Card>
        </div>
        <div className="space-y-4">
          <Card title={`In stock, no bin yet · ${o.unbinnedCount}`}>
            {!o.unbinned.length ? <p className="p-5 text-[14px] text-muted">Every size in stock here has a bin.</p> : (
              <ul className="max-h-96 divide-y divide-line overflow-y-auto">{o.unbinned.map((u) => <li key={u.variantId} className="flex justify-between gap-3 px-5 py-2 text-[13.5px]"><span><span className="font-mono">{u.sku}</span> · {u.name} {u.color} {u.size}</span><span className="tabular-nums text-muted">{u.quantity}</span></li>)}</ul>
            )}
          </Card>
          <Card title="Bins">
            {!o.bins.length ? <p className="p-5 text-[14px] text-muted">No bins yet.</p> : (
              <ul className="max-h-96 divide-y divide-line overflow-y-auto">{o.bins.map((b) => <li key={b.id} className="flex justify-between gap-3 px-5 py-2 text-[13.5px]"><span className="font-mono font-semibold">{b.code}</span><span className="text-muted">{b.sizes} size{b.sizes === 1 ? "" : "s"} · {b.units} unit{b.units === 1 ? "" : "s"}</span></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
