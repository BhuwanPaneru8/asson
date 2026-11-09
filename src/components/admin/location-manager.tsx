"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, Store, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { saveLocation, type LocationInput } from "@/actions/admin/locations";
import { Pill } from "./ui";

type Row = { id: string; code: string; name: string; kind: "SHOP" | "WAREHOUSE"; address: string; phone: string; hours: string; priority: number; pickup: boolean; active: boolean; units: number; skus: number; value: string | null; toPick: number; inTransit: number };
type Draft = Omit<LocationInput, "priority"> & { priority: string; id?: string };
const blank: Draft = { code: "", name: "", kind: "SHOP", address: "", phone: "", hours: "", priority: "100", pickup: false, active: true };
const input = "h-9 w-full rounded-md border border-line bg-white px-2.5 text-[13.5px] text-ink outline-none focus:border-ink";

export function LocationManager({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const save = () => editing && start(async () => {
    const { id, ...data } = editing;
    const r = await saveLocation({ ...data, priority: Number(data.priority) || 0 }, id);
    if (r.ok) { toast.success("Location saved"); setEditing(null); setErrors({}); } else { setErrors(r.fieldErrors ?? {}); toast.error(r.error); }
  });
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => editing && setEditing({ ...editing, [k]: e.target.value });

  return (
    <div>
      <div className="flex justify-end border-b border-line p-3"><button onClick={() => setEditing({ ...blank })} className="flex h-9 items-center gap-1.5 rounded-md bg-ink px-3 text-[13.5px] text-white"><Plus className="h-4 w-4" /> Add location</button></div>
      {editing && (
        <div className="grid gap-3 border-b border-line bg-cloud/40 p-4 sm:grid-cols-3">
          <label className="text-[12.5px] text-muted">Name<input className={input} value={editing.name} onChange={set("name")} placeholder="Asson Pokhara" />{errors.name && <span className="text-danger">{errors.name}</span>}</label>
          <label className="text-[12.5px] text-muted">Short code<input className={input} value={editing.code} onChange={set("code")} placeholder="PKR" />{errors.code && <span className="text-danger">{errors.code}</span>}</label>
          <label className="text-[12.5px] text-muted">Type
            <select className={input} value={editing.kind} onChange={set("kind")}><option value="SHOP">Shop (has a till)</option><option value="WAREHOUSE">Warehouse</option></select>
          </label>
          <label className="text-[12.5px] text-muted sm:col-span-2">Address<input className={input} value={editing.address} onChange={set("address")} placeholder="Lakeside-6, Pokhara" />{errors.address && <span className="text-danger">{errors.address}</span>}</label>
          <label className="text-[12.5px] text-muted">Phone<input className={input} value={editing.phone} onChange={set("phone")} inputMode="tel" /></label>
          <label className="text-[12.5px] text-muted">Fulfilment priority
            <input className={input} value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value.replace(/\D/g, "") })} inputMode="numeric" />
            <span className="mt-0.5 block text-[11.5px]">Online orders are filled from the lowest number first.</span>
          </label>
          {editing.kind === "SHOP" && <label className="text-[12.5px] text-muted">Opening hours (shown for pickup)<input className={input} value={editing.hours} onChange={set("hours")} placeholder="10am – 7pm, Sun–Fri" /></label>}
          <div className="flex flex-col justify-center gap-2 text-[13px]">
            {editing.kind === "SHOP" && <label className="flex items-center gap-2"><input type="checkbox" className="accent-ink" checked={editing.pickup} onChange={(e) => setEditing({ ...editing, pickup: e.target.checked })} /> Click-and-collect point</label>}
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-ink" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
          </div>
          <div className="flex items-end justify-end gap-2 sm:col-span-3"><button onClick={() => setEditing(null)} className="h-9 rounded-md px-3 text-[13.5px] hover:bg-cloud">Cancel</button><button onClick={save} disabled={pending} className="h-9 rounded-md bg-ink px-4 text-[13.5px] text-white disabled:opacity-50">{pending ? "Saving…" : "Save"}</button></div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[11.5px] uppercase tracking-wider text-muted"><th className="px-4 py-2.5">Location</th><th className="px-3 text-right">Priority</th><th className="px-3 text-right">Units</th><th className="px-3 text-right">SKUs</th>{rows.some((r) => r.value) && <th className="px-3 text-right">Value at cost</th>}<th className="px-3">Activity</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const Icon = r.kind === "SHOP" ? Store : Warehouse;
              return (
                <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                  <td className="px-4 py-2.5">
                    <p className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-muted" aria-hidden /> {r.name} <span className="font-mono text-[11.5px] text-muted">{r.code}</span></p>
                    <p className="text-[12px] text-muted">{[r.kind === "SHOP" ? "Shop" : "Warehouse", r.address, r.phone].filter(Boolean).join(" · ")}</p>
                    <div className="mt-1 flex gap-1.5">{r.pickup && <Pill tone="success">Pickup point</Pill>}{!r.active && <Pill>Inactive</Pill>}</div>
                  </td>
                  <td className="px-3 text-right tabular-nums">{r.priority}</td>
                  <td className="px-3 text-right font-semibold tabular-nums">{r.units.toLocaleString("en-IN")}</td>
                  <td className="px-3 text-right tabular-nums">{r.skus}</td>
                  {rows.some((x) => x.value) && <td className="px-3 text-right tabular-nums">{r.value ?? "—"}</td>}
                  <td className="px-3 text-[12.5px]">
                    <div className="flex flex-col gap-0.5">
                      <Link href={`/admin/inventory?at=${r.id}`} className="underline">Stock here</Link>
                      {r.toPick > 0 && <Link href={`/admin/picking?at=${r.id}`} className="text-warn underline">{r.toPick} to pick</Link>}
                      {r.inTransit > 0 && <Link href="/admin/transfers?status=SENT" className="underline">{r.inTransit} arriving</Link>}
                    </div>
                  </td>
                  <td className="px-3 text-right"><button onClick={() => setEditing({ id: r.id, code: r.code, name: r.name, kind: r.kind, address: r.address, phone: r.phone, hours: r.hours, priority: String(r.priority), pickup: r.pickup, active: r.active })} className="text-[13px] underline">Edit</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
