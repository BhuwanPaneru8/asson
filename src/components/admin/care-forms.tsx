"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { logCase, noteCase, replyCase, updateCaseAction } from "@/actions/admin/care";
import { cn } from "@/lib/utils";
import { Card } from "./ui";

const input = "h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
const btn = "h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40";
const ghost = "h-10 rounded-md border border-line px-4 text-[14px] hover:border-ink disabled:opacity-40";

export const CATEGORIES = [["ORDER", "Order"], ["DELIVERY", "Delivery"], ["PAYMENT", "Payment / refund"], ["QUALITY", "Faulty item"], ["EXCHANGE", "Size / exchange"], ["SERVICE", "Shop service"], ["OTHER", "Other"]] as const;
const CHANNELS = [["PHONE", "Phone call"], ["WHATSAPP", "WhatsApp"], ["SHOP", "In a shop"], ["EMAIL", "Email"], ["SOCIAL", "Facebook / Instagram / TikTok"]] as const;
const PRIORITIES = [["URGENT", "Urgent"], ["NORMAL", "Normal"], ["LOW", "Low"]] as const;

export function LogCaseForm({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ channel: "PHONE", category: "ORDER", priority: "NORMAL", name: "", phone: "", email: "", order: "", storeId: "", subject: "", message: "" });
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Card title="Log a case">
      <form className="grid gap-3 p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await logCase(f as Parameters<typeof logCase>[0]); if (r.ok) { toast.success(`Logged as C-${r.number}`); router.push(`/admin/care/${r.number}`); } else toast.error(r.error); }); }}>
        <select className={input} value={f.channel} onChange={set("channel")} aria-label="Came in by">{CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select className={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, priority: e.target.value === "PAYMENT" && f.priority === "NORMAL" ? "URGENT" : f.priority })} aria-label="Category">{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select className={input} value={f.priority} onChange={set("priority")} aria-label="Priority">{PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input className={input} placeholder="Customer's name" aria-label="Customer's name" value={f.name} onChange={set("name")} />
        <input className={input} placeholder="Mobile 98XXXXXXXX" aria-label="Customer's mobile" inputMode="tel" value={f.phone} onChange={set("phone")} />
        <input className={input} placeholder="Email (optional)" aria-label="Customer's email" value={f.email} onChange={set("email")} />
        <input className={input} placeholder="Order number (optional)" aria-label="Order number" value={f.order} onChange={set("order")} />
        <select className={cn(input, "sm:col-span-2")} value={f.storeId} onChange={set("storeId")} aria-label="About a shop"><option value="">Not about a particular shop</option>{locations.map((l) => <option key={l.id} value={l.id}>About {l.name}</option>)}</select>
        <input className={cn(input, "sm:col-span-3")} placeholder="In a few words, e.g. Wrong size delivered" aria-label="Subject" value={f.subject} onChange={set("subject")} />
        <textarea className={cn(input, "h-28 py-2 sm:col-span-3")} placeholder="What the customer said" aria-label="What the customer said" value={f.message} onChange={set("message")} />
        <div className="sm:col-span-3"><button className={btn} disabled={pending || !f.name || (!f.phone && !f.email) || !f.subject || !f.message}>{pending ? "Logging…" : "Log case"}</button></div>
      </form>
    </Card>
  );
}

/** Reply to the customer (they get an SMS with the link) or write a staff-only note. */
export function CaseCompose({ id, hasPhone }: { id: string; hasPhone: boolean }) {
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const send = (resolve: boolean) => start(async () => {
    const r = mode === "note" ? await noteCase(id, body) : await replyCase(id, body, resolve);
    if (r.ok) { setBody(""); toast.success(mode === "note" ? "Note added" : resolve ? "Replied and resolved" : "Reply sent"); } else toast.error(r.error);
  });
  return (
    <div className={cn("space-y-2 p-4", mode === "note" && "bg-accent-soft/30")}>
      <div className="flex gap-1.5 text-[13px]">
        <button type="button" onClick={() => setMode("reply")} className={cn("rounded-full border px-3 py-1", mode === "reply" ? "border-ink bg-ink text-white" : "border-line bg-white")}>Reply to customer</button>
        <button type="button" onClick={() => setMode("note")} className={cn("rounded-full border px-3 py-1", mode === "note" ? "border-ink bg-ink text-white" : "border-line bg-white")}>Internal note</button>
      </div>
      <textarea className={cn(input, "h-28 py-2")} value={body} onChange={(e) => setBody(e.target.value)} aria-label={mode === "note" ? "Internal note" : "Reply to customer"} placeholder={mode === "note" ? "Only staff see this" : "The customer sees this on their case page"} />
      <p className="text-[12px] text-muted">{mode === "note" ? "Not shown to the customer." : hasPhone ? "They'll get an SMS with a link to read it." : "No mobile number: they'll see it on their case page (email them the link)."}</p>
      <div className="flex flex-wrap gap-2">
        {mode === "reply" ? <>
          <button className={btn} disabled={pending || !body.trim()} onClick={() => send(false)}>{pending ? "Sending…" : "Send reply"}</button>
          <button className={ghost} disabled={pending || !body.trim()} onClick={() => send(true)}>Send and resolve</button>
        </> : <button className={btn} disabled={pending || !body.trim()} onClick={() => send(false)}>{pending ? "Saving…" : "Add note"}</button>}
      </div>
    </div>
  );
}

export function CaseTriage({ id, status, priority, category, assigneeId, storeId, order, staff, locations }: { id: string; status: string; priority: string; category: string; assigneeId: string | null; storeId: string | null; order: string; staff: { id: string; name: string }[]; locations: { id: string; name: string }[] }) {
  const init = { status, priority, category, assigneeId: assigneeId ?? "", storeId: storeId ?? "", order };
  const [f, setF] = useState(init);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const changed = (Object.keys(init) as (keyof typeof init)[]).filter((k) => f[k] !== init[k]);
  return (
    <form className="grid gap-2 p-4" onSubmit={(e) => {
      e.preventDefault();
      const ch: Record<string, unknown> = {};
      for (const k of changed) ch[k] = k === "assigneeId" || k === "storeId" ? f[k] || null : k === "order" ? f.order.trim() || null : f[k];
      start(async () => { const r = await updateCaseAction(id, ch); if (r.ok) toast.success("Updated"); else toast.error(r.error); });
    }}>
      <label className="text-[12.5px] text-muted">Status<select className={cn(input, "mt-1")} value={f.status} onChange={set("status")}>{status === "NEW" && <option value="NEW" disabled>New</option>}<option value="OPEN">Open</option><option value="WAITING">Waiting for customer</option><option value="RESOLVED">Resolved</option></select></label>
      <label className="text-[12.5px] text-muted">Who handles it<select className={cn(input, "mt-1")} value={f.assigneeId} onChange={set("assigneeId")}><option value="">Nobody yet</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[12.5px] text-muted">Priority<select className={cn(input, "mt-1")} value={f.priority} onChange={set("priority")}>{PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-[12.5px] text-muted">Category<select className={cn(input, "mt-1")} value={f.category} onChange={set("category")}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      <label className="text-[12.5px] text-muted">About a shop<select className={cn(input, "mt-1")} value={f.storeId} onChange={set("storeId")}><option value="">No particular shop</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label className="text-[12.5px] text-muted">Order<input className={cn(input, "mt-1")} value={f.order} onChange={set("order")} placeholder="AS000123" /></label>
      <button className={btn} disabled={pending || !changed.length}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
