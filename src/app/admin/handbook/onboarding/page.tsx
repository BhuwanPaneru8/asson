import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { teamProgress } from "@/lib/handbook";
import { scopeFor } from "@/lib/scope";
import { cn, formatDate } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";

export const metadata = { title: "Team onboarding · Handbook" };

export default async function TeamOnboarding() {
  const me = await requirePermission("people");
  const rows = await teamProgress(await scopeFor(me));
  const complete = rows.filter((r) => r.complete).length;

  return (
    <>
      <PageHeader title="Team onboarding" description="Each person's reading path for their job and the procedures they must sign. New joiners should finish both in their first 30 days; nobody works a till or ships orders alone before the procedures for it are signed." />
      <Card title={`${complete} of ${rows.length} people fully onboarded`}>
        <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
          <thead className="border-b border-line bg-cloud/40 text-left text-[11.5px] uppercase tracking-wider text-muted">
            <tr><th className="px-4 py-2">Person</th><th className="px-3 py-2">Job</th><th className="px-3 py-2 text-right">Handbook path</th><th className="px-3 py-2 text-right">Procedures signed</th><th className="px-3 py-2 text-right">Avg. score</th><th className="px-3 py-2">Last reading</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-line">{rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-2.5"><span className="font-medium">{r.name}</span>{r.where && <span className="block text-[11.5px] text-muted">{r.where}</span>}</td>
              <td className="px-3 py-2.5">{r.jobLabel}<span className="block text-[11.5px] text-muted">joined {formatDate(r.joined)}</span></td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", r.read < r.of && "font-semibold text-warn")}>{r.read}/{r.of}</td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", r.signed < r.sopsDue && "font-semibold text-warn")}>{r.sopsDue ? `${r.signed}/${r.sopsDue}` : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{r.avgScore != null ? `${r.avgScore}%` : "—"}</td>
              <td className="px-3 py-2.5 text-muted">{r.lastActive ? formatDate(r.lastActive) : "never"}</td>
              <td className="px-4 py-2.5">{r.complete ? <Pill tone="success">onboarded</Pill> : <Pill tone={r.stuck ? "danger" : "warn"}>{r.stuck ? "stuck: follow up" : "in progress"}</Pill>}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-muted">“Stuck” means no reading in 14 days. Procedures are signed in <Link href="/admin/training" className="underline">Training</Link>; see who has signed which one there.</p>
      </Card>
    </>
  );
}
