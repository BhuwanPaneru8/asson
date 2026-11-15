import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ktmDate } from "@/lib/pos";
import { scopeFor } from "@/lib/scope";
import { cn, formatDate } from "@/lib/utils";
import { briefsFor, leaderboard, vmRef } from "@/lib/vm";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { NewBriefForm } from "@/components/admin/vm-forms";

export const metadata = { title: "Visual merchandising" };
const th = "px-3 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";

export default async function VmPage() {
  const me = await requirePermission("self.time");
  const scope = await scopeFor(me);
  const [briefs, board, shops] = await Promise.all([
    briefsFor(me),
    leaderboard(scope),
    scope.all ? db.store.findMany({ where: { active: true, kind: "SHOP" }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader title="Visual merchandising" description="Display briefs from HQ: each shop sends photos, HQ or the shop's manager approves with a score or asks for a redo." />
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-4">
          <Card title="Briefs">
            {!briefs.length ? <p className="p-6 text-[14px] text-muted">No display briefs yet.</p> : (
              <ul className="divide-y divide-line">{briefs.map((b) => (
                <li key={b.id}><Link href={`/admin/vm/${b.number}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-cloud/40">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium"><span className="text-muted">{vmRef(b.number)}</span> {b.title}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">due {formatDate(b.dueAt)} · {b.shops} shop{b.shops === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1 text-[12.5px]">
                    {b.closedAt ? <Pill>Closed</Pill> : <>
                      {b.approved > 0 && <Pill tone="success">{b.approved} approved</Pill>}
                      {b.waiting > 0 && <Pill tone="warn">{b.waiting} to review</Pill>}
                      {b.redo > 0 && <Pill>{b.redo} redo</Pill>}
                      {b.notSent > 0 && <Pill tone={b.overdue ? "danger" : "neutral"}>{b.notSent} not sent{b.overdue ? " · late" : ""}</Pill>}
                    </>}
                  </div>
                </Link></li>
              ))}</ul>
            )}
          </Card>
          {board.length > 0 && (
            <Card title="Display scores · last 90 days">
              <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
                <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Shop</th><th className={th}>Average</th><th className={th}>Approved</th><th className={th}>First time right</th><th className={th}>Sent late</th></tr></thead>
                <tbody className="divide-y divide-line">{board.map((r) => (
                  <tr key={r.storeId}><td className="px-3 py-2 font-medium">{r.name}</td><td className={cn("px-3 py-2 tabular-nums font-semibold", r.avg >= 80 ? "text-success" : r.avg < 50 ? "text-danger" : "")}>{r.avg}%</td><td className="px-3 py-2 tabular-nums">{r.reviewed}</td><td className="px-3 py-2 tabular-nums">{r.firstTime}/{r.reviewed}</td><td className={cn("px-3 py-2 tabular-nums", r.late > 0 && "text-danger")}>{r.late}</td></tr>
                ))}</tbody>
              </table></div>
            </Card>
          )}
        </div>
        {scope.all && <div><NewBriefForm shops={shops} minDate={ktmDate()} /></div>}
      </div>
    </>
  );
}
