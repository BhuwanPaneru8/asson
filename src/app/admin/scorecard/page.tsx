import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { PROVINCES } from "@/lib/config";
import { scopeFor } from "@/lib/scope";
import { scorecard, SORTS, sortRows, type Sort } from "@/lib/scorecard";
import { cn, formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Shop scorecard" };
const th = "px-3 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted whitespace-nowrap";
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const tone = (v: number | null, good = 85, bad = 60) => (v === null ? "text-muted" : v >= good ? "text-success" : v < bad ? "text-danger" : "");

export default async function ScorecardPage({ searchParams }: { searchParams: Promise<{ sort?: string; days?: string; province?: string }> }) {
  const me = await requirePermission("ops.manage");
  const sp = await searchParams;
  const sort = (sp.sort && sp.sort in SORTS ? sp.sort : "ops") as Sort;
  const days = sp.days === "90" ? 90 : sp.days === "7" ? 7 : 30;
  const all = await scorecard({ scope: await scopeFor(me), days });
  const rows = sortRows(sp.province ? all.filter((r) => r.province === sp.province) : all, sort);
  const q = (p: Record<string, string | undefined>) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries({ sort: sp.sort, days: sp.days, province: sp.province, ...p })) if (v) u.set(k, v); const s = u.toString(); return `/admin/scorecard${s ? `?${s}` : ""}`; };
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-[13px]", on ? "border-ink bg-ink text-white" : "border-line bg-white");
  const scored = rows.filter((r) => r.opsScore !== null);
  const flagged = rows.filter((r) => r.flags.length).length;
  return (
    <>
      <PageHeader title="Shop scorecard" description={`Every shop on one page: sales, daily checklists, display audits, store visits, issues and customer care over the last ${days} days. Operations score = average of checklists done, display score and last visit score.`} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Shops", rows.length], ["Average operations score", scored.length ? `${Math.round(scored.reduce((a, r) => a + r.opsScore!, 0) / scored.length)}%` : "—"], ["Need attention", flagged], [`Sales (${days} d)`, formatPrice(rows.reduce((a, r) => a + r.revenue, 0))]].map(([l, v]) => (
          <Card key={String(l)}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className="mt-1 text-[22px] font-semibold tabular-nums">{v}</p></div></Card>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(Object.keys(SORTS) as Sort[]).map((s) => <Link key={s} href={q({ sort: s })} className={chip(s === sort)}>{SORTS[s]}</Link>)}
        <span className="mx-1 text-line">|</span>
        {["7", "30", "90"].map((d) => <Link key={d} href={q({ days: d === "30" ? undefined : d })} className={chip(String(days) === d)}>{d} days</Link>)}
        <form action="/admin/scorecard" className="ml-auto">{sp.sort && <input type="hidden" name="sort" value={sp.sort} />}{sp.days && <input type="hidden" name="days" value={sp.days} />}<select name="province" defaultValue={sp.province ?? ""} className="h-8 rounded-md border border-line bg-white px-2 text-[13px]" aria-label="Province"><option value="">All provinces</option>{PROVINCES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select> <button className="h-8 rounded-md border border-line px-2 text-[13px]">Show</button></form>
      </div>
      <Card>
        {!rows.length ? <p className="p-6 text-[14px] text-muted">No shops here.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Shop</th><th className={th}>Ops score</th><th className={th}>Sales</th><th className={th}>Checklists</th><th className={th}>Displays</th><th className={th}>Last visit</th><th className={th}>Issues</th><th className={th}>Care</th><th className={th}>Needs attention</th></tr></thead>
            <tbody className="divide-y divide-line">{rows.map((r) => (
              <tr key={r.storeId} className="align-top">
                <td className="px-3 py-2.5"><Link href={`/admin/scorecard/${r.storeId}`} className="font-medium hover:underline">{r.name}</Link>{r.district && <span className="block text-[12px] text-muted">{r.district}</span>}</td>
                <td className={cn("px-3 py-2.5 text-[16px] font-semibold tabular-nums", tone(r.opsScore))}>{pct(r.opsScore)}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatPrice(r.revenue)}{r.growth !== null && <span className={cn("block text-[12px]", r.growth >= 0 ? "text-success" : "text-danger")}>{r.growth >= 0 ? "+" : ""}{r.growth}%</span>}</td>
                <td className={cn("px-3 py-2.5 tabular-nums", tone(r.checklistPct, 95, 80))}>{pct(r.checklistPct)}</td>
                <td className="px-3 py-2.5 tabular-nums"><span className={tone(r.displayAvg)}>{pct(r.displayAvg)}</span>{r.displaysLate > 0 && <span className="block text-[12px] text-danger">{r.displaysLate} late</span>}</td>
                <td className="px-3 py-2.5 tabular-nums">{r.visitNumber ? <Link href={`/admin/visits/${r.visitNumber}`} className={cn("hover:underline", tone(r.visitScore))}>{pct(r.visitScore)}</Link> : <span className="text-muted">never</span>}{r.daysSinceVisit !== null && <span className="block text-[12px] text-muted">{r.daysSinceVisit} d ago</span>}{r.fixesOpen > 0 && <span className={cn("block text-[12px]", r.fixesLate ? "text-danger" : "text-muted")}>{r.fixesOpen} to fix</span>}</td>
                <td className={cn("px-3 py-2.5 tabular-nums", r.issuesLate && "text-danger")}>{r.issuesOpen || "—"}{r.issuesLate > 0 && <span className="block text-[12px]">{r.issuesLate} overdue</span>}</td>
                <td className={cn("px-3 py-2.5 tabular-nums", r.careLate && "text-danger")}>{r.careCases || "—"}{r.careLate > 0 && <span className="block text-[12px]">{r.careLate} waiting</span>}{r.careCsat !== null && <span className={cn("block text-[12px]", r.careCsat < 70 ? "text-danger" : "text-muted")}>{r.careCsat}% satisfied</span>}</td>
                <td className="px-3 py-2.5 text-[12.5px]">{r.flags.length ? <ul className="space-y-0.5">{r.flags.map((f) => <li key={f} className="text-danger">• {f}</li>)}</ul> : <span className="text-success">All good</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
