"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { commentIssue, reopenIssueAction, reportIssueAction, updateIssueAction } from "@/actions/admin/issues";
import { uploadPhoto } from "@/lib/image-resize";
import { cn } from "@/lib/utils";
import { Card } from "./ui";

const input = "h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
const btn = "h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40";
const ghost = "h-10 rounded-md border border-line px-4 text-[14px] hover:border-ink disabled:opacity-40";

const CATEGORIES = [["EQUIPMENT", "Equipment (till, printer, rails, mirrors)"], ["BUILDING", "Building (lights, AC, shutter, water)"], ["IT", "IT / internet / POS"], ["SAFETY", "Safety (fire, theft, injury)"], ["STOCK", "Stock / delivery problem"], ["OTHER", "Other"]] as const;
const PRIORITIES = [["URGENT", "Urgent: can't trade or unsafe"], ["NORMAL", "Normal"], ["LOW", "Low: when someone's nearby"]] as const;
const STATUSES = [["OPEN", "Open"], ["IN_PROGRESS", "Being fixed"], ["ON_HOLD", "On hold"], ["RESOLVED", "Resolved"]] as const;

/** Take or choose photos (phone camera opens directly); each is resized in the browser, then uploaded. */
export function IssuePhotos({ value, onChange, max = 6, purpose = "issue", label = "Add photo" }: { value: string[]; onChange: (v: string[]) => void; max?: number; purpose?: "issue" | "vm" | "visit" | "cash"; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function add(files: FileList) {
    setBusy(true);
    let next = value;
    for (const f of [...files].slice(0, max - value.length)) {
      try { next = [...next, (await uploadPhoto(f, purpose)).url]; onChange(next); } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    }
    setBusy(false);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((u) => (
        <span key={u} className="relative h-16 w-16 overflow-hidden rounded-md bg-cloud">
          <Image src={u} alt="" fill sizes="64px" className="object-cover" />
          <button type="button" onClick={() => onChange(value.filter((x) => x !== u))} className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5" aria-label="Remove photo"><X className="h-3 w-3" /></button>
        </span>
      ))}
      {value.length < max && (
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-line text-[11px] text-muted hover:border-ink">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}Photo
        </button>
      )}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple hidden aria-label={label} onChange={(e) => { if (e.target.files?.length) void add(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

export function ReportIssueForm({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const blank = { storeId: locations.length === 1 ? locations[0].id : "", category: "EQUIPMENT" as (typeof CATEGORIES)[number][0], priority: "NORMAL" as (typeof PRIORITIES)[number][0], title: "", description: "", photos: [] as string[] };
  const [f, setF] = useState(blank);
  const [pending, start] = useTransition();
  return (
    <Card title="Report an issue">
      <form className="grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await reportIssueAction(f); if (r.ok) { toast.success(`Reported as ISS-${r.number}`); setF(blank); if (r.number) router.push(`/admin/issues/${r.number}`); } else toast.error(r.error); }); }}>
        {locations.length > 1 && <select className={input} value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })} aria-label="Location"><option value="">Which location?</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
        <select className={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as typeof f.category })} aria-label="Category">{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select className={input} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as typeof f.priority })} aria-label="Priority">{PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input className={cn(input, "sm:col-span-2")} placeholder="What's wrong? e.g. Receipt printer not printing" aria-label="What's wrong" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className={cn(input, "h-24 py-2 sm:col-span-2")} placeholder="Details: since when, what you tried, where exactly" aria-label="Details" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="sm:col-span-2"><IssuePhotos value={f.photos} onChange={(photos) => setF((cur) => ({ ...cur, photos }))} /></div>
        <div className="sm:col-span-2"><button className={btn} disabled={pending || !f.storeId || f.title.trim().length < 3}>{pending ? "Sending…" : "Send to HQ"}</button></div>
      </form>
    </Card>
  );
}

export function IssueComment({ id }: { id: string }) {
  const [f, setF] = useState({ message: "", photos: [] as string[] });
  const [pending, start] = useTransition();
  return (
    <form className="space-y-2 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await commentIssue(id, f); if (r.ok) setF({ message: "", photos: [] }); else toast.error(r.error); }); }}>
      <textarea className={cn(input, "h-20 py-2")} placeholder="Add a note or an update" aria-label="Note" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      <div className="flex flex-wrap items-center justify-between gap-2"><IssuePhotos value={f.photos} onChange={(photos) => setF((cur) => ({ ...cur, photos }))} /><button className={btn} disabled={pending || (!f.message.trim() && !f.photos.length)}>{pending ? "Adding…" : "Add note"}</button></div>
    </form>
  );
}

export function ManageIssue({ id, status, priority, assigneeId, cost, staff, full }: { id: string; status: string; priority: string; assigneeId: string | null; cost: number; staff: { id: string; name: string }[]; full: boolean }) {
  const init = { status, priority, assigneeId: assigneeId ?? "", cost: cost ? String(cost / 100) : "", note: "" };
  const [f, setF] = useState(init);
  const [pending, start] = useTransition();
  const resolving = f.status === "RESOLVED" && status !== "RESOLVED";
  const changed = f.status !== status || (full && (f.priority !== priority || f.assigneeId !== (assigneeId ?? "") || f.cost !== init.cost)) || f.note.trim();
  return (
    <form className="space-y-3 p-4" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await updateIssueAction(id, {
          status: f.status as "OPEN",
          ...(full ? { priority: f.priority as "NORMAL", assigneeId: f.assigneeId || null, cost: Number(f.cost) || 0 } : {}),
          note: f.note,
        });
        if (r.ok) { toast.success("Updated"); setF((cur) => ({ ...cur, note: "" })); } else toast.error(r.error);
      });
    }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[12.5px] text-muted">Status<select className={cn(input, "mt-1")} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        {full && <label className="text-[12.5px] text-muted">Priority<select className={cn(input, "mt-1")} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
        {full && <label className="text-[12.5px] text-muted">Who fixes it<select className={cn(input, "mt-1")} value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}><option value="">Nobody yet</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        {full && <label className="text-[12.5px] text-muted">Repair cost (Rs.)<input className={cn(input, "mt-1")} inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0" /></label>}
      </div>
      <textarea className={cn(input, "h-20 py-2")} placeholder={resolving ? "What was done to fix it? (required)" : "Note for the shop (optional)"} aria-label="Update note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <button className={btn} disabled={pending || !changed || (resolving && !f.note.trim())}>{pending ? "Saving…" : resolving ? "Mark resolved" : "Save"}</button>
    </form>
  );
}

export function ReopenIssue({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className={ghost} disabled={pending} onClick={() => { const why = prompt("What's still wrong?"); if (why?.trim()) start(async () => { const r = await reopenIssueAction(id, why); if (r.ok) toast.success("Reopened"); else toast.error(r.error); }); }}>Still broken: reopen</button>;
}
