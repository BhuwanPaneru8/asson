"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveNepaliNames } from "@/actions/admin/nepali";

type Row = { kind: "category" | "collection"; id: string; name: string; parent?: string | null; description: string | null; nameNe: string | null; descriptionNe: string | null };

const input = "h-9 w-full rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";

export function NepaliNameRow({ row }: { row: Row }) {
  const [nameNe, setName] = useState(row.nameNe ?? "");
  const [descriptionNe, setDesc] = useState(row.descriptionNe ?? "");
  const [pending, start] = useTransition();
  const dirty = nameNe !== (row.nameNe ?? "") || descriptionNe !== (row.descriptionNe ?? "");
  const save = () => start(async () => {
    const r = await saveNepaliNames({ kind: row.kind, id: row.id, nameNe, descriptionNe });
    if (r.ok) toast.success(`Saved “${row.name}”`); else toast.error(r.error);
  });
  return (
    <tr className="align-top">
      <td className="px-4 py-3 text-[13.5px]">
        <span className="font-medium">{row.name}</span>
        {row.parent && <span className="block text-[12px] text-muted">in {row.parent}</span>}
        {row.description && <span className="mt-1 block max-w-xs text-[12px] text-muted">{row.description}</span>}
      </td>
      <td className="px-4 py-3"><input lang="ne" className={input} value={nameNe} onChange={(e) => setName(e.target.value)} placeholder="नेपालीमा नाम" aria-label={`Nepali name for ${row.name}`} /></td>
      <td className="px-4 py-3">{row.description != null || row.kind === "collection" ? <textarea lang="ne" className={`${input} h-16 py-1.5`} value={descriptionNe} onChange={(e) => setDesc(e.target.value)} aria-label={`Nepali description for ${row.name}`} /> : <span className="text-[12.5px] text-muted">—</span>}</td>
      <td className="px-4 py-3 text-right"><button onClick={save} disabled={!dirty || pending} className="h-9 rounded-md bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-30">{pending ? "Saving…" : "Save"}</button></td>
    </tr>
  );
}
