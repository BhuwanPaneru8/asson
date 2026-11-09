"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setStaffLocations } from "@/actions/admin/team";

type Loc = { id: string; name: string };

/** Compact cell: shows where someone works, opens a small checklist to change it. */
export function StaffLocations({ userId, all, assigned, locations, editable }: { userId: string; all: boolean; assigned: string[]; locations: Loc[]; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const [everywhere, setEverywhere] = useState(all);
  const [ids, setIds] = useState(assigned);
  const [pending, start] = useTransition();
  const label = all ? "All locations" : assigned.length ? locations.filter((l) => assigned.includes(l.id)).map((l) => l.name).join(", ") : "None yet";
  if (!editable || !open) {
    return (
      <span className="text-[13px]">
        <span className={!all && !assigned.length ? "text-warn" : ""}>{label}</span>
        {editable && <button type="button" onClick={() => setOpen(true)} className="ml-2 text-muted underline">Change</button>}
      </span>
    );
  }
  const save = () => start(async () => {
    const r = await setStaffLocations({ userId, all: everywhere, storeIds: everywhere ? [] : ids });
    if (r.ok) { toast.success("Locations updated"); setOpen(false); } else toast.error(r.error);
  });
  return (
    <div className="min-w-56 space-y-1.5 rounded-md border border-line bg-white p-2.5 text-[13px]">
      <label className="flex items-center gap-2 font-medium"><input type="checkbox" className="accent-ink" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} /> All locations (HQ)</label>
      {!everywhere && (
        <ul className="max-h-48 space-y-1 overflow-y-auto border-t border-line pt-1.5">
          {locations.map((l) => (
            <li key={l.id}><label className="flex items-center gap-2"><input type="checkbox" className="accent-ink" checked={ids.includes(l.id)} onChange={(e) => setIds(e.target.checked ? [...ids, l.id] : ids.filter((x) => x !== l.id))} /> {l.name}</label></li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={() => setOpen(false)} className="px-2 py-1 text-muted">Cancel</button>
        <button type="button" disabled={pending} onClick={save} className="rounded bg-ink px-3 py-1 text-white disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
