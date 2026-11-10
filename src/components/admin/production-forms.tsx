"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createProductionOrder, issueProductionOrder, previewProduction, receiveMaterialStock, receiveProductionOrder, saveBom, saveMaterial, stopProductionOrder } from "@/actions/admin/production";
import { cn, formatPrice } from "@/lib/utils";
import { Card } from "./ui";

const input = "h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
const label = "mb-1 block text-[12.5px] font-medium text-ink-soft";
const btn = "h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40";
const num = (v: string) => v.replace(/[^\d.]/g, "");
const fmt = (milli: number, unit: string) => `${(milli / 1000).toLocaleString("en-IN", { maximumFractionDigits: 3 })} ${unit}`;

type Opt = { id: string; name: string };
type Mat = { id: string; code: string; name: string; unit: string; supplierId: string | null };

export function MaterialForm({ suppliers }: { suppliers: Opt[] }) {
  const blank = { code: "", name: "", kind: "FABRIC" as const, unit: "m", color: "", supplierId: "", minStock: "" };
  const [f, setF] = useState<typeof blank | (Omit<typeof blank, "kind"> & { kind: "FABRIC" | "TRIM" | "PACKAGING" })>(blank);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Card title="Add a material">
      <form className="grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveMaterial({ ...f, minStock: Number(f.minStock) || 0 }); if (r.ok) { toast.success(`${f.name} added`); setF(blank); } else toast.error(r.error); }); }}>
        <label className={label}>Code<input className={input} value={f.code} onChange={set("code")} placeholder="FAB-LIN-WHT" /></label>
        <label className={label}>Name<input className={input} value={f.name} onChange={set("name")} placeholder="White linen 160 cm" /></label>
        <label className={label}>Kind<select className={input} value={f.kind} onChange={set("kind")}><option value="FABRIC">Fabric</option><option value="TRIM">Trim (buttons, zips, thread, labels)</option><option value="PACKAGING">Packaging</option></select></label>
        <label className={label}>Unit<input className={input} value={f.unit} onChange={set("unit")} placeholder="m, pcs, cone, kg" /></label>
        <label className={label}>Colour (optional)<input className={input} value={f.color} onChange={set("color")} /></label>
        <label className={label}>Usual supplier<select className={input} value={f.supplierId} onChange={set("supplierId")}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className={label}>Reorder below (units, all locations)<input className={input} value={f.minStock} onChange={(e) => setF({ ...f, minStock: num(e.target.value) })} inputMode="decimal" /></label>
        <div className="flex items-end"><button className={cn(btn, "w-full")} disabled={pending || !f.code || !f.name}>{pending ? "Saving…" : "Add material"}</button></div>
      </form>
    </Card>
  );
}

