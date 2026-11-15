import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { canActAt, scopeFor } from "@/lib/scope";
import { wavePickList, waveRef } from "@/lib/fulfilment";
import { formatDateTime, formatOrderNumber } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { WaveActions } from "@/components/admin/fulfilment-forms";

export const metadata = { title: "Wave" };

export default async function WavePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("orders");
  const l = await wavePickList((await params).id);
  if (!l || !canActAt(await scopeFor(me), l.wave.storeId)) notFound();
  const w = l.wave;
  return (
    <>
      <PageHeader title={`${waveRef(w.number)} · ${w.store.name}`} description={`${w.orders.length} orders · ${l.units} units · started ${formatDateTime(w.createdAt)}`} actions={w.status === "OPEN" ? <WaveActions waveId={w.id} /> : <span className="flex items-center gap-3"><Pill tone={w.status === "PICKED" ? "success" : "neutral"}>{w.status.toLowerCase()}</Pill><Link href={`/admin/fulfilment?store=${w.storeId}`} className="text-[13.5px] underline underline-offset-4">Packing station</Link></span>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card title="Pick list (walk the bins in this order)">
          <table className="w-full text-[14px]">
            <thead className="border-b border-line bg-cloud/40 text-left text-[11.5px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-2">Bin</th><th className="px-3">Item</th><th className="px-3 text-right">Qty</th><th className="px-4">Into slot</th></tr></thead>
            <tbody className="divide-y divide-line">{l.lines.map((x) => (
              <tr key={x.sku} className="align-top">
                <td className="px-4 py-2.5 font-mono font-semibold">{x.bin?.code ?? <span className="font-sans text-[12px] font-normal text-warn">no bin</span>}</td>
                <td className="px-3 py-2.5">{x.name} · {x.color} <b>{x.size}</b><span className="block font-mono text-[12px] text-muted">{x.sku}</span></td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{x.quantity}</td>
                <td className="px-4 py-2.5 text-[13.5px]">{x.slots.map((s) => <span key={s.slot} className="mr-2 inline-block rounded bg-cloud px-1.5 py-0.5 tabular-nums">#{s.slot}{s.quantity > 1 ? ` ×${s.quantity}` : ""}</span>)}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
        <Card title="Slots">
          <ul className="divide-y divide-line text-[14px]">{w.orders.map((o) => (
            <li key={o.orderId} className="flex justify-between px-4 py-2"><span><b className="tabular-nums">#{o.slot}</b> · {formatOrderNumber(o.order.number)}{o.order.shippingMethod === "express" ? <span className="ml-1 text-[11px] font-semibold text-danger">EXPRESS</span> : null}</span><span className="text-[12.5px] text-muted">{o.order.status === "CONFIRMED" ? "to pack" : o.order.status.toLowerCase()}</span></li>
          ))}</ul>
        </Card>
      </div>
    </>
  );
}
