import Link from "next/link";
import { Download, ShieldAlert } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, isStaffRole } from "@/lib/permissions";
import { AUDIT_GROUPS, SECURITY_ACTIONS, getActivity, type ActivityFilter } from "@/lib/audit-query";
import { AuditRow } from "@/components/admin/audit-entry";
import { Card, PageHeader } from "@/components/admin/ui";
import { now } from "@/lib/utils";

export const metadata = { title: "Activity log" };

type SP = ActivityFilter & { before?: string };
const field = "h-10 rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requirePermission("audit");
  const sp = await searchParams;
  const filter: ActivityFilter = { group: sp.group, actor: sp.actor, q: sp.q, from: sp.from, to: sp.to, entityType: sp.entityType, entityId: sp.entityId };
  const weekAgo = new Date(now() - 7 * 86_400_000);
  const [{ rows, more }, staff, alerts] = await Promise.all([
    getActivity(filter, { before: sp.before, take: 50 }),
    db.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER", "CASHIER", "STAFF"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    db.auditLog.count({ where: { action: { in: SECURITY_ACTIONS }, at: { gte: weekAgo } } }),
  ]);
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filter, ...extra })) if (v) p.set(k, v);
    return p.toString();
  };
  const canSeeCost = can(me.role, "finance");

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Every change your team makes, and every sign-in to a staff account. Entries can't be edited or deleted."
        actions={<a href={`/admin/activity/export.csv?${qs({})}`} className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-4 text-[14px] hover:border-ink"><Download className="h-4 w-4" /> Export CSV</a>}
      />

      {alerts > 0 && sp.group !== "security" && (
        <Link href={`/admin/activity?group=security&from=${weekAgo.toISOString().slice(0, 10)}`} className="mb-4 flex items-center gap-2 rounded-md border border-danger/30 bg-[#fbe9e7] px-4 py-3 text-[14px] text-danger">
          <ShieldAlert className="h-4 w-4 shrink-0" /> {alerts} failed sign-in or PIN attempt{alerts > 1 ? "s" : ""} in the last 7 days — review
        </Link>
      )}

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" aria-label="Search the activity log" defaultValue={sp.q} placeholder="Search: product, order, name, IP…" className={`${field} w-full max-w-xs`} />
        <select name="group" defaultValue={sp.group ?? ""} className={field} aria-label="Area">
          <option value="">Everything</option>
          {Object.entries(AUDIT_GROUPS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}
        </select>
        <select name="actor" defaultValue={sp.actor ?? ""} className={field} aria-label="Person">
          <option value="">Anyone</option>
          {staff.filter((u) => isStaffRole(u.role)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-muted">From <input type="date" name="from" defaultValue={sp.from} className={field} /></label>
        <label className="flex items-center gap-1.5 text-[13px] text-muted">To <input type="date" name="to" defaultValue={sp.to} className={field} /></label>
        {sp.entityType && <><input type="hidden" name="entityType" value={sp.entityType} /><input type="hidden" name="entityId" value={sp.entityId ?? ""} /></>}
        <button className="h-10 rounded-md bg-ink px-4 text-[14px] text-white">Filter</button>
        {Object.values(filter).some(Boolean) && <Link href="/admin/activity" className="inline-flex h-10 items-center px-2 text-[13.5px] underline">Clear</Link>}
      </form>

      <Card>
        {rows.length ? (
          <ul className="divide-y divide-line">{rows.map((e) => <AuditRow key={e.id} e={e} canSeeCost={canSeeCost} />)}</ul>
        ) : (
          <p className="px-5 py-10 text-center text-[14px] text-muted">No activity matches these filters.</p>
        )}
        {(more || sp.before) && (
          <div className="flex justify-between border-t border-line px-5 py-3 text-[13.5px]">
            {sp.before ? <Link href={`/admin/activity?${qs({})}`} className="underline">Newest</Link> : <span />}
            {more && <Link href={`/admin/activity?${qs({ before: rows[rows.length - 1].id })}`} className="underline">Older →</Link>}
          </div>
        )}
      </Card>
    </>
  );
}
