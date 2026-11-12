import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { scopeFor } from "@/lib/scope";
import { AREA_LABEL, mySops, ROLE_NAME, trainingMatrix } from "@/lib/training";
import { cn, formatDate } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { LoadStarters } from "@/components/admin/training-forms";

export const metadata = { title: "Training" };
const MARK: Record<string, string> = { signed: "✓", changed: "!", todo: "·", "n/a": "" };

export default async function TrainingPage() {
  const me = await requirePermission("self.time");
  const editor = can(me.role, "ops.manage"), manager = can(me.role, "people");
  const [mine, matrix] = await Promise.all([mySops(me), manager ? trainingMatrix(await scopeFor(me)) : Promise.resolve(null)]);
  const todo = mine.filter((s) => s.required && s.state !== "signed");
  return (
    <>
      <PageHeader title="Training" description="How we do things here, step by step. Read each one that's for your role and sign it; when one changes, you'll be asked to read it again." actions={editor ? <Link href="/admin/training/new" className="rounded-md border border-line bg-white px-3 py-2 text-[13.5px] hover:border-ink">New procedure</Link> : undefined} />
      {!mine.length && <Card className="mb-4"><div className="space-y-3 p-5 text-[14px]"><p className="text-muted">No procedures yet.</p>{editor && <LoadStarters />}</div></Card>}
      {mine.length > 0 && (
        <Card title={todo.length ? `For you to read and sign · ${todo.length}` : "You're up to date"} className="mb-4">
          <ul className="divide-y divide-line">{mine.filter((s) => s.required || editor).map((s) => (
            <li key={s.id}><Link href={`/admin/training/${s.slug}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40">
              <span><b>{s.title}</b><span className="ml-2 text-[12px] text-muted">{AREA_LABEL[s.area]} · version {s.version}</span></span>
              {!s.required ? <span className="text-[12px] text-muted">not for your role</span> : <Pill tone={s.state === "signed" ? "success" : "warn"}>{s.state === "signed" ? `signed ${formatDate(s.signedAt!)}` : s.state === "changed" ? "changed: read again" : "to read"}</Pill>}
            </Link></li>
          ))}</ul>
        </Card>
      )}
      {matrix && matrix.sops.length > 0 && (
        <Card title={`Who has signed what${matrix.pct != null ? ` · ${matrix.pct}% done` : ""}`}>
          <div className="overflow-x-auto"><table className="w-full text-[13px]">
            <thead className="border-b border-line bg-cloud/40 text-left text-[11.5px] uppercase tracking-wider text-muted"><tr><th className="sticky left-0 bg-cloud px-4 py-2">Person</th>{matrix.sops.map((s) => <th key={s.id} className="px-2 py-2 text-center font-medium normal-case tracking-normal"><Link href={`/admin/training/${s.slug}`} className="hover:underline" title={s.title}>{s.title.length > 18 ? `${s.title.slice(0, 16)}…` : s.title}</Link></th>)}<th className="px-4 text-right">Done</th></tr></thead>
            <tbody className="divide-y divide-line">{matrix.rows.map((r) => (
              <tr key={r.id}>
                <td className="sticky left-0 bg-white px-4 py-2"><span className="font-medium">{r.name}</span><span className="block text-[11.5px] text-muted">{ROLE_NAME[r.role as keyof typeof ROLE_NAME] ?? r.role}{r.where ? ` · ${r.where}` : ""}</span></td>
                {r.cells.map((c) => <td key={c.sopId} className={cn("px-2 text-center font-semibold", c.state === "signed" ? "text-success" : c.state === "changed" ? "text-warn" : "text-muted")} title={c.state}>{MARK[c.state]}<span className="sr-only">{c.state}</span></td>)}
                <td className={cn("px-4 text-right tabular-nums", r.of && r.done < r.of && "font-semibold text-warn")}>{r.of ? `${r.done}/${r.of}` : "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <p className="border-t border-line px-4 py-2.5 text-[12px] text-muted">✓ signed · ! changed since they signed · · not yet signed</p>
        </Card>
      )}
    </>
  );
}
