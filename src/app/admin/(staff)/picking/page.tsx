import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { cn, formatDateTime, formatOrderNumber } from "@/lib/utils";
import { getLocations } from "@/lib/stock";
import { getPickList, pickCounts } from "@/lib/picking";
import { scopeFor, canActAt } from "@/lib/scope";
import { Card, PageHeader } from "@/components/admin/ui";
import { PickButton } from "@/components/admin/pick-button";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Pick lists" };

export default async function PickingPage({ searchParams }: { searchParams: Promise<{ at?: string }> }) {
  const me = await requirePermission("orders");
  const sp = await searchParams;
  const [all, counts, scope] = await Promise.all([getLocations(), pickCounts(), scopeFor(me)]);
  const locations = all.filter((l) => canActAt(scope, l.id)); // pick lists only for where you work
  // default: the location with the most waiting, else the first
  const busiest = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const here = locations.find((l) => l.id === sp.at) ?? locations.find((l) => l.id === busiest) ?? locations[0];
  if (!here) return <PageHeader title="Pick lists" description={all.length ? "You're not assigned to a location yet. Ask the owner to add you under Customers & team." : "Add a location first."} />;
  const list = await getPickList(here.id);

  return (
    <>
      <PageHeader
        title={`Pick list · ${here.name}`}
        description="Confirmed online orders whose items come from this location. Walk the shelves once using the SKU list, then tick each order off as you bag it."
      />
      <nav className="mb-4 flex flex-wrap gap-2 print:hidden" aria-label="Location">
        {locations.map((l) => (
          <Link key={l.id} href={`/admin/picking?at=${l.id}`} className={cn("rounded-md px-3 py-1.5 text-[13.5px]", l.id === here.id ? "bg-ink text-white" : "border border-line bg-white hover:border-ink")}>
            {l.name} ({counts.get(l.id) ?? 0})
          </Link>
        ))}
      </nav>
      {!list.units ? (
        <p className="rounded-lg border border-line bg-white p-10 text-center text-muted">Nothing to pick here. Orders appear once they&apos;re confirmed.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={`1 · Collect ${list.units} unit${list.units === 1 ? "" : "s"}`}>
            <table className="w-full text-[14px]">
              <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[12px] uppercase tracking-wider text-muted"><th className="px-4 py-2">Bin</th><th className="px-3">SKU</th><th className="px-3">Item</th><th className="px-3 text-right">Qty</th><th className="w-8 print:table-cell" aria-label="Tick" /></tr></thead>
              <tbody className="divide-y divide-line">
                {list.skus.map((s) => (
                  <tr key={s.sku}>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-[13px] font-semibold">{s.bin?.code ?? <span className="font-sans text-[12px] font-normal text-warn">no bin</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[12.5px]">{s.sku}</td>
                    <td className="px-3">{s.name} · {s.color} <b>{s.size}</b><span className="block text-[12px] text-muted">for {s.orders.map((n) => formatOrderNumber(n)).join(", ")}</span></td>
                    <td className="px-3 text-right text-[16px] font-semibold tabular-nums">{s.quantity}</td>
                    <td className="px-2"><span className="inline-block h-4 w-4 rounded border border-line" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title={`2 · Bag ${list.orders.length} order${list.orders.length === 1 ? "" : "s"}`}>
            <ul className="divide-y divide-line">
              {list.orders.map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 text-[13.5px]">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium underline">{formatOrderNumber(o.number)}</Link>
                    <span className="ml-2 text-[12px] text-muted">{formatDateTime(o.createdAt)}{o.district ? ` · ${o.district}` : ""}{o.shippingMethod === "express" ? " · EXPRESS" : ""}</span>
                    {o.pickup && <p className={cn("mt-0.5 text-[12.5px] font-medium", o.pickup.id === here.id ? "text-success" : "text-warn")}>{o.pickup.id === here.id ? "Click-and-collect here: keep at the counter" : `Click-and-collect: send to ${o.pickup.name}`}</p>}
                    <ul className="mt-1 text-[13px]">{o.lines.map((l, i) => <li key={i}>{l.quantity} × {l.name} · {l.color} {l.size} <span className="font-mono text-[11.5px] text-muted">{l.sku}{l.bin ? ` · ${l.bin}` : ""}</span></li>)}</ul>
                  </div>
                  <PickButton orderId={o.id} storeId={here.id} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
      <div className="print:hidden">{list.units > 0 && <PrintButton />}</div>
    </>
  );
}