export function ReceiveMaterialForm({ materials, locations, suppliers }: { materials: Mat[]; locations: Opt[]; suppliers: Opt[] }) {
  const [f, setF] = useState({ materialId: materials[0]?.id ?? "", storeId: locations[0]?.id ?? "", quantity: "", unitCost: "", supplierId: materials[0]?.supplierId ?? "", invoice: "", vat: "" });
  const [pending, start] = useTransition();
  // the lists can arrive after the first render (e.g. the very first material was just added): fall back to the first
  const mat = materials.find((m) => m.id === f.materialId) ?? materials[0];
  const storeId = f.storeId || locations[0]?.id || "";
  const supplierId = f.supplierId || (f.materialId ? "" : mat?.supplierId ?? "");
  const goods = (Number(f.quantity) || 0) * (Number(f.unitCost) || 0);
  if (!materials.length || !mat) return null;
  return (
    <Card title="Receive fabric or trims">
      <form className="grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); start(async () => {
        const r = await receiveMaterialStock({ ...f, materialId: mat.id, storeId, quantity: Number(f.quantity), unitCost: Number(f.unitCost), vat: Number(f.vat) || 0, supplierId: supplierId || undefined, invoice: f.invoice || undefined });
        if (r.ok) { toast.success(`${f.quantity} ${mat.unit} of ${mat.name} received`); setF({ ...f, quantity: "", unitCost: "", invoice: "", vat: "" }); } else toast.error(r.error);
      }); }}>
        <label className={label}>Material<select className={input} value={mat.id} onChange={(e) => setF({ ...f, materialId: e.target.value, supplierId: materials.find((m) => m.id === e.target.value)?.supplierId ?? supplierId })}>{materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}</select></label>
        <label className={label}>Into<select className={input} value={storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label className={label}>Quantity ({mat.unit})<input className={input} value={f.quantity} onChange={(e) => setF({ ...f, quantity: num(e.target.value) })} inputMode="decimal" /></label>
        <label className={label}>Cost per {mat.unit}, Rs. (before VAT)<input className={input} value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: num(e.target.value) })} inputMode="decimal" /></label>
        <label className={label}>Supplier<select className={input} value={supplierId} onChange={(e) => setF({ ...f, materialId: mat.id, supplierId: e.target.value })}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className={label}>Their invoice no. (records the bill)<input className={input} value={f.invoice} onChange={(e) => setF({ ...f, invoice: e.target.value })} /></label>
        {f.invoice && <label className={label}>VAT on the invoice, Rs.<input className={input} value={f.vat} onChange={(e) => setF({ ...f, vat: num(e.target.value) })} inputMode="decimal" /></label>}
        <div className="flex items-end justify-between gap-3 sm:col-span-2"><p className="text-[13px] text-muted">{goods > 0 && <>Goods value {formatPrice(Math.round(goods * 100))}{f.invoice ? ` · bill ${formatPrice(Math.round((goods + (Number(f.vat) || 0)) * 100))}` : ""}</>}</p><button className={btn} disabled={pending || !f.quantity || f.unitCost === ""}>{pending ? "Saving…" : "Receive"}</button></div>
      </form>
    </Card>
  );
}

export function BomEditor({ productId, materials, initial, labourCost }: { productId: string; materials: Mat[]; initial: { materialId: string; quantity: number; note: string | null }[]; labourCost: number | null }) {
  const [lines, setLines] = useState(initial.map((l) => ({ materialId: l.materialId, quantity: String(l.quantity / 1000), note: l.note ?? "" })));
  const [labour, setLabour] = useState(labourCost != null ? String(labourCost / 100) : "");
  const [pending, start] = useTransition();
  const unused = materials.filter((m) => !lines.some((l) => l.materialId === m.id));
  return (
    <Card title="What one piece uses">
      <div className="space-y-2 p-4">
        {lines.length === 0 && <p className="text-[13.5px] text-muted">No materials yet. Add the fabric first, then trims (buttons, thread, labels, packaging).</p>}
        {lines.map((l, i) => {
          const m = materials.find((x) => x.id === l.materialId);
          return (
            <div key={l.materialId} className="flex items-center gap-2 text-[14px]">
              <span className="min-w-0 flex-1 truncate">{m?.name} <span className="text-muted">({m?.code})</span></span>
              <input className={cn(input, "w-24 text-right")} value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: num(e.target.value) } : x)))} inputMode="decimal" aria-label={`${m?.name} per piece`} />
              <span className="w-12 text-muted">{m?.unit}</span>
              <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-[13px] text-danger">Remove</button>
            </div>
          );
        })}
        {unused.length > 0 && (
          <select className={input} value="" onChange={(e) => e.target.value && setLines([...lines, { materialId: e.target.value, quantity: "", note: "" }])} aria-label="Add a material">
            <option value="">+ Add a material…</option>{unused.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </select>
        )}
        <label className={cn(label, "pt-2")}>Workshop stitching charge per piece, Rs.<input className={input} value={labour} onChange={(e) => setLabour(num(e.target.value))} inputMode="decimal" /></label>
        <button className={cn(btn, "w-full")} disabled={pending} onClick={() => start(async () => {
          const r = await saveBom(productId, { lines: lines.map((l) => ({ materialId: l.materialId, quantity: Number(l.quantity), note: l.note })), labourCost: Number(labour) || 0 });
          if (r.ok) toast.success("Saved"); else toast.error(r.error);
        })}>{pending ? "Saving…" : "Save"}</button>
      </div>
    </Card>
  );
}

