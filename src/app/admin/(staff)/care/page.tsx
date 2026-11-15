import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { CATEGORY_LABEL, CHANNEL_LABEL, careRef, careStats, listCases, STATUS_LABEL, type CareFilter } from "@/lib/care";
import { scopeFor } from "@/lib/scope";
import { cn, formatDateTime, formatOrderNumber, now } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";

export const metadata = { title: "Customer care" };

const VIEWS = [["open", "Needs a reply"], ["overdue", "Overdue"], ["unassigned", "Unassigned"], ["mine", "Mine"], ["waiting", "Waiting for customer"], ["resolved", "Resolved"], ["all", "All"]] as const;
const ago = (d: Date, at: number) => { const m = Math.round((at - d.getTime()) / 60_000); return m < 60 ? `${m}m` : m < 48 * 60 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };

export default async function CarePage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const me = await requirePermission("care");
  const sp = await searchParams;
  const view = (VIEWS.find(([v]) => v === sp.view)?.[0] ?? "open") as NonNullable<CareFilter["view"]>;
  const q = String(sp.q ?? "").slice(0, 60);
  const [cases, stats] = await Promise.all([listCases(me, { view, q }), careStats(await scopeFor(me), me.id)]);
  const at = now();
  return (
    <>
      <PageHeader title="Customer care" description="Every complaint and order problem, from the website, phone, WhatsApp, shops and social media, in one queue." actions={<Link href="/admin/care/new" className="h-10 rounded-md bg-ink px-4 py-2.5 text-[14px] font-medium text-white">Log a case</Link>} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[["Need a reply", stats.open, false], ["Overdue", stats.overdue, stats.overdue > 0], ["Median first reply (30 d)", stats.medianFirstReplyHours == null ? "—" : stats.medianFirstReplyHours < 1 ? `${Math.round(stats.medianFirstReplyHours * 60)} min` : `${stats.medianFirstReplyHours.toFixed(1)} h`, false], ["Received · resolved (30 d)", `${stats.received} · ${stats.resolved}`, false], ["Satisfied (4–5★, 30 d)", stats.csat === null ? "—" : `${stats.csat}% · ${stats.avgRating}★ (${stats.rated})`, stats.csat !== null && stats.csat < 70]].map(([l, v, bad]) => (
          <Card key={String(l)}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className={cn("mt-1 text-[22px] font-semibold tabular-nums", bad && "text-danger")}>{v}</p></div></Card>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {VIEWS.map(([v, l]) => <Link key={v} href={`/admin/care?view=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cn("rounded-full border px-3 py-1 text-[13px]", v === view ? "border-ink bg-ink text-white" : "border-line bg-white")}>{l}</Link>)}
        <form action="/admin/care" className="ml-auto flex gap-1"><input type="hidden" name="view" value={view} /><input name="q" defaultValue={q} placeholder="Phone, name, C-12, AS000123" aria-label="Search cases" className="h-8 w-56 rounded-md border border-line bg-white px-2 text-[13px]" /><button className="h-8 rounded-md border border-line px-2 text-[13px]">Search</button></form>
      </div>
      <Card>
        {!cases.length ? <p className="p-6 text-[14px] text-muted">{q ? "No cases match." : view === "open" ? "Nobody is waiting for a reply." : "Nothing here."}</p> : (
          <ul className="divide-y divide-line">{cases.map((c) => (
            <li key={c.id}><Link href={`/admin/care/${c.number}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-cloud/40">
              <div className="min-w-0 flex-1">
                <p className="font-medium"><span className="text-muted">{careRef(c.number)}</span> {c.subject}</p>
                <p className="mt-0.5 truncate text-[13px] text-ink-soft">{c.last?.kind === "NOTE" ? "Note: " : c.last?.kind === "REPLY" ? "You: " : ""}{c.last?.body}</p>
                <p className="mt-0.5 text-[12.5px] text-muted">{c.name} · {CHANNEL_LABEL[c.channel]} · {CATEGORY_LABEL[c.category]}{c.order ? ` · ${formatOrderNumber(c.order.number)}` : ""}{c.store ? ` · ${c.store.name}` : ""} · {c.assignee?.name ?? "unassigned"}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-[12.5px]">
                <span className="flex gap-1">{c.priority === "URGENT" && <Pill tone="danger">Urgent</Pill>}<Pill tone={c.status === "RESOLVED" ? "success" : c.status === "WAITING" ? "neutral" : "warn"}>{STATUS_LABEL[c.status]}</Pill></span>
                {c.respondBy ? <span className={c.overdue ? "font-medium text-danger" : "text-muted"}>{c.overdue ? `reply ${ago(c.respondBy, at)} late` : `waiting ${ago(c.lastCustomerAt, at)}`}</span> : <span className="text-muted">{formatDateTime(c.updatedAt)}</span>}
              </div>
            </Link></li>
          ))}</ul>
        )}
      </Card>
      {stats.byAgent.length > 0 && <p className="mt-3 text-[13px] text-muted">Satisfaction by person (30 d): {stats.byAgent.map((a) => `${a.name} ${a.csat}% (${a.rated})`).join(" · ")}</p>}
      {stats.byCategory.length > 0 && <p className="mt-3 text-[13px] text-muted">Last 30 days: {stats.byCategory.map(([k, n]) => `${CATEGORY_LABEL[k]} ${n}`).join(" · ")}</p>}
    </>
  );
}
