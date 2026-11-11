"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { copyWeekAction, publishWeekAction, removeHolidayAction, saveHolidayAction, saveWeekAction, setMinStaffAction } from "@/actions/admin/rosters";
import { cn } from "@/lib/utils";

const btn = "h-10 rounded-md bg-ink px-4 text-[13.5px] font-medium text-white disabled:opacity-40";
const ghost = "h-10 rounded-md border border-line bg-white px-3 text-[13.5px] hover:border-ink disabled:opacity-40";
const input = "h-10 rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";

type Day = { date: string; shift: { start: string; end: string } | null; elsewhere: string | null; leave: string | null };
type Row = { id: string; name: string; role: string; assigned: boolean; days: Day[] };
type Head = { date: string; weekday: string; holiday: string | null };

const short = (t: string) => t.replace(/:00$/, "").replace(/^0(\d)/, "$1");
const label = (s: { start: string; end: string } | null) => (s ? `${short(s.start)}-${short(s.end)}` : "");
/** Hours of a typed cell, or null if it isn't a shift (the server has the real check). */
function hoursOf(v: string) {
  const m = v.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|–|to)\s*(\d{1,2})(?:[:.](\d{2}))?$/i);
  if (!m) return null;
  const a = Number(m[1]) * 60 + Number(m[2] ?? 0), b = Number(m[3]) * 60 + Number(m[4] ?? 0);
  return b > a && Number(m[3]) <= 23 ? (b - a) / 60 : null;
}

