"use client";

import { useState, useTransition } from "react";
import { MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/actions/account";
import { provinceOf } from "@/lib/config";
import { DistrictSelect } from "@/components/ui/district-select";
import { addressLines } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/misc";

type A = { id: string; fullName: string; phone: string; line1: string; line2: string; city: string; district: string; postalCode: string; isDefault: boolean };
const blank = { fullName: "", phone: "", line1: "", line2: "", city: "", district: "", postalCode: "", isDefault: false };

export function AddressBook({ addresses }: { addresses: A[] }) {
  const [editing, setEditing] = useState<(Omit<A, "id"> & { id?: string }) | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    start(async () => {
      const { id, ...data } = editing;
      const r = await saveAddress(data, id);
      if (r.ok) { toast.success("Address saved"); setEditing(null); setErrors({}); }
      else setErrors(r.fieldErrors ?? {});
    });
  };
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => editing && setEditing({ ...editing, [k]: e.target.value });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">Saved addresses</h2>
        <Button size="sm" onClick={() => { setErrors({}); setEditing({ ...blank }); }}><Plus className="h-4 w-4" /> Add address</Button>
      </div>
      {addresses.length === 0 ? (
        <EmptyState icon={<MapPin className="h-10 w-10" strokeWidth={1.2} />} title="No saved addresses" body="Save an address for faster checkout." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="flex flex-col border border-line bg-white p-5 text-[14px]">
              <p className="font-semibold">{a.fullName} {a.isDefault && <span className="ml-1 bg-cloud px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider">Default</span>}</p>
              <div className="mt-1.5 text-ink-soft">{addressLines({ ...a, state: provinceOf(a.district) ?? "" }).map((l) => <p key={l}>{l}</p>)}</div>
              <p className="mt-1 text-muted">{a.phone}</p>
              <div className="mt-4 flex gap-4 text-[13.5px]">
                <button className="underline underline-offset-4" onClick={() => { setErrors({}); setEditing(a); }}>Edit</button>
                {!a.isDefault && <button className="underline underline-offset-4" disabled={pending} onClick={() => start(async () => { await setDefaultAddress(a.id); toast.success("Default address updated"); })}>Set as default</button>}
                <button className="ml-auto text-danger" disabled={pending} onClick={() => confirm("Delete this address?") && start(async () => { await deleteAddress(a.id); toast.success("Address deleted"); })}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit address" : "New address"}>
        {editing && (
          <form onSubmit={save} className="grid gap-4 p-5">
            <Field label="Full name" error={errors.fullName}><Input value={editing.fullName} onChange={set("fullName")} /></Field>
            <Field label="Phone" error={errors.phone}><Input value={editing.phone} onChange={set("phone")} inputMode="numeric" maxLength={10} /></Field>
            <Field label="District" error={errors.district} hint={editing.district ? `${provinceOf(editing.district)} Province` : undefined}><DistrictSelect value={editing.district} onChange={set("district")} /></Field>
            <Field label="City / municipality" error={errors.city}><Input value={editing.city} onChange={set("city")} /></Field>
            <Field label="Tole / street, house no." error={errors.line1}><Input value={editing.line1} onChange={set("line1")} /></Field>
            <Field label="Nearest landmark"><Input value={editing.line2} onChange={set("line2")} /></Field>
            <Field label="Postal code (optional)" error={errors.postalCode}><Input value={editing.postalCode} onChange={set("postalCode")} inputMode="numeric" maxLength={5} /></Field>
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={editing.isDefault} onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} className="h-4 w-4 accent-ink" /> Make this my default address</label>
            <Button type="submit" size="lg" loading={pending}>Save address</Button>
          </form>
        )}
      </Sheet>
    </div>
  );
}
