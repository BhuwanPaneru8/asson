import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { scopeFor, storeFilter } from "@/lib/scope";
import { exchangeRef, exchangesDesk } from "@/lib/exchanges";
import { cn, formatOrderNumber } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { ReceiveExchange } from "@/components/admin/exchange-forms";

export const metadata = { title: "Exchanges" };

export default async function ExchangesPage() {
  const me = await requirePermission("orders");
  const scope = await scopeFor(me);
  const [d, locations] = await Promise.all([exchangesDesk(), db.store.findMany({ where: { active: true, ...storeFilter(scope) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true, kind: true } })]);
  return (
    <>
      <Link href="/admin/fulfilment" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Fulfilment</Link>
      <PageHeader title="Exchanges" description="Customers swap sizes from their order page within the return window. The new size goes out as a free order (it's in the normal pick and pack flow); the rider collects the old item at the door. Receive the old items here when they arrive." />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Waiting for old items", String(d.open.length)], ["Last 30 days", String(d.last30.total)], ["Completed", String(d.last30.done)], ["Cancelled (kept original)", String(d.last30.cancelled)]] as const).map(([l, v]) => (
          <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className="mt-1 text-[20px] font-semibold tabular-nums">{v}</p></div></Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <Card title="Open exchanges (oldest first)">
          {!d.open.length ? <p className="p-5 text-[14px] text-muted">No exchanges waiting.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40 text-left text-[11.5px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-2">Exchange</th><th className="px-3">Customer</th><th className="px-3">Swap</th><th className="px-3">New size</th><th className="px-4 text-right">Days</th></tr></thead>
              <tbody className="divide-y divide-line">{d.open.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="px-4 py-2 font-mono">{exchangeRef(e.number)}<Link href={`/admin/orders/${e.order.id}`} className="block text-[11.5px] text-muted hover:underline">{formatOrderNumber(e.order.number)}</Link></td>
                  <td className="px-3 py-2">{e.name}</td>
                  <td className="px-3 py-2">{e.items.map((i) => <span key={i.id} className="block">{i.orderItem.name} {i.orderItem.size}{i.quantity > 1 ? ` ×${i.quantity}` : ""}</span>)}</td>
                  <td className="px-3 py-2"><Link href={`/admin/orders/${e.replacement.id}`} className="font-mono hover:underline">{formatOrderNumber(e.replacement.number)}</Link><span className="mt-0.5 block"><Pill tone={e.replacement.status === "DELIVERED" ? "success" : "neutral"}>{e.replacement.status.toLowerCase().replace(/_/g, " ")}</Pill></span></td>
                  <td className={cn("px-4 py-2 text-right tabular-nums", e.days > 14 && "font-semibold text-warn")}>{e.days}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Receive old items">{locations.length ? <ReceiveExchange locations={locations} defaultStoreId={(locations.find((l) => l.kind === "WAREHOUSE") ?? locations[0]).id} /> : <p className="p-5 text-[14px] text-muted">You aren&apos;t assigned to a location.</p>}</Card>
          <Card title="Most swapped (30 days)">
            {!d.swaps.length ? <p className="p-5 text-[14px] text-muted">No exchanges yet.</p> : <ul className="divide-y divide-line text-[13.5px]">{d.swaps.map((s) => <li key={`${s.name}${s.from}${s.to}`} className="flex justify-between px-4 py-2"><span>{s.name}: {s.from} → {s.to}</span><span className="tabular-nums">{s.n}</span></li>)}</ul>}
            <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-muted">A size swapped often in one direction usually means the size chart needs a note (e.g. &ldquo;runs small&rdquo;).</p>
          </Card>
        </div>
      </div>
    </>
  );
}
