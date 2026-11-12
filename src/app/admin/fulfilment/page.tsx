import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type Role } from "@/lib/permissions";
import { scopeFor, storeFilter } from "@/lib/scope";
import { fulfilmentOverview, waveRef } from "@/lib/fulfilment";
import { cn, formatDateTime } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { CreateWave, PackingStation } from "@/components/admin/fulfilment-forms";
import { OpenManifest } from "@/components/admin/manifest-forms";
import { manifestOverview, manifestRef } from "@/lib/manifests";
import { formatOrderNumber, formatPrice } from "@/lib/utils";

export const metadata = { title: "Fulfilment" };

export default async function FulfilmentPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const me = await requirePermission("orders");
  const locations = await db.store.findMany({ where: { active: true, ...storeFilter(await scopeFor(me)) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true, kind: true } });
  const want = (await searchParams).store;
  const here = locations.find((l) => l.id === want) ?? locations.find((l) => l.kind === "WAREHOUSE") ?? locations[0];
  if (!here) return <PageHeader title="Fulfilment" description="You aren't assigned to a location." />;
  const [o, mf] = await Promise.all([fulfilmentOverview(here.id), manifestOverview(here.id)]);
  return (
    <>
      <PageHeader title={`Fulfilment · ${here.name}`} description="Pick orders in waves (one walk, a slot per order), pack each one by scanning its items, then hand the parcels to couriers on a signed manifest." actions={<span className="flex gap-4"><Link href="/admin/fulfilment/deliveries" className="text-[13.5px] underline underline-offset-4">Deliveries</Link><Link href="/admin/fulfilment/exchanges" className="text-[13.5px] underline underline-offset-4">Exchanges</Link><Link href={`/admin/picking?store=${here.id}`} className="text-[13.5px] underline underline-offset-4">Single pick list</Link></span>} />
      {locations.length > 1 && <div className="mb-4 flex flex-wrap gap-1.5">{locations.map((l) => <Link key={l.id} href={`/admin/fulfilment?store=${l.id}`} className={cn("rounded-full border px-3 py-1 text-[13px]", l.id === here.id ? "border-ink bg-ink text-white" : "border-line bg-white")}>{l.name}</Link>)}</div>}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Orders waiting for a wave", String(o.waiting)], ["Open waves", String(o.waves.filter((w) => w.status === "OPEN").length)], ["Packed today", String(o.packedToday)], ["Packed with an override", String(o.overrides)]].map(([l, v]) => (
          <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className={cn("mt-1 text-[20px] font-semibold tabular-nums", l.startsWith("Packed with") && o.overrides > 0 && "text-warn")}>{v}</p></div></Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Packing station"><PackingStation storeId={here.id} manager={can(me.role as Role, "inventory.adjust")} /></Card>
        <div className="space-y-4">
          <Card title="Start a wave"><CreateWave storeId={here.id} waiting={o.waiting} /></Card>
          <Card title="Waves">
            {!o.waves.length ? <p className="p-5 text-[14px] text-muted">No open waves.</p> : (
              <ul className="divide-y divide-line">{o.waves.map((w) => (
                <li key={w.id}><Link href={`/admin/fulfilment/wave/${w.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40">
                  <span><b>{waveRef(w.number)}</b> · {w._count.orders} order{w._count.orders === 1 ? "" : "s"} · {formatDateTime(w.createdAt)}</span>
                  <span className="flex items-center gap-2"><span className="text-[12.5px] text-muted">{w.packed}/{w._count.orders} packed</span><Pill tone={w.status === "OPEN" ? "warn" : "success"}>{w.status === "OPEN" ? "picking" : "picked"}</Pill></span>
                </Link></li>
              ))}</ul>
            )}
          </Card>
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title={`Courier hand-over · ${mf.ready} ready to ship`}>
          <OpenManifest storeId={here.id} ready={mf.ready} />
          {mf.open.length > 0 && <ul className="divide-y divide-line border-t border-line">{mf.open.map((m) => (
            <li key={m.id}><Link href={`/admin/fulfilment/manifest/${m.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40">
              <span><b>{manifestRef(m.number)}</b> · {m.carrier}</span>
              <span className="flex items-center gap-2 text-[12.5px] text-muted">{m.parcels} parcel{m.parcels === 1 ? "" : "s"}{m.cod ? ` · COD ${formatPrice(m.cod)}` : ""}<Pill tone="warn">scanning</Pill></span>
            </Link></li>
          ))}</ul>}
          {mf.readyOrders.length > 0 && <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">Ready: {mf.readyOrders.map((r) => formatOrderNumber(r.number)).join(", ")}{mf.ready > mf.readyOrders.length ? ` and ${mf.ready - mf.readyOrders.length} more` : ""}</p>}
        </Card>
        <Card title="Handed over today">
          {!mf.today.length ? <p className="p-5 text-[14px] text-muted">No parcels handed to couriers yet today.</p> : (
            <ul className="divide-y divide-line">{mf.today.map((m) => (
              <li key={m.id}><Link href={`/admin/fulfilment/manifest/${m.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40">
                <span><b>{manifestRef(m.number)}</b> · {m.carrier} · {m.riderName}</span>
                <span className="text-[12.5px] text-muted">{m.parcels} parcels · COD {formatPrice(m.codTotal ?? 0)} · {m.handedAt ? formatDateTime(m.handedAt) : ""}</span>
              </Link></li>
            ))}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
