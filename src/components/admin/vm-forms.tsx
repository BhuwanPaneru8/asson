"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { closeBriefAction, createBriefAction, reviewDisplay, submitDisplay } from "@/actions/admin/vm";
import { cn } from "@/lib/utils";
import { IssuePhotos } from "./issue-forms";
import { Card } from "./ui";

const input = "h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
const btn = "h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40";
const ghost = "h-10 rounded-md border border-line px-4 text-[14px] hover:border-ink disabled:opacity-40";
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function NewBriefForm({ shops, minDate }: { shops: { id: string; name: string }[]; minDate: string }) {
  const router = useRouter();
  const [f, setF] = useState({ title: "", instructions: "", refPhotos: [] as string[], areas: "Window\nEntrance table", criteria: "Colours and styling match the reference\nPrice tags visible and correct\nClean, lit, nothing missing", storeIds: [] as string[], due: "" });
  const [pending, start] = useTransition();
  return (
    <Card title="New display brief">
      <form className="space-y-3 p-4" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createBriefAction({ title: f.title, instructions: f.instructions, refPhotos: f.refPhotos, areas: lines(f.areas).map((name) => ({ name })), criteria: lines(f.criteria).map((text) => ({ text })), storeIds: f.storeIds, due: f.due });
          if (r.ok) { toast.success(`Sent as VM-${r.number}`); router.push(`/admin/vm/${r.number}`); } else toast.error(r.error);
        });
      }}>
        <input className={input} placeholder="Title, e.g. Dashain window" aria-label="Brief title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className={cn(input, "h-24 py-2")} placeholder="How it should look: colours, which products, where" aria-label="Instructions" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
        <div><p className="mb-1.5 text-[12.5px] font-medium text-ink-soft">Reference photos</p><IssuePhotos value={f.refPhotos} onChange={(refPhotos) => setF((c) => ({ ...c, refPhotos }))} purpose="vm" label="Add reference photo" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[12.5px] text-muted">Shots each shop sends (one per line)<textarea className={cn(input, "mt-1 h-24 py-2")} aria-label="Shots" value={f.areas} onChange={(e) => setF({ ...f, areas: e.target.value })} /></label>
          <label className="text-[12.5px] text-muted">Scored 0–2 each (one per line)<textarea className={cn(input, "mt-1 h-24 py-2")} aria-label="Scoring points" value={f.criteria} onChange={(e) => setF({ ...f, criteria: e.target.value })} /></label>
        </div>
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-ink-soft">To {f.storeIds.length ? `${f.storeIds.length} shop(s)` : "every shop"}</p>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">{shops.map((s) => {
            const on = f.storeIds.includes(s.id);
            return <button type="button" key={s.id} onClick={() => setF({ ...f, storeIds: on ? f.storeIds.filter((x) => x !== s.id) : [...f.storeIds, s.id] })} className={cn("rounded-full border px-3 py-1 text-[13px]", on ? "border-ink bg-ink text-white" : "border-line bg-white")}>{s.name}</button>;
          })}</div>
        </div>
        <label className="block text-[12.5px] text-muted">Shops send photos by<input type="date" min={minDate} className={cn(input, "mt-1 w-48")} aria-label="Due date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
        <button className={btn} disabled={pending || f.title.trim().length < 3 || !f.due || !lines(f.areas).length || !lines(f.criteria).length}>{pending ? "Sending…" : "Send brief"}</button>
      </form>
    </Card>
  );
}

export function SubmitDisplay({ briefId, storeId, areas, redo }: { briefId: string; storeId: string; areas: { name: string; hint?: string }[]; redo: boolean }) {
  const [shots, setShots] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const ready = areas.every((a) => shots[a.name]?.length);
  return (
    <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await submitDisplay({ briefId, storeId, note, photos: areas.flatMap((a) => (shots[a.name] ?? []).map((url) => ({ area: a.name, url }))) });
      if (r.ok) { toast.success("Sent to HQ"); setShots({}); setNote(""); } else toast.error(r.error);
    }); }}>
      {areas.map((a) => (
        <div key={a.name}>
          <p className="text-[14px] font-medium">{a.name}{a.hint && <span className="ml-1.5 text-[12.5px] font-normal text-muted">{a.hint}</span>}</p>
          <div className="mt-1.5"><IssuePhotos value={shots[a.name] ?? []} onChange={(v) => setShots((s) => ({ ...s, [a.name]: v }))} max={4} purpose="vm" label={`Photo of ${a.name}`} /></div>
        </div>
      ))}
      <input className={input} placeholder="Note for HQ (optional)" aria-label="Note for HQ" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className={btn} disabled={pending || !ready}>{pending ? "Sending…" : redo ? "Send again" : "Send photos"}</button>
    </form>
  );
}

export function ReviewDisplay({ submissionId, round, criteria }: { submissionId: string; round: number; criteria: { text: string }[] }) {
  const [scores, setScores] = useState<(number | null)[]>(criteria.map(() => null));
  const [feedback, setFeedback] = useState("");
  const [pending, start] = useTransition();
  const go = (approve: boolean) => start(async () => {
    const r = await reviewDisplay({ submissionId, round, approve, feedback, scores: approve ? (scores as number[]) : undefined });
    if (r.ok) toast.success(approve ? "Approved" : "Redo asked"); else toast.error(r.error);
  });
  return (
    <div className="space-y-3 p-4">
      {criteria.map((c, i) => (
        <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
          <span>{c.text}</span>
          <span className="flex gap-1" role="radiogroup" aria-label={c.text}>{[0, 1, 2].map((v) => (
            <button key={v} type="button" role="radio" aria-checked={scores[i] === v} onClick={() => setScores(scores.map((x, j) => (j === i ? v : x)))} className={cn("h-8 w-9 rounded-md border text-[13px]", scores[i] === v ? "border-ink bg-ink text-white" : "border-line bg-white")}>{v}</button>
          ))}</span>
        </div>
      ))}
      <textarea className={cn(input, "h-20 py-2")} placeholder="Feedback for the shop (needed for a redo)" aria-label="Feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button className={btn} disabled={pending || scores.some((s) => s === null)} onClick={() => go(true)}>Approve</button>
        <button className={ghost} disabled={pending || !feedback.trim()} onClick={() => go(false)}>Ask for a redo</button>
      </div>
    </div>
  );
}

export function CloseBrief({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button className={ghost} disabled={pending} onClick={() => confirm("Close this brief? Shops can't send photos after this.") && start(async () => { const r = await closeBriefAction(id); if (r.ok) toast.success("Closed"); else toast.error(r.error); })}>Close brief</button>;
}
