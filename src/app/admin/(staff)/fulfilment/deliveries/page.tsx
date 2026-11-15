import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { store as storeCfg } from "@/lib/config";
import { scopeFor, storeFilter } from "@/lib/scope";
import { deliveriesDesk, REASON_LABEL, REASONS } from "@/lib/deliveries";
import { cn, formatOrderNumber, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { ParcelActions, ParcelTable, ReceiveReturn } from "@/components/admin/delivery-forms";

export const metadata = { title: "Deliveries" };

export default async function DeliveriesPage() {
  const me = await requirePermission("orders");
  const scope = await scopeFor(me);
  const [d, locations] = await Promise.all([deliveriesDesk(scope), db.store.findMany({ where: { active: true, ...storeFilter(scope) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true, kind: true } })]);
  const reasons = REASONS.map((r) => ({ value: r, label: REASON_LABEL[r] }));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "—");
  const tiles: [string, string, boolean][] = [
    ["With couriers", String(d.parcels.length), false],
    ["Stuck", String(d.stuck), d.stuck > 0],
    ["Coming back", String(d.returning.length), d.returning.some((r) => r.chase)],
    ["Returned, 90 days", `${d.rate.pct}% (${d.rate.returned} of ${d.rate.shipped})`, d.rate.pct >= 10],
  ];
  return (
    <>
      <Link href="/admin/fulfilment" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Fulfilment</Link>
      <PageHeader title="Deliveries" description={`Parcels with couriers. Record failed attempts as the courier reports them (the customer gets an SMS to call us), bring back what won't be delivered, and scan returns in where they arrive. Stuck = not delivered ${storeCfg.delivery.stuckDays}+ days after hand-over.`} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([l, v, warn]) => (
          <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className={cn("mt-1 text-[20px] font-semibold tabular-nums", warn && "text-warn")}>{v}</p></div></Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card title="With couriers (oldest first)">
          {!d.parcels.length ? <p className="p-5 text-[14px] text-muted">No parcels are with couriers.</p> : (
            <ParcelTable reasons={reasons} rows={d.parcels.map((p) => ({ id: p.id, number: p.number, status: p.status, carrier: p.carrier, trackingNumber: p.trackingNumber, name: p.name, district: p.district, cod: p.cod, days: p.days, stuck: p.stuck, attempts: p.attempts, lastReason: p.lastReason ? REASON_LABEL[p.lastReason] : null }))} />
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Receive a returned parcel">{locations.length ? <ReceiveReturn locations={locations} defaultStoreId={(locations.find((l) => l.kind === "WAREHOUSE") ?? locations[0]).id} /> : <p className="p-5 text-[14px] text-muted">You aren&apos;t assigned to a location.</p>}</Card>
          <Card title={`Coming back · ${d.returning.length}`}>
            {!d.returning.length ? <p className="p-5 text-[14px] text-muted">Nothing on its way back.</p> : (
              <ul className="divide-y divide-line text-[13.5px]">{d.returning.map((r) => (
                <li key={r.orderId} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <span><Link href={`/admin/orders/${r.orderId}`} className="font-mono hover:underline">{formatOrderNumber(r.order.number)}</Link> · {r.carrier}<span className="block text-[11.5px] text-muted">{REASON_LABEL[r.reason]}{r.order.trackingNumber ? ` · ${r.order.trackingNumber}` : ""}</span></span>
                    <span className="shrink-0 text-right">{r.chase ? <Pill tone="warn">{r.days} days: chase</Pill> : <span className="text-[12px] text-muted">{r.days} day{r.days === 1 ? "" : "s"}</span>}</span>
                  </div>
                  <div className="mt-1"><ParcelActions orderId={r.orderId} reasons={reasons} /></div>
                </li>
              ))}</ul>
            )}
          </Card>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Returned by courier (90 days)">
          <table className="w-full text-[13.5px]"><tbody className="divide-y divide-line">{d.byCarrier.map((c) => (
            <tr key={c.carrier}><td className="px-4 py-2">{c.carrier}</td><td className="px-3 text-right tabular-nums text-muted">{c.returned} of {c.shipped}</td><td className={cn("px-4 text-right font-semibold tabular-nums", c.shipped > 0 && c.returned / c.shipped >= 0.1 && "text-warn")}>{pct(c.returned, c.shipped)}</td></tr>
          ))}{!d.byCarrier.length && <tr><td className="p-5 text-muted">Nothing shipped in 90 days.</td></tr>}</tbody></table>
        </Card>
        <Card title="Districts returning the most">
          <table className="w-full text-[13.5px]"><tbody className="divide-y divide-line">{d.byDistrict.map((c) => (
            <tr key={c.district}><td className="px-4 py-2">{c.district}</td><td className="px-3 text-right tabular-nums text-muted">{c.returned} of {c.shipped}</td><td className="px-4 text-right font-semibold tabular-nums">{pct(c.returned, c.shipped)}</td></tr>
          ))}{!d.byDistrict.length && <tr><td className="p-5 text-muted">No returns in 90 days.</td></tr>}</tbody></table>
        </Card>
        <Card title="Why parcels came back">
          {d.reasons.length ? <ul className="divide-y divide-line text-[13.5px]">{d.reasons.map((r) => <li key={r.reason} className="flex justify-between px-4 py-2"><span>{REASON_LABEL[r.reason]}</span><span className="tabular-nums">{r.count}</span></li>)}</ul> : <p className="p-5 text-[14px] text-muted">No returns in 90 days.</p>}
          <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-muted">Courier return fees {formatPrice(d.fees)} · lost-parcel claims {formatPrice(d.claims)}</p>
        </Card>
      </div>
    </>
  );
}