/** The week planner: one row per person, one cell per day, typed like 10-18. */
export function RosterGrid({ storeId, weekStart, heads, rows, minStaff, maxHours }: { storeId: string; weekStart: string; heads: Head[]; rows: Row[]; minStaff: number; maxHours: number }) {
  const initial = useMemo(() => Object.fromEntries(rows.flatMap((r) => r.days.map((d) => [`${r.id}|${d.date}`, label(d.shift)]))), [rows]);
  const [v, setV] = useState<Record<string, string>>(initial);
  const [pending, start] = useTransition();
  const changed = Object.keys(v).filter((k) => (v[k] ?? "").trim() !== (initial[k] ?? ""));
  const dirty = changed.length > 0;
  const bad = (k: string) => !!v[k]?.trim() && !/^(off|-)$/i.test(v[k].trim()) && hoursOf(v[k]) == null;
  const save = () => start(async () => {
    const r = await saveWeekAction({ storeId, weekStart, cells: changed.map((k) => { const [userId, date] = k.split("|"); return { userId, date, value: v[k] ?? "" }; }) });
    if (r.ok) toast.success(`Saved: ${r.result.set} set, ${r.result.removed} removed`); else toast.error(r.error, { duration: 10_000 });
  });
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13.5px]">
          <thead className="border-b border-line bg-cloud/40 text-left text-[11.5px] uppercase tracking-wider text-muted">
            <tr><th className="sticky left-0 bg-cloud px-3 py-2">Person</th>{heads.map((h) => {
              const staff = rows.filter((r) => hoursOf(v[`${r.id}|${h.date}`] ?? "") != null).length;
              return <th key={h.date} className="px-1.5 py-2 text-center font-medium"><span className="block">{h.weekday} {Number(h.date.slice(8))}</span>{h.holiday ? <span className="block normal-case text-accent" title={h.holiday}>holiday</span> : <span className={cn("block normal-case tracking-normal", staff < minStaff ? "font-semibold text-danger" : "text-muted")}>{staff}/{minStaff} staff</span>}</th>;
            })}<th className="px-3 text-right">Hours</th></tr>
          </thead>
          <tbody className="divide-y divide-line">{rows.map((r) => {
            const hours = r.days.reduce((s, d) => s + (hoursOf(v[`${r.id}|${d.date}`] ?? "") ?? 0), 0);
            return (
              <tr key={r.id}>
                <td className="sticky left-0 bg-white px-3 py-1.5"><span className="font-medium">{r.name}</span><span className="block text-[11.5px] text-muted">{r.role.toLowerCase()}{!r.assigned && " · moved"}</span></td>
                {r.days.map((d) => {
                  const k = `${r.id}|${d.date}`;
                  if (d.elsewhere) return <td key={d.date} className="px-1.5 py-1.5 text-center text-[11.5px] text-muted">at {d.elsewhere}</td>;
                  if (d.leave === "leave") return <td key={d.date} className="px-1.5 py-1.5 text-center text-[12px] font-medium text-accent">Leave</td>;
                  return (
                    <td key={d.date} className="px-1 py-1.5">
                      <input className={cn("h-9 w-full min-w-[84px] rounded-md border bg-white px-1.5 text-center font-mono text-[13px] outline-none placeholder:font-sans focus:border-ink", bad(k) ? "border-danger text-danger focus:border-danger" : (v[k] ?? "") !== (initial[k] ?? "") ? "border-line bg-accent-soft/60" : "border-line", d.leave && "bg-[#fbeee0]")}
                        value={v[k] ?? ""} placeholder={d.leave ? "leave?" : "off"} disabled={!r.assigned && !initial[k]} aria-label={`${r.name} ${d.date}`}
                        onChange={(e) => setV({ ...v, [k]: e.target.value })} />
                    </td>
                  );
                })}
                <td className={cn("px-3 text-right tabular-nums", hours > maxHours && "font-semibold text-danger")}>{Math.round(hours * 10) / 10}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line p-4">
        <button className={btn} disabled={pending || !dirty || changed.some(bad)} onClick={save}>{pending ? "Saving…" : dirty ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "Saved"}</button>
        <button className={ghost} disabled={pending || dirty} onClick={() => start(async () => { const r = await copyWeekAction(storeId, weekStart); if (r.ok) toast.success(`${r.result.set} shift(s) copied from last week${r.result.skipped ? `, ${r.result.skipped} skipped (leave, moved or already set)` : ""}`); else toast.error(r.error); })}>Copy last week</button>
        <button className={ghost} disabled={pending || dirty} onClick={() => start(async () => { const r = await publishWeekAction(storeId, weekStart); if (r.ok) toast.success(`Published: staff can see their ${r.result.shifts} shifts`); else toast.error(r.error); })}>Publish to staff</button>
        <p className="text-[12.5px] text-muted">Type shifts like 10-18 or 9:30-17:30; leave empty for a day off.{dirty ? " Save before copying or publishing." : ""}</p>
      </div>
    </div>
  );
}

export function MinStaff({ storeId, value }: { storeId: string; value: number }) {
  const [n, setN] = useState(String(value));
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2 text-[13px]">Staff needed each day <input className={cn(input, "h-8 w-14 text-center")} inputMode="numeric" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, ""))} aria-label="Minimum staff per day" />
      {n !== String(value) && <button className="h-8 rounded-md bg-ink px-3 text-[12.5px] text-white disabled:opacity-40" disabled={pending} onClick={() => start(async () => { const r = await setMinStaffAction(storeId, Number(n)); if (r.ok) toast.success("Saved"); else toast.error(r.error); })}>Save</button>}
    </span>
  );
}

export function Holidays({ list, canEdit }: { list: { date: string; name: string }[]; canEdit: boolean }) {
  const [f, setF] = useState({ date: "", name: "" });
  const [pending, start] = useTransition();
  return (
    <div>
      {list.length ? <ul className="divide-y divide-line text-[13.5px]">{list.map((h) => (
        <li key={h.date} className="flex items-center justify-between gap-3 px-4 py-2"><span><span className="tabular-nums text-muted">{h.date}</span> {h.name}</span>{canEdit && <button className="text-[12.5px] text-muted underline hover:text-danger disabled:opacity-40" disabled={pending} onClick={() => start(async () => { const r = await removeHolidayAction(h.date); if (!r.ok) toast.error(r.error); })}>Remove</button>}</li>
      ))}</ul> : <p className="px-4 py-3 text-[13.5px] text-muted">No public holidays entered for the coming weeks.</p>}
      {canEdit && (
        <form className="flex flex-wrap gap-2 border-t border-line p-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveHolidayAction(f.date, f.name); if (r.ok) { toast.success("Holiday saved"); setF({ date: "", name: "" }); } else toast.error(r.error); }); }}>
          <input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Holiday date" />
          <input className={cn(input, "min-w-0 flex-1")} placeholder="e.g. Dashain (Bijaya Dashami)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Holiday name" />
          <button className={btn} disabled={pending || !f.date || !f.name.trim()}>Add</button>
        </form>
      )}
    </div>
  );
}
