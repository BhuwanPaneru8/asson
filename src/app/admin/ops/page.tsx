import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ktmDate } from "@/lib/pos";
import { compliance, readStats } from "@/lib/ops";
import { scopeFor, storeFilter } from "@/lib/scope";
import { cn, formatDateTime } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { AnnouncementForm, ChecklistEditor } from "@/components/admin/ops-forms";

export const metadata = { title: "Shop operations" };
const th = "px-3 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";

export default async function OpsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const me = await requirePermission("ops.manage");
  const scope = await scopeFor(me);
  const today = ktmDate();
  const sp = (await searchParams).date;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp ?? "") && sp! <= today ? sp! : today;
  const prev = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const [grid, locations, recent, templates] = await Promise.all([
    compliance(date, scope),
    db.store.findMany({ where: { active: true, ...storeFilter(scope) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.announcement.findMany({ where: scope.all ? {} : { createdById: me.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.checklistTemplate.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const stats = await Promise.all(recent.map((a) => readStats(a.id)));
  const lateCount = grid.rows.reduce((s, r) => s + r.cells.filter((c) => c?.late).length, 0);
  return (
    <>
      <PageHeader title="Shop operations" description="Tell every shop what matters and see that they've read it; set the daily checklists and see, shop by shop, what's been done." />
      <Card title={`Checklists · ${date}${lateCount ? ` · ${lateCount} late` : ""}`} className="mb-4" action={<span className="flex gap-3 text-[13px]"><Link href={`/admin/ops?date=${prev}`} className="underline">← {prev}</Link>{date < today && <Link href="/admin/ops" className="underline">today →</Link>}</span>}>
        {!grid.templates.length ? <p className="p-6 text-[14px] text-muted">No checklists yet: add one below.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Location</th>{grid.templates.map((t) => <th key={t.id} className={th}>{t.name}{t.dueBy ? <span className="block normal-case tracking-normal">by {t.dueBy}</span> : null}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">{grid.rows.map((r) => (
                <tr key={r.storeId}><td className="px-3 py-2 font-medium">{r.name}</td>{r.cells.map((c, i) => (
                  <td key={i} className={cn("px-3 py-2 tabular-nums", !c ? "text-muted" : c.completedAt ? (c.late ? "text-warn" : "text-success") : c.late ? "font-medium text-danger" : "")}>{!c ? "—" : c.completedAt ? `✓ ${new Date(c.completedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" })}${c.late ? " late" : ""}` : `${c.done}/${c.total}${c.late ? " · late" : ""}`}</td>
                ))}</tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <AnnouncementForm locations={locations} everyone={scope.all} />
          <Card title="Recent announcements">
            {!recent.length ? <p className="p-5 text-[13.5px] text-muted">None yet.</p> : (
              <ul className="divide-y divide-line text-[13.5px]">{recent.map((a, i) => (
                <li key={a.id} className="px-5 py-2.5"><p className="flex justify-between gap-3"><span className="font-medium">{a.title}</span><span className="shrink-0 text-muted">{formatDateTime(a.createdAt)}</span></p>
                  {a.requiresAck && <p className={cn("text-[12.5px]", stats[i].notRead.length ? "text-warn" : "text-success")}>{stats[i].read} of {stats[i].total} read{stats[i].notRead.length ? ` · waiting for ${stats[i].notRead.slice(0, 6).join(", ")}${stats[i].notRead.length > 6 ? ` +${stats[i].notRead.length - 6}` : ""}` : ""}</p>}</li>
              ))}</ul>
            )}
          </Card>
        </div>
        {scope.all && (
          <Card title="Checklists">
            <ul className="divide-y divide-line">{templates.map((t) => (
              <li key={t.id} className="px-5 py-3 text-[13.5px]"><p className="flex justify-between gap-3"><span><span className="font-medium">{t.name}</span> <span className="text-muted">· {t.kind === "SHOP" ? "shops" : t.kind === "WAREHOUSE" ? "warehouses" : "every location"}{t.dueBy ? ` · by ${t.dueBy}` : ""} · {(t.items as unknown[]).length} items{t.active ? "" : " · off"}</span></span></p>
                <ChecklistEditor initial={{ id: t.id, name: t.name, items: (t.items as { text: string }[]).map((x) => x.text), kind: t.kind, dueBy: t.dueBy, active: t.active }} /></li>
            ))}</ul>
            <div className="border-t border-line"><p className="px-5 pt-3 text-[13px] font-medium">New checklist</p><ChecklistEditor /></div>
          </Card>
        )}
      </div>
    </>
  );
}
