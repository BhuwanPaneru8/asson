"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { markRead, saveChecklist, sendAnnouncement, tickItem } from "@/actions/admin/ops";
import { cn } from "@/lib/utils";
import { Card } from "./ui";

const input = "h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
const btn = "h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40";

export function ReadButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className="h-9 shrink-0 rounded-md bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-40" disabled={pending} onClick={() => start(async () => { const r = await markRead(id); if (!r.ok) toast.error(r.error); })}>{pending ? "…" : "Got it"}</button>;
}

type Item = { text: string; doneByName?: string | null; doneAt?: string | null };

export function ChecklistCard({ templateId, storeId, name, dueBy, items, completed }: { templateId: string; storeId: string; name: string; dueBy: string | null; items: Item[]; completed: boolean }) {
  const [, start] = useTransition();
  const [view, setView] = useOptimistic(items, (cur: Item[], u: { i: number; done: boolean }) => cur.map((x, j) => (j === u.i ? { ...x, doneAt: u.done ? new Date().toISOString() : null, doneByName: u.done ? "you" : null } : x)));
  const done = view.filter((i) => i.doneAt).length;
  const toggle = (i: number, on: boolean) => start(async () => { setView({ i, done: on }); const r = await tickItem(templateId, storeId, i, on); if (!r.ok) toast.error(r.error); });
  return (
    <Card title={`${name} · ${done}/${view.length}${dueBy ? ` · by ${dueBy}` : ""}`} action={completed || done === view.length ? <span className="text-[13px] font-medium text-success">Done ✓</span> : null}>
      <ul className="divide-y divide-line">{view.map((it, i) => (
        <li key={i}><label className="flex cursor-pointer items-start gap-3 px-5 py-3 text-[14.5px]">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-ink" checked={!!it.doneAt} onChange={(e) => toggle(i, e.target.checked)} />
          <span className={cn("flex-1", it.doneAt && "text-muted line-through")}>{it.text}{it.doneAt && it.doneByName && <span className="block text-[12px] text-muted no-underline">{it.doneByName} · {new Date(it.doneAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" })}</span>}</span>
        </label></li>
      ))}</ul>
    </Card>
  );
}

export function AnnouncementForm({ locations, everyone }: { locations: { id: string; name: string }[]; everyone: boolean }) {
  const blank = { title: "", body: "", storeIds: [] as string[], requiresAck: true, expiresInDays: "14" };
  const [f, setF] = useState(blank);
  const [pending, start] = useTransition();
  return (
    <Card title="Send an announcement">
      <form className="space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await sendAnnouncement({ ...f, expiresInDays: Number(f.expiresInDays) || 0 }); if (r.ok) { toast.success("Sent"); setF(blank); } else toast.error(r.error); }); }}>
        <input className={input} placeholder="Title" aria-label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className={cn(input, "h-28 py-2")} placeholder="What should every shop know?" aria-label="Message" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-ink-soft">To {everyone && !f.storeIds.length ? "every location" : `${f.storeIds.length} location(s)`}</p>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">{locations.map((l) => {
            const on = f.storeIds.includes(l.id);
            return <button type="button" key={l.id} onClick={() => setF({ ...f, storeIds: on ? f.storeIds.filter((x) => x !== l.id) : [...f.storeIds, l.id] })} className={cn("rounded-full border px-3 py-1 text-[13px]", on ? "border-ink bg-ink text-white" : "border-line bg-white")}>{l.name}</button>;
          })}</div>
          {!everyone && <p className="mt-1 text-[12px] text-muted">You can send to the locations you work at.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[13.5px]">
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-ink" checked={f.requiresAck} onChange={(e) => setF({ ...f, requiresAck: e.target.checked })} /> Staff must confirm they&apos;ve read it</label>
          <label className="flex items-center gap-2">Show for <input className={cn(input, "h-8 w-16")} value={f.expiresInDays} onChange={(e) => setF({ ...f, expiresInDays: e.target.value.replace(/\D/g, "") })} aria-label="Days to show" /> days</label>
        </div>
        <button className={btn} disabled={pending || !f.title || !f.body || (!everyone && !f.storeIds.length)}>{pending ? "Sending…" : "Send"}</button>
      </form>
    </Card>
  );
}

export function ChecklistEditor({ initial }: { initial?: { id: string; name: string; items: string[]; kind: "SHOP" | "WAREHOUSE" | null; dueBy: string | null; active: boolean } }) {
  const [f, setF] = useState({ name: initial?.name ?? "", items: (initial?.items ?? []).join("\n"), kind: initial?.kind ?? "SHOP", dueBy: initial?.dueBy ?? "", active: initial?.active ?? true });
  const [open, setOpen] = useState(!initial);
  const [pending, start] = useTransition();
  if (!open) return <button className="text-[13px] underline underline-offset-4" onClick={() => setOpen(true)}>Edit</button>;
  return (
    <form className="grid gap-2 p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveChecklist({ id: initial?.id, name: f.name, items: f.items.split("\n"), kind: (f.kind || null) as "SHOP" | "WAREHOUSE" | null, dueBy: f.dueBy, active: f.active }); if (r.ok) { toast.success("Saved"); if (!initial) setF({ name: "", items: "", kind: "SHOP", dueBy: "", active: true }); else setOpen(false); } else toast.error(r.error); }); }}>
      <input className={input} placeholder="Name, e.g. Opening" aria-label="Checklist name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <select className={input} value={f.kind ?? ""} onChange={(e) => setF({ ...f, kind: e.target.value as "SHOP" })} aria-label="Applies to"><option value="SHOP">Shops</option><option value="WAREHOUSE">Warehouses</option><option value="">Every location</option></select>
      <input className={input} placeholder="Done by (HH:mm)" aria-label="Done by" value={f.dueBy} onChange={(e) => setF({ ...f, dueBy: e.target.value })} />
      <textarea className={cn(input, "h-32 py-2 sm:col-span-3")} placeholder={"One item per line\nLights and music on\nTill float counted\nWindow display checked"} aria-label="Items" value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} />
      <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" className="accent-ink" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> In use</label>
      <div className="sm:col-span-2 sm:text-right"><button className={btn} disabled={pending || !f.name}>{pending ? "Saving…" : initial ? "Save checklist" : "Add checklist"}</button></div>
    </form>
  );
}
