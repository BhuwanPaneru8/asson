"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { acknowledgeVisit, answerItem, checkVisitAction, completeVisitAction, discardVisit, saveVisitTemplate, startVisitAction, submitVisitAction } from "@/actions/admin/visits";
import { cn } from "@/lib/utils";
import { IssuePhotos } from "./issue-forms";

const input = "h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
const btn = "h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40";
const ghost = "h-10 rounded-md border border-line px-4 text-[14px] hover:border-ink disabled:opacity-40";

type Section = { name: string; items: { text: string; critical?: boolean }[] };
/** "# Section" lines start a section; "!" in front of an item marks it critical. */
const toText = (s: Section[]) => s.map((x) => [`# ${x.name}`, ...x.items.map((i) => `${i.critical ? "! " : ""}${i.text}`)].join("\n")).join("\n\n");
function fromText(t: string): Section[] {
  const out: Section[] = [];
  for (const raw of t.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) out.push({ name: line.replace(/^#+\s*/, ""), items: [] });
    else { if (!out.length) out.push({ name: "General", items: [] }); out[out.length - 1].items.push(line.startsWith("!") ? { text: line.replace(/^!\s*/, ""), critical: true } : { text: line }); }
  }
  return out;
}

export function VisitTemplateEditor({ initial }: { initial?: { id: string; name: string; sections: Section[]; active: boolean } }) {
  const [open, setOpen] = useState(!initial);
  const [f, setF] = useState({ name: initial?.name ?? "Monthly store visit", text: initial ? toText(initial.sections) : "# Outside and window\nShop front clean, sign lit\nWindow matches the current brief\n\n# Sales floor\nRails full, sizes in order\nPrice tags on every item\nFitting rooms clean, no stock left inside\n\n# Till and cash\n! Till counted at shift change, variance logged\nReceipts given for every sale\n\n# Stockroom\nDeliveries put away within a day\n\n# Safety\n! Fire extinguisher in date and reachable\n! Exits clear\n\n# Team and service\nStaff greet customers within a minute\nUniforms and name badges", active: initial?.active ?? true });
  const [pending, start] = useTransition();
  if (!open) return <button className="text-[13px] underline underline-offset-4" onClick={() => setOpen(true)}>Edit</button>;
  return (
    <form className="space-y-2 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveVisitTemplate({ id: initial?.id, name: f.name, sections: fromText(f.text), active: f.active }); if (r.ok) { toast.success("Saved"); if (initial) setOpen(false); } else toast.error(r.error); }); }}>
      <input className={input} aria-label="Checklist name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <textarea className={cn(input, "h-72 py-2 font-mono text-[13px]")} aria-label="Visit items" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <p className="text-[12px] text-muted">“# Name” starts a section. Put “!” in front of critical items (safety, cash, legal): they must be fixed in 2 days instead of 7.</p>
      <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" className="accent-ink" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> In use</label><button className={btn} disabled={pending}>{pending ? "Saving…" : initial ? "Save checklist" : "Add checklist"}</button></div>
    </form>
  );
}

export function StartVisit({ templates, shops }: { templates: { id: string; name: string }[]; shops: { id: string; name: string }[] }) {
  const router = useRouter();
  const [t, setT] = useState(templates[0]?.id ?? "");
  const [s, setS] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2 p-4 sm:grid-cols-[1fr_1fr_auto]">
      <select className={input} value={t} onChange={(e) => setT(e.target.value)} aria-label="Visit checklist">{templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select className={input} value={s} onChange={(e) => setS(e.target.value)} aria-label="Shop to visit"><option value="">Which shop?</option>{shops.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <button className={btn} disabled={pending || !t || !s} onClick={() => start(async () => { const r = await startVisitAction(t, s); if (r.ok) router.push(`/admin/visits/${r.number}`); else toast.error(r.error); })}>{pending ? "Starting…" : "Start visit"}</button>
    </div>
  );
}

type Item = { section: string; text: string; critical: boolean; result?: "PASS" | "FAIL" | "NA"; note?: string; photos?: string[] };

/** The walk-through: each answer is saved as soon as it's given. */
export function VisitWalk({ id, items: initial }: { id: string; items: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [summary, setSummary] = useState("");
  const [pending, start] = useTransition();
  const save = (i: number, patch: Partial<Item>) => {
    const next = { ...items[i], ...patch };
    setItems((cur) => cur.map((x, j) => (j === i ? next : x)));
    void answerItem(id, i, { result: next.result ?? null, note: next.note ?? "", photos: next.photos ?? [] }).then((r) => { if (!r.ok) toast.error(r.error); });
  };
  const answered = items.filter((i) => i.result).length;
  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-line bg-white/95 px-5 py-2.5 text-[13px] backdrop-blur">{answered}/{items.length} answered · {items.filter((i) => i.result === "FAIL").length} to fix</div>
      <ul>{items.map((it, i) => {
        const head = i === 0 || items[i - 1].section !== it.section ? it.section : null;
        return (
          <li key={i} className="border-b border-line">
            {head && <p className="bg-cloud/50 px-5 py-2 text-[12px] font-semibold uppercase tracking-wider text-muted">{head}</p>}
            <div className="space-y-2 px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14.5px]">{it.critical && <span className="mr-1.5 rounded bg-danger/10 px-1.5 py-0.5 text-[11px] font-semibold text-danger">CRITICAL</span>}{it.text}</p>
                <span className="flex gap-1" role="radiogroup" aria-label={it.text}>{(["PASS", "FAIL", "NA"] as const).map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={it.result === r} onClick={() => save(i, { result: r })} className={cn("h-9 rounded-md border px-3 text-[13px]", it.result === r ? (r === "PASS" ? "border-success bg-success text-white" : r === "FAIL" ? "border-danger bg-danger text-white" : "border-ink bg-ink text-white") : "border-line bg-white")}>{r === "PASS" ? "Pass" : r === "FAIL" ? "Fail" : "N/A"}</button>
                ))}</span>
              </div>
              {(it.result === "FAIL" || it.note || it.photos?.length) && (
                <div className="space-y-2">
                  <input className={cn(input, it.result === "FAIL" && !it.note?.trim() && "border-danger")} placeholder={it.result === "FAIL" ? "What's wrong? (required)" : "Note"} aria-label={`Note: ${it.text}`} defaultValue={it.note ?? ""} onBlur={(e) => { if (e.target.value !== (it.note ?? "")) save(i, { note: e.target.value }); }} />
                  <IssuePhotos value={it.photos ?? []} onChange={(photos) => save(i, { photos })} max={4} purpose="visit" label={`Photo: ${it.text}`} />
                </div>
              )}
            </div>
          </li>
        );
      })}</ul>
      <div className="space-y-2 p-5">
        <textarea className={cn(input, "h-24 py-2")} placeholder="Summary for the shop and HQ: what's good, what matters most" aria-label="Visit summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={pending || answered < items.length} onClick={() => start(async () => { const r = await submitVisitAction(id, summary); if (r.ok) toast.success("Visit submitted"); else toast.error(r.error); })}>{pending ? "Submitting…" : answered < items.length ? `Answer ${items.length - answered} more` : "Submit visit"}</button>
          <button className={ghost} disabled={pending} onClick={() => confirm("Delete this draft visit?") && start(async () => { const r = await discardVisit(id); if (r.ok) router.push("/admin/visits"); else toast.error(r.error); })}>Delete draft</button>
        </div>
      </div>
    </div>
  );
}

export function AcknowledgeVisit({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 p-4">
      <input className={input} placeholder="Reply to the auditor (optional)" aria-label="Acknowledgement note" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className={btn} disabled={pending} onClick={() => start(async () => { const r = await acknowledgeVisit(id, note); if (r.ok) toast.success("Acknowledged"); else toast.error(r.error); })}>I&apos;ve read this visit</button>
    </div>
  );
}

export function FixAction({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [pending, start] = useTransition();
  if (!open) return <button className="h-8 rounded-md border border-line px-3 text-[13px] hover:border-ink" onClick={() => setOpen(true)}>Mark fixed</button>;
  return (
    <div className="mt-2 w-full space-y-2">
      <input className={input} placeholder="What was done" aria-label="What was done" value={note} onChange={(e) => setNote(e.target.value)} />
      <IssuePhotos value={photos} onChange={setPhotos} max={4} purpose="visit" label="Photo of the fix" />
      <button className={btn} disabled={pending || !note.trim()} onClick={() => start(async () => { const r = await completeVisitAction(id, note, photos); if (r.ok) toast.success("Marked fixed"); else toast.error(r.error); })}>Save</button>
    </div>
  );
}

export function CheckAction({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const go = (ok: boolean) => start(async () => { const r = await checkVisitAction(id, ok); if (r.ok) toast.success(ok ? "Verified" : "Sent back"); else toast.error(r.error); });
  return <span className="flex gap-1.5"><button className="h-8 rounded-md bg-ink px-3 text-[13px] text-white disabled:opacity-40" disabled={pending} onClick={() => go(true)}>Verify fix</button><button className="h-8 rounded-md border border-line px-3 text-[13px] disabled:opacity-40" disabled={pending} onClick={() => go(false)}>Not fixed</button></span>;
}
