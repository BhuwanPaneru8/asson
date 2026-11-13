"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, Link2, UserMinus } from "lucide-react";
import { addMember, changeAccess, newSignInLink, removeMember } from "@/actions/admin/team";
import { effectivePermissions, jobOf, JOBS, OWNER_ONLY, PERMISSION_INFO, PERMISSIONS, type JobKey, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const input = "h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
const btn = "h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40";
const GROUPS = ["Selling", "Orders", "Stock", "Team", "Money", "Insights", "Settings"] as const;

/** The one-time link, ready to copy or send on WhatsApp. */
function InviteLink({ name, link, phone }: { name: string; link: string; phone?: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = `Hi ${name.split(" ")[0]}, here's your link to set up your Asson staff login (it works once, for 7 days): ${link}`;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { toast.error("Couldn't copy: select the link instead."); } };
  return (
    <div className="mt-3 rounded-md border border-success/30 bg-success/5 p-3 text-[13.5px]">
      <p className="font-medium">Send this link to {name}. It works once, for 7 days.</p>
      <p className="mt-1.5 break-all rounded bg-white px-2 py-1.5 font-mono text-[12.5px]">{link}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[13px]">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy link"}</button>
        <a href={`https://wa.me/${phone ? `977${phone}` : ""}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[13px]">Send on WhatsApp</a>
      </div>
      <p className="mt-2 text-[12px] text-muted">They choose their own password; you never need to know it.</p>
    </div>
  );
}

function JobSelect({ id, value, onChange, allowOwner, label }: { id: string; value: JobKey; onChange: (j: JobKey) => void; allowOwner: boolean; label?: string }) {
  return (
    <select id={id} aria-label={label} className={input} value={value} onChange={(e) => onChange(e.target.value as JobKey)}>
      {JOBS.filter((j) => allowOwner || j.key !== "owner").map((j) => <option key={j.key} value={j.key}>{j.label}</option>)}
    </select>
  );
}

export function AddMember({ locations }: { locations: { id: string; name: string }[] }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", job: "cashier" as JobKey, all: false, storeIds: [] as string[] });
  const [done, setDone] = useState<{ name: string; link: string; phone: string } | null>(null);
  const [pending, start] = useTransition();
  const job = jobOf(f.job)!;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await addMember({ ...f, phone: f.phone || undefined });
      if (!r.ok) { toast.error(r.error); return; }
      setDone({ name: f.name, link: r.link, phone: f.phone });
      setF({ name: "", email: "", phone: "", job: f.job, all: false, storeIds: [] });
    });
  };
  return (
    <form onSubmit={submit} className="grid gap-3 p-5 sm:grid-cols-2">
      <label className="text-[12.5px] font-medium text-ink-soft">Full name<input id="m-name" className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" /></label>
      <label className="text-[12.5px] font-medium text-ink-soft">Email (their sign-in)<input id="m-email" type="email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="off" /></label>
      <label className="text-[12.5px] font-medium text-ink-soft">Mobile (optional)<input id="m-phone" inputMode="numeric" className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="98XXXXXXXX" /></label>
      <label className="text-[12.5px] font-medium text-ink-soft">Job<JobSelect id="m-job" label="Job" value={f.job} onChange={(job) => setF({ ...f, job })} allowOwner={false} /></label>
      <p className="text-[13px] text-muted sm:col-span-2">{job.description}</p>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-[12.5px] font-medium text-ink-soft">Works at</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13.5px]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.all} onChange={(e) => setF({ ...f, all: e.target.checked })} /> All locations (HQ)</label>
          {!f.all && locations.map((l) => <label key={l.id} className="flex items-center gap-2"><input type="checkbox" checked={f.storeIds.includes(l.id)} onChange={(e) => setF({ ...f, storeIds: e.target.checked ? [...f.storeIds, l.id] : f.storeIds.filter((x) => x !== l.id) })} /> {l.name}</label>)}
        </div>
      </fieldset>
      <div className="sm:col-span-2"><button className={btn} disabled={pending || f.name.trim().length < 2 || !f.email.includes("@") || (!f.all && !f.storeIds.length)}>{pending ? "Adding…" : "Add and get their link"}</button></div>
      {done && <div className="sm:col-span-2"><InviteLink name={done.name} link={done.link} phone={done.phone} /></div>}
    </form>
  );
}

type Member = { id: string; name: string; phone: string | null; job: JobKey; add: string[]; remove: string[] };

/** Job and fine-tuning for one person: the job's permissions are ticked; changes from the job are marked. */
export function AccessEditor({ m, isMe, canMakeOwner }: { m: Member; isMe: boolean; canMakeOwner: boolean }) {
  const [job, setJob] = useState<JobKey>(m.job);
  const [add, setAdd] = useState<string[]>(m.add);
  const [remove, setRemove] = useState<string[]>(m.remove);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const j = jobOf(job)!;
  const eff = useMemo(() => effectivePermissions(j.role, job, add, remove), [j.role, job, add, remove]);
  const changed = job !== m.job || add.join() !== m.add.join() || remove.join() !== m.remove.join();
  const toggle = (p: Permission, on: boolean) => {
    const inJob = j.permissions.includes(p);
    if (inJob) setRemove(on ? remove.filter((x) => x !== p) : [...remove, p]);
    else setAdd(on ? [...add, p] : add.filter((x) => x !== p));
  };
  const save = () => start(async () => {
    const r = await changeAccess({ userId: m.id, job, add, remove });
    if (r.ok) { toast.success(`${m.name}'s access saved`); setOpen(false); } else toast.error(r.error);
  });
  if (isMe) return <p className="text-[13px] text-muted">{j.label} · another owner changes your own access</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-56"><JobSelect id={`job-${m.id}`} label={`${m.name}'s job`} value={job} onChange={(v) => { setJob(v); setAdd([]); setRemove([]); }} allowOwner={canMakeOwner} /></div>
        <button type="button" onClick={() => setOpen(!open)} className="text-[13px] underline underline-offset-4">{open ? "Hide details" : `Sees ${eff.length} areas · fine-tune`}</button>
        {changed && <button type="button" onClick={save} disabled={pending} className="h-9 rounded-md bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-40">{pending ? "Saving…" : "Save"}</button>}
      </div>
      {(add.length > 0 || remove.length > 0) && <p className="text-[12.5px] text-warn">{add.length > 0 && `+ ${add.map((p) => PERMISSION_INFO[p as Permission].label).join("; ")}`}{add.length > 0 && remove.length > 0 && " · "}{remove.length > 0 && `− ${remove.map((p) => PERMISSION_INFO[p as Permission].label).join("; ")}`}</p>}
      {open && (
        <div className="grid gap-x-6 gap-y-3 rounded-md border border-line bg-cloud/30 p-4 sm:grid-cols-2">
          <p className="text-[12.5px] text-muted sm:col-span-2">{j.description} Ticked = can use. Changes from the job show in amber and apply to {m.name.split(" ")[0]} only.</p>
          {GROUPS.map((g) => {
            const ps = PERMISSIONS.filter((p) => PERMISSION_INFO[p].group === g);
            return (
              <fieldset key={g}>
                <legend className="mb-1 text-[11.5px] font-semibold uppercase tracking-wider text-muted">{g}</legend>
                {ps.map((p) => {
                  const ownerOnly = OWNER_ONLY.includes(p) && j.role !== "ADMIN";
                  const on = eff.includes(p), inJob = j.permissions.includes(p);
                  return (
                    <label key={p} className={cn("flex items-start gap-2 py-0.5 text-[13px]", ownerOnly && "opacity-50", on !== inJob && "font-medium text-warn")}>
                      <input type="checkbox" className="mt-0.5" checked={on} disabled={ownerOnly || p === "self.time" || j.role === "ADMIN"} onChange={(e) => toggle(p, e.target.checked)} />
                      <span>{PERMISSION_INFO[p].label}{ownerOnly && " (owner only)"}</span>
                    </label>
                  );
                })}
              </fieldset>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MemberActions({ id, name, phone }: { id: string; name: string; phone: string | null }) {
  const [link, setLink] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-[13px]">
        <button type="button" disabled={pending} onClick={() => start(async () => { const r = await newSignInLink(id); if (r.ok) setLink(r.link); else toast.error(r.error); })} className="inline-flex items-center gap-1 underline underline-offset-4"><Link2 className="h-3.5 w-3.5" /> New sign-in link</button>
        <button type="button" onClick={() => setRemoving(!removing)} className="inline-flex items-center gap-1 text-danger underline underline-offset-4"><UserMinus className="h-3.5 w-3.5" /> Remove access</button>
      </div>
      {removing && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await removeMember(id, reason); if (r.ok) toast.success(`${name} no longer has access and is signed out everywhere`); else toast.error(r.error); }); }}>
          <label className="min-w-56 flex-1 text-[12px] text-muted">Why (kept in the record)<input id={`why-${id}`} className={cn(input, "h-9")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. left the company on 30 Nov" /></label>
          <button className="h-9 rounded-md bg-danger px-3 text-[13px] font-medium text-white disabled:opacity-40" disabled={pending || reason.trim().length < 3}>Remove {name.split(" ")[0]}</button>
        </form>
      )}
      {link && <InviteLink name={name} link={link} phone={phone} />}
    </div>
  );
}
