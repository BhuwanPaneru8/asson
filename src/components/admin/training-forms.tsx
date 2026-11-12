"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loadStartersAction, saveSopAction, signOffAction } from "@/actions/admin/training";
import { cn } from "@/lib/utils";

const input = "w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-ink";
const btn = "h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40";
const AREAS = [["SALES", "Selling"], ["CASH", "Cash"], ["FULFILMENT", "Online orders"], ["STOCK", "Stock"], ["CUSTOMERS", "Customers"], ["PEOPLE", "People"]] as const;
const ROLES = [["CASHIER", "Cashiers"], ["STAFF", "Fulfilment staff"], ["MANAGER", "Managers"], ["ADMIN", "Owner"]] as const;
type Area = (typeof AREAS)[number][0];

export function SignOff({ sopId, state }: { sopId: string; state: string }) {
  const [pending, start] = useTransition();
  if (state === "signed") return <p className="rounded-md bg-success/10 px-4 py-3 text-[14px] text-success">You&apos;ve signed this version.</p>;
  return <button className={cn(btn, "w-full")} disabled={pending} onClick={() => start(async () => { const r = await signOffAction(sopId); if (r.ok) toast.success("Signed: thank you"); else toast.error(r.error); })}>{state === "changed" ? "It has changed: I've read the new version and will follow it" : "I've read this and will follow it"}</button>;
}

export function LoadStarters() {
  const [pending, start] = useTransition();
  return <button className={btn} disabled={pending} onClick={() => start(async () => { const r = await loadStartersAction(); if (r.ok) toast.success(`${r.result.added} procedure(s) added: edit them to fit how you work`); else toast.error(r.error); })}>Load the starter procedures</button>;
}

export function SopEditor({ sop }: { sop?: { id: string; title: string; area: Area; roles: string[]; body: string; active: boolean } }) {
  const router = useRouter();
  const [f, setF] = useState({ title: sop?.title ?? "", area: (sop?.area ?? "SALES") as Area, roles: sop?.roles ?? ["CASHIER", "MANAGER"], body: sop?.body ?? "## Steps\n1. \n", major: false, active: sop?.active ?? true });
  const [pending, start] = useTransition();
  return (
    <form className="space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await saveSopAction({ id: sop?.id, ...f });
      if (r.ok) { toast.success(f.major || !sop ? "Saved: staff will be asked to sign it" : "Saved"); router.push(`/admin/training/${r.result}`); } else toast.error(r.error);
    }); }}>
      <label className="block text-[13px] font-medium">Title<input className={cn(input, "mt-1")} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="block text-[13px] font-medium">Area<select className={cn(input, "mt-1")} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value as Area })}>{AREAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <fieldset className="text-[13px]"><legend className="font-medium">Who must sign it</legend>
        <div className="mt-1 flex flex-wrap gap-3">{ROLES.map(([v, l]) => <label key={v} className="flex items-center gap-1.5"><input type="checkbox" checked={f.roles.includes(v)} onChange={(e) => setF({ ...f, roles: e.target.checked ? [...f.roles, v] : f.roles.filter((r) => r !== v) })} /> {l}</label>)}</div>
      </fieldset>
      <label className="block text-[13px] font-medium">The procedure<span className="block font-normal text-muted">&ldquo;## &rdquo; starts a heading, &ldquo;1. &rdquo; a step, &ldquo;- &rdquo; a point.</span>
        <textarea className={cn(input, "mt-1 min-h-[320px] font-mono text-[13px]")} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
      {sop && <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={f.major} onChange={(e) => setF({ ...f, major: e.target.checked })} /> A real change: everyone signs again (leave unticked for a typo)</label>}
      {sop && <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={!f.active} onChange={(e) => setF({ ...f, active: !e.target.checked })} /> Retire this procedure</label>}
      <button className={btn} disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
