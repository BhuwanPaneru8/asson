import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { eventRef, eventsList, suggestions } from "@/lib/markdowns";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { AddSuggested, CreateEvent } from "@/components/admin/markdown-forms";

export const metadata = { title: "Markdowns" };
const TONE: Record<string, "success" | "warn" | "neutral" | "danger"> = { LIVE: "success", SCHEDULED: "warn", DRAFT: "neutral", ENDED: "neutral", CANCELLED: "neutral" };

export default async function MarkdownsPage() {
  await requirePermission("catalog.edit");
  const [events, slow] = await Promise.all([eventsList(), suggestions()]);
  const draft = events.find((e) => e.status === "DRAFT");
  return (
    <>
      <PageHeader title="Markdowns" description="Plan sales (Dashain, end of season, clearance): products, sale prices, dates. Prices change everywhere at the start (website and tills) and go back at the end, by themselves." />
      <Card title="New sale" className="mb-4"><CreateEvent /></Card>
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card title="Sales">
          {!events.length ? <p className="p-5 text-[14px] text-muted">No sales yet.</p> : (
            <ul className="divide-y divide-line">{events.map((e) => (
              <li key={e.id}><Link href={`/admin/markdowns/${e.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[14px] hover:bg-cloud/40">
                <span><b>{eventRef(e.number)}</b> {e.name}<span className="block text-[12.5px] text-muted">{formatDateTime(e.startsAt)} → {e.endsAt ? formatDateTime(e.endsAt) : "no end (clearance)"} · {e._count.items} product{e._count.items === 1 ? "" : "s"}</span></span>
                <Pill tone={TONE[e.status]}>{e.status.toLowerCase()}</Pill>
              </Link></li>
            ))}</ul>
          )}
        </Card>
        <Card title={`Slow stock to mark down · ${slow.length}`}>
          {!slow.length ? <p className="p-5 text-[14px] text-muted">Nothing is sitting unsold.</p> : (
            <ul className="divide-y divide-line text-[13.5px]">{slow.slice(0, 20).map((s) => (
              <li key={s.productId} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0"><span className="block truncate">{s.name}</span><span className="text-[12px] text-muted">{s.units} units · {formatPrice(s.atCost)} at cost · {s.days} days unsold</span></span>
                {draft ? <AddSuggested eventId={draft.id} productIds={[s.productId]} off={s.suggestOff} /> : <span className="shrink-0 text-[12px] text-muted">{s.suggestOff}% off</span>}
              </li>
            ))}</ul>
          )}
          <p className="border-t border-line px-4 py-2.5 text-[12px] text-muted">{draft ? `Adds to ${eventRef(draft.number)} ${draft.name}.` : "Draft a sale to add these to it."} Suggested: 20% after the slow-stock period, 30% at 120 days, 40% at 180.</p>
        </Card>
      </div>
    </>
  );
}
