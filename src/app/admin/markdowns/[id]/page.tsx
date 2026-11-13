import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { store as storeCfg } from "@/lib/config";
import { eventRef, eventResults, preview } from "@/lib/markdowns";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { AddProducts, EventActions, ItemPrice } from "@/components/admin/markdown-forms";

export const metadata = { title: "Sale" };

export default async function MarkdownPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("catalog.edit");
  const id = (await params).id;
  const [p, results, categories] = await Promise.all([preview(id), eventResults(id), db.category.findMany({ select: { id: true, name: true, parent: { select: { name: true } } } }).then((cs) => cs.map((c) => ({ id: c.id, name: c.parent ? `${c.parent.name} › ${c.name}` : c.name })).sort((a, b) => a.name.localeCompare(b.name)))]);
  if (!p) notFound();
  const e = p.event;
  const editable = e.status === "DRAFT" || e.status === "SCHEDULED";
  const t = p.totals;
  return (
    <>
      <Link href="/admin/markdowns" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Markdowns</Link>
      <PageHeader title={`${eventRef(e.number)} · ${e.name}`} description={`${formatDateTime(e.startsAt)} → ${e.endsAt ? formatDateTime(e.endsAt) : "no end (clearance)"}${e.startedAt ? ` · started ${formatDateTime(e.startedAt)}` : ""}${e.endedAt ? ` · ended ${formatDateTime(e.endedAt)}` : ""}`}
        actions={<span className="flex flex-wrap items-center gap-3"><Pill tone={e.status === "LIVE" ? "success" : e.status === "SCHEDULED" ? "warn" : "neutral"}>{e.status.toLowerCase()}</Pill>{p.rows.length > 0 && <Link href={`/admin/labels?event=${e.id}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-[13px] hover:border-ink"><Printer className="h-4 w-4" /> Price tags</Link>}<EventActions eventId={e.id} status={e.status} belowMin={t.belowMin} owner={can(me, "finance")} /></span>} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Products", String(t.products)], ["Units in stock", String(t.units)], ["Stock at shelf price", formatPrice(t.retailBefore)], ["At sale price", formatPrice(t.retailAfter)]] as const).map(([l, v]) => <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className="mt-1 text-[20px] font-semibold tabular-nums">{v}</p></div></Card>)}
      </div>
      {results && (
        <Card title={`Results · ${results.days} day${results.days === 1 ? "" : "s"} vs the ${results.days} before`} className="mb-4">
          <div className="grid grid-cols-2 gap-3 p-4 text-[14px] sm:grid-cols-4">
            <p><span className="block text-[12px] text-muted">Units sold</span><b className="text-[18px] tabular-nums">{results.during.units}</b> <span className="text-muted">(was {results.before.units})</span></p>
            <p><span className="block text-[12px] text-muted">Sales</span><b className="text-[18px] tabular-nums">{formatPrice(results.during.sales)}</b> <span className="text-muted">(was {formatPrice(results.before.sales)})</span></p>
            <p><span className="block text-[12px] text-muted">Margin</span><b className="text-[18px] tabular-nums">{results.margin ?? "—"}%</b></p>
            <p><span className="block text-[12px] text-muted">Change in units</span><b className="text-[18px] tabular-nums">{results.before.units ? `${Math.round((results.during.units / results.before.units - 1) * 100)}%` : "—"}</b></p>
          </div>
        </Card>
      )}
      {(t.belowMin > 0 || p.rows.some((r) => r.clash || r.notLower || r.noCost)) && editable && (
        <div className="mb-4 rounded-lg border border-warn/40 bg-[#fbeee0] px-4 py-3 text-[13.5px] text-[#7a4a10]">
          {t.belowMin > 0 && <p>{t.belowMin} product(s) under cost + {storeCfg.markdown.minMarginPct}%{t.belowCost ? ` (${t.belowCost} under cost)` : ""}: only the owner can schedule that, with &ldquo;below margin is OK&rdquo; ticked.</p>}
          {p.rows.some((r) => r.clash) && <p>Some products are in another sale at the same time: remove them or change the dates.</p>}
          {p.rows.some((r) => r.notLower) && <p>Some sale prices aren&apos;t lower than the shelf price.</p>}
          {p.rows.some((r) => r.noCost) && <p>Some products have no cost recorded, so their margin can&apos;t be checked.</p>}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card title="Products">
          {!p.rows.length ? <p className="p-5 text-[14px] text-muted">No products yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40 text-left text-[11.5px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-2">Product</th><th className="px-3 text-right">Shelf</th><th className="px-3 text-right">Sale</th><th className="px-3 text-right">Off</th><th className="px-3 text-right">Margin</th><th className="px-3 text-right">Stock</th><th className="px-3 text-right">Sold 30d</th><th className="px-3 text-right" title="Waiting for a price drop">Watching</th>{editable && <th className="px-4" />}</tr></thead>
              <tbody className="divide-y divide-line">{p.rows.map((r) => (
                <tr key={r.productId} className={cn(r.belowCost ? "bg-danger/5" : r.belowMin || r.clash || r.notLower ? "bg-warn/5" : "")}>
                  <td className="min-w-[180px] px-4 py-2"><Link href={`/p/${r.slug}`} target="_blank" className="hover:underline">{r.name}</Link>{r.clash && <span className="block text-[11.5px] text-warn">also in {r.clash}</span>}{r.restoreSkipped && <span className="block text-[11.5px] text-warn">price changed during the sale: left as it was</span>}</td>
                  <td className="whitespace-nowrap px-3 text-right tabular-nums">{formatPrice(r.shelf)}</td>
                  <td className="whitespace-nowrap px-3 text-right font-semibold tabular-nums">{formatPrice(r.newPrice)}</td>
                  <td className="px-3 text-right tabular-nums">{r.off}%</td>
                  <td className={cn("px-3 text-right tabular-nums", r.belowCost ? "font-semibold text-danger" : r.belowMin && "text-warn")}>{r.margin != null ? `${r.margin}%` : "—"}</td>
                  <td className="px-3 text-right tabular-nums">{r.stock}</td>
                  <td className="px-3 text-right tabular-nums">{r.sold30}</td><td className="px-3 text-right tabular-nums">{r.watching || "—"}</td>
                  {editable && <td className="px-4 py-1.5"><ItemPrice eventId={e.id} productId={r.productId} price={r.newPrice} editable /></td>}
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
        {editable && <Card title="Add products"><AddProducts eventId={e.id} categories={categories} /></Card>}
      </div>
    </>
  );
}
