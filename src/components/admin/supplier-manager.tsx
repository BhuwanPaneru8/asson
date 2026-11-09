"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { saveSupplier } from "@/actions/admin/purchasing";
import { Pill } from "./ui";

type Row = { paymentTermsDays: number; id: string; name: string; contact: string; phone: string; email: string; location: string; country: string; notes: string; active: boolean; orders: number; spend: string; units: number; damageRate: number };
const blank = { name: "", contact: "", phone: "", email: "", location: "", country: "Nepal", notes: "", active: true, paymentTermsDays: 30 };
const input = "h-9 w-full rounded-md border border-line bg-white px-2.5 text-[13.5px] outline-none focus:border-ink";

export function SupplierManager({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<(typeof blank & { id?: string }) | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const save = () => editing && start(async () => {
    const { id, ...data } = editing;
    const r = await saveSupplier(data, id);
    if (r.ok) { toast.success("Supplier saved"); setEditing(null); setErrors({}); } else { setErrors(r.fieldErrors ?? {}); toast.error(r.error); }
  });
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => editing && setEditing({ ...editing, [k]: e.target.value });

  return (
    <div>
      <div className="flex justify-end border-b border-line p-3"><button onClick={() => setEditing({ ...blank })} className="flex h-9 items-center gap-1.5 rounded-md bg-ink px-3 text-[13.5px] text-white"><Plus className="h-4 w-4" /> Add supplier</button></div>
      {editing && (
        <div className="grid gap-2 border-b border-line bg-cloud/40 p-4 sm:grid-cols-3">
          <label className="text-[12.5px] text-muted">Name<input className={input} value={editing.name} onChange={set("name")} />{errors.name && <span className="text-danger">{errors.name}</span>}</label>
          <label className="text-[12.5px] text-muted">Contact person<input className={input} value={editing.contact} onChange={set("contact")} /></label>
          <label className="text-[12.5px] text-muted">Phone<input className={input} value={editing.phone} onChange={set("phone")} /></label>
          <label className="text-[12.5px] text-muted">Email<input className={input} value={editing.email} onChange={set("email")} />{errors.email && <span className="text-danger">{errors.email}</span>}</label>
          <label className="text-[12.5px] text-muted">Location / market<input className={input} value={editing.location} onChange={set("location")} placeholder="New Road, Kathmandu" /></label>
          <label className="text-[12.5px] text-muted">Country<input className={input} value={editing.country} onChange={set("country")} /></label>
          <label className="text-[12.5px] text-muted">Payment terms (days)<input className={input} value={editing.paymentTermsDays} onChange={(e) => setEditing({ ...editing, paymentTermsDays: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" />{errors.paymentTermsDays && <span className="text-danger">{errors.paymentTermsDays}</span>}</label>
          <label className="text-[12.5px] text-muted sm:col-span-3">Notes (specialities, payment terms, MOQ)<textarea className={`${input} h-16 py-1.5`} value={editing.notes} onChange={set("notes")} /></label>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="accent-ink" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
          <div className="flex justify-end gap-2 sm:col-span-2"><button onClick={() => setEditing(null)} className="h-9 rounded-md px-3 text-[13.5px] hover:bg-cloud">Cancel</button><button onClick={save} disabled={pending} className="h-9 rounded-md bg-ink px-4 text-[13.5px] text-white disabled:opacity-50">Save</button></div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[11.5px] uppercase tracking-wider text-muted"><th className="px-4 py-2.5">Supplier</th><th className="px-3">Contact</th><th className="px-3 text-right">POs</th><th className="px-3 text-right">Units received</th><th className="px-3 text-right">Spend</th><th className="px-3 text-right">Damaged</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                <td className="px-4 py-2.5"><p className="font-medium">{r.name}</p><p className="text-[12px] text-muted">{[r.location, r.country].filter(Boolean).join(" · ")}</p>{r.notes && <p className="max-w-md truncate text-[12px] text-muted">{r.notes}</p>}</td>
                <td className="px-3 text-muted">{[r.contact, r.phone, r.email].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 text-right tabular-nums">{r.orders}</td>
                <td className="px-3 text-right tabular-nums">{r.units}</td>
                <td className="px-3 text-right tabular-nums">{r.spend}</td>
                <td className="px-3 text-right">{r.units ? <Pill tone={r.damageRate > 3 ? "danger" : "success"}>{r.damageRate}%</Pill> : "—"}</td>
                <td className="px-3 text-right"><button onClick={() => setEditing({ ...r })} className="text-[13px] underline">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-8 text-center text-muted">No suppliers yet.</p>}
      </div>
    </div>
  );
}
