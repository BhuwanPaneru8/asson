import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { AuditRow } from "./audit-entry";
import { Card } from "./ui";

/** "Who changed this" panel for a record page (owner only). */
export async function EntityHistory({ type, id }: { type: string; id: string }) {
  const me = await getCurrentUser();
  if (!can(me, "audit")) return null;
  const rows = await db.auditLog.findMany({ where: { entityType: type, entityId: id }, orderBy: [{ at: "desc" }, { id: "desc" }], take: 15 });
  return (
    <Card title="History" action={rows.length === 15 ? <Link href={`/admin/activity?entityType=${type}&entityId=${id}`} className="text-[13px] underline">See all</Link> : undefined}>
      {rows.length ? (
        <ul className="divide-y divide-line">{rows.map((e) => <AuditRow key={e.id} e={e} canSeeCost={can(me, "finance")} showEntity={false} />)}</ul>
      ) : (
        <p className="px-5 py-4 text-[13.5px] text-muted">No changes recorded yet.</p>
      )}
    </Card>
  );
}
