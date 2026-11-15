import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { canActAt, scopeFor } from "@/lib/scope";
import { store as storeCfg } from "@/lib/config";
import { manifestRef, manifestView } from "@/lib/manifests";
import { cn, formatDateTime, formatOrderNumber, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { HandOver, ManifestTools, RemoveParcel, ScanParcel } from "@/components/admin/manifest-forms";

export const metadata = { title: "Courier manifest" };

export default async function ManifestPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("orders");
  const v = await manifestView((await params).id);
  if (!v || !canActAt(await scopeFor(me), v.manifest.storeId)) notFound();
  const m = v.manifest;
  const open = m.status === "OPEN";
  const tone = open ? "warn" : m.status === "HANDED_OVER" ? "success" : "neutral";
  const label = open ? "scanning" : m.status === "HANDED_OVER" ? "handed over" : "cancelled";

  const table = (
    <table className="w-full text-[13.5px]">
      <thead className="border-b border-line bg-cloud/40 text-left text-[11.5px] uppercase tracking-wider text-muted print:bg-transparent"><tr><th className="px-4 py-2">#</th><th className="px-3">Order</th><th className="px-3">Tracking</th><th className="px-3">Deliver to</th><th className="px-3 text-right">Collect (COD)</th>{!open && <th className="px-4 print:hidden">Now</th>}{open && <th className="px-4" />}</tr></thead>
      <tbody className="divide-y divide-line">{v.parcels.map((p, i) => (
        <tr key={p.orderId} className="align-top">
          <td className="px-4 py-2 tabular-nums text-muted">{i + 1}</td>
          <td className="px-3 py-2 font-mono"><Link href={`/admin/orders/${p.orderId}`} className="hover:underline">{formatOrderNumber(p.number)}</Link></td>
          <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold">{p.trackingNumber}</td>
          <td className="px-3 py-2">{p.name}<span className="block text-[12px] text-muted">{p.place}{p.phone ? ` · ${p.phone}` : ""}</span></td>
          <td className="px-3 py-2 text-right tabular-nums">{p.cod ? formatPrice(p.cod) : <span className="text-muted">prepaid</span>}</td>
          {!open && <td className="px-4 py-2 text-[12.5px] print:hidden">{p.remitted ? <Pill tone="success">paid by courier</Pill> : p.status.toLowerCase().replace(/_/g, " ")}</td>}
          {open && <td className="px-4 py-2 text-right"><RemoveParcel manifestId={m.id} orderId={p.orderId} /></td>}
        </tr>
      ))}</tbody>
      <tfoot className="border-t border-line font-semibold"><tr><td className="px-4 py-2" colSpan={4}>{v.parcels.length} parcel{v.parcels.length === 1 ? "" : "s"}</td><td className="px-3 py-2 text-right tabular-nums">{formatPrice(v.cod)}</td><td className="print:hidden" /></tr></tfoot>
    </table>
  );

  return (
    <>
      <Link href={`/admin/fulfilment?store=${m.storeId}`} className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink print:hidden"><ArrowLeft className="h-4 w-4" /> Fulfilment</Link>
      <div className="print:hidden">
        <PageHeader title={`${manifestRef(m.number)} · ${m.carrier}`} description={`${m.store.name} · opened by ${v.createdBy} ${formatDateTime(m.createdAt)}${m.handedAt ? ` · handed to ${m.riderName}${m.riderPhone ? ` (${m.riderPhone})` : ""} by ${v.handedBy} ${formatDateTime(m.handedAt)}` : ""}`} actions={<span className="flex flex-wrap items-center gap-3"><Pill tone={tone}>{label}</Pill><ManifestTools manifestId={m.id} open={open} /></span>} />
      </div>
      {/* printed header: the courier's receipt */}
      <div className="mb-4 hidden print:block">
        <div className="flex justify-between"><div><p className="text-[18px] font-semibold">{storeCfg.name} · courier manifest {manifestRef(m.number)}</p><p className="text-[12px]">{m.store.name} · {m.store.address}{m.store.phone ? ` · ${m.store.phone}` : ""}</p></div><div className="text-right text-[12px]"><p className="font-semibold">{m.carrier}</p><p>{formatDateTime(m.handedAt ?? new Date())}</p></div></div>
      </div>
      {!open && m.status === "HANDED_OVER" && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
          {[["Parcels", String(m.parcels)], ["COD to collect", formatPrice(m.codTotal ?? 0)], ["Delivered", `${v.delivered} of ${v.parcels.length}`], ["Paid by the courier", `${v.remitted} of ${v.parcels.filter((p) => p.cod).length}`]].map(([l, x]) => (
            <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className="mt-1 text-[20px] font-semibold tabular-nums">{x}</p></div></Card>
          ))}
        </div>
      )}
      <div className={cn("grid gap-4", open && "xl:grid-cols-[1fr_340px]")}>
        <div className="space-y-4">
          {open && <Card title="Scan a parcel"><ScanParcel manifestId={m.id} carrier={m.carrier} /></Card>}
          <Card title={open ? "On this manifest" : "Parcels"}>{v.parcels.length ? <div className="overflow-x-auto">{table}</div> : <p className="p-5 text-[14px] text-muted">No parcels yet. Scan each packed parcel&apos;s slip.</p>}</Card>
        </div>
        {open && <Card title="Rider collecting"><HandOver manifestId={m.id} parcels={v.parcels.length} cod={v.cod} /></Card>}
      </div>
      {/* signatures on paper */}
      <div className="mt-10 hidden grid-cols-2 gap-10 text-[12px] print:grid">
        <div className="border-t border-black pt-1">Handed over by{v.handedBy ? `: ${v.handedBy}` : ""}</div>
        <div className="border-t border-black pt-1">Received by (rider){m.riderName ? `: ${m.riderName}` : ""} · {m.parcels ?? v.parcels.length} parcels, COD {formatPrice(m.codTotal ?? v.cod)}</div>
      </div>
    </>
  );
}
