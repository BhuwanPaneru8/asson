"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, Search, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { purchasingLookup, receiveGoods, savePurchaseOrder, setPurchaseOrderStatus } from "@/actions/admin/purchasing";
import type { VariantHit } from "@/lib/pos";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { Card, Pill } from "./ui";

type Item = { id?: string; variantId: string; sku: string; name: string; color: string; size: string; quantityOrdered: number; quantityReceived: number; quantityDamaged: number; unitCost: number; landedUnitCost?: number };
type PO = { id: string; number: string; status: "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED"; supplier: string; notes: string; landedCost: number; expectedAt: string; createdBy: string; createdAt: string; items: Item[] };

const rs = (paisa: number) => (paisa / 100).toString();
const toPaisa = (s: string) => Math.round((Number(s.replace(/[^\d.]/g, "")) || 0) * 100);
const num = "h-8 w-20 rounded border border-line bg-white px-2 text-right text-[13px] tabular-nums outline-none focus:border-ink disabled:bg-cloud";

export function PurchaseOrderEditor({ po, locations }: { po: PO; locations: { id: string; name: string }[] }) {
  const [items, setItems] = useState<Item[]>(po.items);
  const [landed, setLanded] = useState(rs(po.landedCost));
  const [notes, setNotes] = useState(po.notes);
  const [expectedAt, setExpectedAt] = useState(po.expectedAt);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<VariantHit[]>([]);
  const [counts, setCounts] = useState<Record<string, { good: string; damaged: string }>>({});
  const [grnNote, setGrnNote] = useState("");
  const [into, setInto] = useState(locations[0]?.id ?? "");
  const [pending, start] = useTransition();

  const editable = po.status === "DRAFT" || po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED";
  const receivable = po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED";
  const goods = items.reduce((s, i) => s + i.unitCost * i.quantityOrdered, 0);
  const anyReceived = items.some((i) => i.quantityReceived + i.quantityDamaged > 0);

  const search = (e: React.FormEvent) => { e.preventDefault(); start(async () => { const h = await purchasingLookup(query); setHits(h); if (!h.length) toast.error("No matching products"); }); };
  const addHit = (h: VariantHit) => {
    if (items.some((i) => i.variantId === h.variantId)) return toast("Already on this order");
    setItems((x) => [...x, { variantId: h.variantId, sku: h.sku, name: h.name, color: h.color, size: h.size, quantityOrdered: 1, quantityReceived: 0, quantityDamaged: 0, unitCost: h.cost ?? 0 }]);
  };
  const upd = (variantId: string, patch: Partial<Item>) => setItems((x) => x.map((i) => (i.variantId === variantId ? { ...i, ...patch } : i)));
  const save = () => start(async () => {
    const r = await savePurchaseOrder({ poId: po.id, notes, expectedAt, landedCost: toPaisa(landed), items: items.map(({ variantId, quantityOrdered, unitCost }) => ({ variantId, quantityOrdered, unitCost })) });
    if (r.ok) toast.success("Saved"); else toast.error(r.error);
  });
  const status = (to: "ORDERED" | "CANCELLED") => start(async () => {
    if (to === "CANCELLED" && !confirm("Cancel this purchase order?")) return;
    if (to === "ORDERED") { const s = await savePurchaseOrder({ poId: po.id, notes, expectedAt, landedCost: toPaisa(landed), items: items.map(({ variantId, quantityOrdered, unitCost }) => ({ variantId, quantityOrdered, unitCost })) }); if (!s.ok) { toast.error(s.error); return; } }
    const r = await setPurchaseOrderStatus(po.id, to);
    if (r.ok) toast.success(to === "ORDERED" ? "Order placed with supplier" : "Cancelled"); else toast.error(r.error);
  });
  const receive = () => start(async () => {
    const lines = items.filter((i) => i.id).map((i) => ({ poItemId: i.id!, quantity: Number(counts[i.variantId]?.good || 0), damaged: Number(counts[i.variantId]?.damaged || 0) }));
    const r = await receiveGoods({ poId: po.id, storeId: into || undefined, note: grnNote, lines });
    if (r.ok) { toast.success(`GRN-${r.receiptNumber} recorded — stock and costs updated`); setCounts({}); setGrnNote(""); } else toast.error(r.error);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-[24px] font-semibold">{po.number} <Pill tone={po.status === "RECEIVED" ? "success" : po.status === "CANCELLED" ? "danger" : "warn"}>{po.status.replace("_", " ").toLowerCase()}</Pill></h1>
          <p className="text-[13.5px] text-muted">{po.supplier} · created by {po.createdBy} · {formatDateTime(po.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          {anyReceived && <Link href={`/admin/labels?po=${po.id}`} className="flex h-10 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[13.5px] hover:border-ink"><Tag className="h-4 w-4" /> Labels for received</Link>}
          {po.status === "DRAFT" && <button onClick={() => status("ORDERED")} disabled={pending} className="h-10 rounded-md bg-ink px-4 text-[13.5px] font-medium text-white">Place order</button>}
          {editable && !anyReceived && <button onClick={() => status("CANCELLED")} disabled={pending} className="h-10 rounded-md px-3 text-[13.5px] text-danger hover:bg-[#fbe9e7]">Cancel PO</button>}
        </div>
      </div>

      <Card title={`Items · ${items.reduce((s, i) => s + i.quantityOrdered, 0)} units · goods ${formatPrice(goods)}`}>
        {editable && (
          <form onSubmit={search} className="flex gap-2 border-b border-line p-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Scan SKU or search product to add" aria-label="Add product" className="h-9 flex-1 rounded-md border border-line px-3 text-[13.5px] outline-none focus:border-ink" />
            <button className="flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[13.5px]"><Search className="h-4 w-4" /> Find</button>
          </form>
        )}
        {hits.length > 0 && (
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto border-b border-line bg-cloud/40 p-3">
            {hits.map((h) => <button key={h.variantId} onClick={() => addHit(h)} className="flex items-center gap-1 rounded border border-line bg-white px-2 py-1 text-[12.5px] hover:border-ink"><Plus className="h-3 w-3" />{h.name} · {h.color} {h.size}</button>)}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[11.5px] uppercase tracking-wider text-muted"><th className="px-4 py-2">Item</th><th className="px-2 text-right">Ordered</th><th className="px-2 text-right">Unit cost (Rs)</th><th className="px-2 text-right">Landed/unit</th><th className="px-2 text-right">Received</th>{receivable && <th className="px-2 text-right">Count now: good · damaged</th>}<th /></tr></thead>
            <tbody className="divide-y divide-line">
              {items.map((i) => {
                const locked = i.quantityReceived + i.quantityDamaged > 0;
                const outstanding = i.quantityOrdered - i.quantityReceived - i.quantityDamaged;
                return (
                  <tr key={i.variantId}>
                    <td className="px-4 py-2"><p className="font-medium">{i.name}</p><p className="text-[12px] text-muted">{i.color} · {i.size} · {i.sku}</p></td>
                    <td className="px-2 text-right"><input className={num} disabled={!editable} value={i.quantityOrdered} onChange={(e) => upd(i.variantId, { quantityOrdered: Number(e.target.value.replace(/\D/g, "")) || 0 })} aria-label={`Ordered ${i.sku}`} /></td>
                    <td className="px-2 text-right"><input className={num} disabled={!editable || locked} value={rs(i.unitCost)} onChange={(e) => upd(i.variantId, { unitCost: toPaisa(e.target.value) })} aria-label={`Unit cost ${i.sku}`} /></td>
                    <td className="px-2 text-right tabular-nums text-muted">{i.landedUnitCost ? formatPrice(i.landedUnitCost) : "—"}</td>
                    <td className={cn("px-2 text-right tabular-nums", outstanding === 0 && "text-success")}>{i.quantityReceived}{i.quantityDamaged ? <span className="text-danger"> +{i.quantityDamaged} dmg</span> : null}{outstanding > 0 && locked ? <span className="text-warn"> · {outstanding} short</span> : null}</td>
                    {receivable && (
                      <td className="px-2 text-right whitespace-nowrap">
                        {i.id && outstanding > 0 ? <>
                          <input className={num} placeholder="0" value={counts[i.variantId]?.good ?? ""} onChange={(e) => setCounts((c) => ({ ...c, [i.variantId]: { good: e.target.value.replace(/\D/g, ""), damaged: c[i.variantId]?.damaged ?? "" } }))} aria-label={`Good units ${i.sku}`} />
                          <input className={cn(num, "ml-1 w-14")} placeholder="0" value={counts[i.variantId]?.damaged ?? ""} onChange={(e) => setCounts((c) => ({ ...c, [i.variantId]: { good: c[i.variantId]?.good ?? "", damaged: e.target.value.replace(/\D/g, "") } }))} aria-label={`Damaged units ${i.sku}`} />
                        </> : <span className="text-muted">—</span>}
                      </td>
                    )}
                    <td className="px-2">{editable && !locked && <button onClick={() => setItems((x) => x.filter((y) => y.variantId !== i.variantId))} className="p-1 text-muted hover:text-danger" aria-label={`Remove ${i.sku}`}><Trash2 className="h-4 w-4" /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!items.length && <p className="p-6 text-center text-muted">No items yet — scan or search above.</p>}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Order details">
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <label className="text-[13px] text-ink-soft">Freight / customs / transport (Rs)<input className={cn(num, "mt-1 w-full text-left")} disabled={!editable || anyReceived} value={landed} onChange={(e) => setLanded(e.target.value.replace(/[^\d.]/g, ""))} /></label>
            <label className="text-[13px] text-ink-soft">Expected delivery<input type="date" className="mt-1 h-8 w-full rounded border border-line px-2 text-[13px]" disabled={!editable} value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} /></label>
            <label className="text-[13px] text-ink-soft sm:col-span-2">Notes<textarea className="mt-1 w-full rounded border border-line p-2 text-[13px]" rows={2} disabled={!editable} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <p className="text-[12.5px] text-muted sm:col-span-2">Freight is spread over items by value to give the landed cost, which feeds each product&apos;s average cost when goods are received.</p>
            {editable && <button onClick={save} disabled={pending} className="h-9 rounded-md border border-ink px-4 text-[13.5px] font-medium sm:col-span-2">Save changes</button>}
          </div>
        </Card>
        {receivable && (
          <Card title="Receive goods (count & verify)">
            <div className="space-y-3 p-4">
              <p className="text-[13px] text-muted">Count every box. Enter only what physically arrived — good units go into stock, damaged units are recorded against the supplier. Missing units stay outstanding.</p>
              {locations.length > 1 && (
                <label className="mb-2 flex items-center gap-2 text-[13px] text-ink-soft">Receive into
                  <select value={into} onChange={(e) => setInto(e.target.value)} className="h-8 rounded border border-line bg-white px-2 text-[13px]">
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </label>
              )}
              <textarea value={grnNote} onChange={(e) => setGrnNote(e.target.value)} rows={2} placeholder="Delivery note / invoice no. / remarks" aria-label="Receipt note" className="w-full rounded border border-line p-2 text-[13px]" />
              <button onClick={receive} disabled={pending || !Object.values(counts).some((c) => Number(c.good) || Number(c.damaged))} className="h-10 w-full rounded-md bg-ink text-[14px] font-medium text-white disabled:opacity-40">Record goods received</button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