type Prod = { id: string; name: string; labourCost: number | null; hasBom: boolean; variants: { id: string; color: string; size: string }[] };
type Req = Awaited<ReturnType<typeof previewProduction>>;

export function NewProductionOrder({ products, workshops, locations, showCost }: { products: Prod[]; workshops: Opt[]; locations: Opt[]; showCost: boolean }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId);
  const [workshopId, setWorkshopId] = useState(workshops[0]?.id ?? "");
  const [storeId, setStoreId] = useState(locations[0]?.id ?? "");
  const [labour, setLabour] = useState(product?.labourCost != null ? String(product.labourCost / 100) : "");
  const [dueDate, setDueDate] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [req, setReq] = useState<Req>([]);
  const [pending, start] = useTransition();
  const pieces = Object.values(qty).reduce((s, v) => s + (Number(v) || 0), 0);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => { previewProduction(productId, pieces, storeId).then((r) => { if (live) setReq(r); }).catch(() => {}); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [productId, pieces, storeId]);

  if (!products.length) return <p className="p-6 text-[14px] text-muted">No active products yet.</p>;
  const pick = (id: string) => { setProductId(id); setQty({}); const p = products.find((x) => x.id === id); setLabour(p?.labourCost != null ? String(p.labourCost / 100) : ""); };
  const short = req.filter((r) => r.short > 0);
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card title="Order" className="lg:col-span-3">
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className={cn(label, "sm:col-span-2")}>Product<select className={input} value={productId} onChange={(e) => pick(e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.hasBom ? "" : " — no bill of materials yet"}</option>)}</select></label>
          <label className={label}>Workshop<select className={input} value={workshopId} onChange={(e) => setWorkshopId(e.target.value)}>{workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label className={label}>Materials from / pieces into<select className={input} value={storeId} onChange={(e) => setStoreId(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className={label}>Stitching per piece, Rs.<input className={input} value={labour} onChange={(e) => setLabour(num(e.target.value))} inputMode="decimal" /></label>
          <label className={label}>Due (optional)<input type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
          <div className="sm:col-span-2">
            <p className={label}>Pieces per size</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {product?.variants.map((v) => (
                <label key={v.id} className="text-[12.5px] text-muted">{v.color} · {v.size}
                  <input className={cn(input, "mt-0.5 text-right")} value={qty[v.id] ?? ""} onChange={(e) => setQty({ ...qty, [v.id]: e.target.value.replace(/\D/g, "") })} inputMode="numeric" aria-label={`${v.color} ${v.size} pieces`} />
                </label>
              ))}
            </div>
          </div>
          <button className={cn(btn, "sm:col-span-2")} disabled={pending || !pieces || !workshopId || !storeId} onClick={() => start(async () => {
            const r = await createProductionOrder({ productId, workshopId, storeId, labourPerPiece: Number(labour) || 0, dueDate, lines: Object.entries(qty).map(([variantId, v]) => ({ variantId, planned: Number(v) || 0 })) });
            if (r && !r.ok) toast.error(r.error);
          })}>{pending ? "Creating…" : pieces ? `Create draft for ${pieces} piece${pieces > 1 ? "s" : ""}` : "Enter pieces per size"}</button>
        </div>
      </Card>
      <Card title="Materials needed" className="lg:col-span-2">
        <div className="p-4 text-[13.5px]">
          {!product?.hasBom ? <p className="text-warn">This product has no bill of materials, so nothing will be issued and pieces will cost only the stitching. Set it up under Production → Products.</p>
            : !pieces ? <p className="text-muted">Enter pieces to see what&apos;s needed.</p>
            : <ul className="space-y-1.5">{req.map((r) => (
                <li key={r.materialId} className="flex justify-between gap-3"><span>{r.name}</span><span className={cn("tabular-nums", r.short ? "font-medium text-danger" : "text-muted")}>{fmt(r.need, r.unit)}{r.short ? ` · short ${fmt(r.short, r.unit)}` : ` of ${fmt(r.have, r.unit)}`}</span></li>
              ))}</ul>}
          {short.length > 0 && <p className="mt-3 text-danger">You can save the draft now; issuing waits until the shortfall arrives.</p>}
          {showCost && pieces > 0 && req.length > 0 && <p className="mt-3 border-t border-line pt-3 text-muted">Estimated cost per piece {formatPrice(Math.round(req.reduce((s, r) => s + r.cost, 0) / pieces) + Math.round((Number(labour) || 0) * 100))}</p>}
        </div>
      </Card>
    </div>
  );
}

export function ProductionActions({ id, status, lines }: { id: string; status: string; lines: { variantId: string; label: string; open: number }[] }) {
  const [pending, start] = useTransition();
  const [counts, setCounts] = useState<Record<string, { good: string; rejected: string }>>({});
  const run = (f: () => Promise<{ ok: boolean; error?: string; message?: string }>, ok: string) => start(async () => { const r = await f(); if (r.ok) toast.success(r.message ?? ok); else toast.error(r.error); });
  const stop = () => { const why = prompt(status === "PARTIAL" ? "Close this order short? Remaining pieces won't be made. Why?" : "Cancel this order? Issued materials go back on the shelf. Why?"); if (why) run(() => stopProductionOrder(id, why), status === "PARTIAL" ? "Order closed" : "Order cancelled"); };
  if (status === "COMPLETED" || status === "CANCELLED") return null;
  return (
    <Card title={status === "DRAFT" ? "Next: issue the materials" : "Receive pieces from the workshop"}>
      <div className="space-y-3 p-4">
        {status === "DRAFT" ? (
          <p className="text-[13.5px] text-muted">Issuing takes every material for the whole order (plus the cutting allowance) off this location&apos;s shelf, in one go.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-[12px] font-medium uppercase tracking-wider text-muted"><span>Size</span><span className="text-right">Good</span><span className="text-right">Rejected</span></div>
            {lines.filter((l) => l.open > 0).map((l) => (
              <div key={l.variantId} className="grid grid-cols-[1fr_80px_80px] items-center gap-2 text-[14px]">
                <span>{l.label} <span className="text-muted">· {l.open} to come</span></span>
                {(["good", "rejected"] as const).map((k) => <input key={k} className={cn(input, "h-9 text-right")} inputMode="numeric" aria-label={`${l.label} ${k}`} value={counts[l.variantId]?.[k] ?? ""} onChange={(e) => setCounts({ ...counts, [l.variantId]: { good: counts[l.variantId]?.good ?? "", rejected: counts[l.variantId]?.rejected ?? "", [k]: e.target.value.replace(/\D/g, "") } })} />)}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {status === "DRAFT"
            ? <button className={btn} disabled={pending} onClick={() => run(() => issueProductionOrder(id), "Materials issued")}>{pending ? "Working…" : "Issue materials to the workshop"}</button>
            : <button className={btn} disabled={pending || !Object.values(counts).some((c) => Number(c.good) || Number(c.rejected))} onClick={() => run(async () => { const r = await receiveProductionOrder(id, Object.entries(counts).map(([variantId, c]) => ({ variantId, good: Number(c.good) || 0, rejected: Number(c.rejected) || 0 }))); if (r.ok) setCounts({}); return r; }, "Received")}>{pending ? "Working…" : "Receive into stock"}</button>}
          <button className="h-10 rounded-md border border-line px-4 text-[14px] text-danger hover:border-danger" disabled={pending} onClick={stop}>{status === "PARTIAL" ? "Close short" : "Cancel order"}</button>
        </div>
      </div>
    </Card>
  );
}
