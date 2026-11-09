"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { openNewShop, previewOpening } from "@/actions/admin/rollout";
import { DISTRICTS } from "@/lib/config";
import { distanceTier } from "@/lib/geo";

type Loc = { id: string; name: string; district: string | null };
type Staff = { id: string; name: string; role: string; where: string };
const input = "mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
const label = "block text-[13px] font-medium text-ink-soft";

export function OpenShopForm({ warehouses, shops, staff }: { warehouses: Loc[]; shops: Loc[]; staff: Staff[] }) {
  const [f, setF] = useState({ name: "", code: "", district: "", address: "", phone: "", hours: "10am – 7pm, Sun–Fri", pickup: true, shipsOnline: true, priority: 50 });
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [mode, setMode] = useState<"copy" | "bestsellers">(shops.length ? "copy" : "bestsellers");
  const [fromStoreId, setFrom] = useState(shops[0]?.id ?? "");
  const [percent, setPercent] = useState(60);
  const [products, setProducts] = useState(40);
  const [perSize, setPerSize] = useState(2);
  const [preview, setPreview] = useState<{ sizes: number; units: number } | null>(null);
  const [pending, start] = useTransition();
  const [previewing, startPreview] = useTransition();
  const plan = mode === "copy" ? { mode, fromStoreId, percent } as const : { mode, products, perSize } as const;

  // nearest warehouse to the new shop's district, by default
  const pickDistrict = (district: string) => {
    setF((x) => ({ ...x, district }));
    const near = [...warehouses].sort((a, b) => distanceTier(a.district, district) - distanceTier(b.district, district))[0];
    if (near) setWarehouseId(near.id);
  };
  useEffect(() => {
    if (!warehouseId) return;
    startPreview(async () => { const r = await previewOpening(warehouseId, plan); setPreview(r.ok ? { sizes: r.sizes, units: r.units } : null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, mode, fromStoreId, percent, products, perSize]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await openNewShop({ ...f, staffIds, warehouseId, plan });
      if (r && !r.ok) toast.error(r.error);
    });
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <section className="grid gap-3 rounded-lg border border-line bg-white p-5 sm:grid-cols-2">
          <h2 className="text-[15px] font-semibold sm:col-span-2">1 · The shop</h2>
          <label className={label}>Name<input className={input} value={f.name} onChange={set("name")} placeholder="Asson Butwal" required /></label>
          <label className={label}>Short code<input className={input} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="BTW" required /></label>
          <label className={label}>District<select className={input} value={f.district} onChange={(e) => pickDistrict(e.target.value)} required><option value="">Choose…</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label className={label}>Phone<input className={input} value={f.phone} onChange={set("phone")} inputMode="tel" /></label>
          <label className={`${label} sm:col-span-2`}>Address<input className={input} value={f.address} onChange={set("address")} placeholder="Traffic Chowk, Butwal" required /></label>
          <label className={label}>Opening hours<input className={input} value={f.hours} onChange={set("hours")} /></label>
          <label className={label}>Fulfilment priority<input className={input} value={f.priority} onChange={(e) => setF({ ...f, priority: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" /></label>
          <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" className="accent-ink" checked={f.pickup} onChange={(e) => setF({ ...f, pickup: e.target.checked })} /> Click-and-collect point</label>
          <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" className="accent-ink" checked={f.shipsOnline} onChange={(e) => setF({ ...f, shipsOnline: e.target.checked })} /> Ships online orders</label>
        </section>

        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-[15px] font-semibold">2 · Who works there</h2>
          <p className="mt-1 text-[13px] text-muted">They&apos;ll be able to open this shop&apos;s till, count its stock and receive its transfers. Make new people staff under Customers &amp; team first.</p>
          <ul className="mt-3 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
            {staff.map((s) => (
              <li key={s.id}><label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" className="accent-ink" checked={staffIds.includes(s.id)} onChange={(e) => setStaffIds(e.target.checked ? [...staffIds, s.id] : staffIds.filter((x) => x !== s.id))} /> {s.name} <span className="text-[12px] text-muted">{s.role.toLowerCase()} · {s.where}</span></label></li>
            ))}
            {!staff.length && <li className="text-[13px] text-muted">No cashiers, staff or managers yet.</li>}
          </ul>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-white p-5">
          <h2 className="text-[15px] font-semibold">3 · Opening stock</h2>
          <label className={label}>Sent from<select className={input} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{w.district ? ` · ${w.district}` : ""}</option>)}</select></label>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Template">
            {shops.length > 0 && <label className={`flex cursor-pointer gap-2 rounded-md border p-3 text-[13.5px] ${mode === "copy" ? "border-ink" : "border-line"}`}><input type="radio" className="accent-ink" checked={mode === "copy"} onChange={() => setMode("copy")} /><span><b>Copy a shop like it</b><span className="block text-muted">Same sizes and quantities, scaled</span></span></label>}
            <label className={`flex cursor-pointer gap-2 rounded-md border p-3 text-[13.5px] ${mode === "bestsellers" ? "border-ink" : "border-line"}`}><input type="radio" className="accent-ink" checked={mode === "bestsellers"} onChange={() => setMode("bestsellers")} /><span><b>Best-seller starter</b><span className="block text-muted">Top products, every size that sells</span></span></label>
          </div>
          {mode === "copy" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>Copy<select className={input} value={fromStoreId} onChange={(e) => setFrom(e.target.value)}>{shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className={label}>At<select className={input} value={percent} onChange={(e) => setPercent(Number(e.target.value))}>{[25, 40, 50, 60, 75, 100, 125, 150].map((n) => <option key={n} value={n}>{n}% of its quantities</option>)}</select></label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>Top products<select className={input} value={products} onChange={(e) => setProducts(Number(e.target.value))}>{[20, 30, 40, 60, 80, 120].map((n) => <option key={n} value={n}>{n} best sellers</option>)}</select></label>
              <label className={label}>Per size<select className={input} value={perSize} onChange={(e) => setPerSize(Number(e.target.value))}>{[1, 2, 3, 4, 6].map((n) => <option key={n} value={n}>{n} unit{n > 1 ? "s" : ""}</option>)}</select></label>
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-3">
        <section className="rounded-lg border border-line bg-white p-5 text-[14px]">
          <h2 className="text-[15px] font-semibold">Ready to open</h2>
          <ul className="mt-2 space-y-1.5 text-ink-soft">
            <li>{f.name || "New shop"}{f.district ? ` in ${f.district}` : ""}</li>
            <li>{staffIds.length} staff assigned</li>
            <li className={previewing ? "opacity-50" : ""}>{preview ? <>Opening stock: <b>{preview.units.toLocaleString("en-IN")} units</b> across {preview.sizes} sizes</> : "Opening stock: choose a warehouse"}</li>
          </ul>
          <p className="mt-3 text-[12.5px] text-muted">Never more than the warehouse can spare (it keeps its own online reserve). The transfer is created as a draft for the warehouse to pack and send; after that, Replenishment keeps the shop topped up.</p>
          <button disabled={pending} className="mt-4 h-11 w-full rounded-md bg-ink text-[15px] font-medium text-white disabled:opacity-40">{pending ? "Opening…" : "Open the shop"}</button>
        </section>
      </aside>
    </form>
  );
}
