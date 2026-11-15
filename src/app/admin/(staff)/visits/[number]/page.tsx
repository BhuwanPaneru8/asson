import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { cn, formatDate, formatDateTime, now } from "@/lib/utils";
import { STATUS_LABEL, visitDetail, visitRef } from "@/lib/visits";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { AcknowledgeVisit, CheckAction, FixAction, VisitWalk } from "@/components/admin/visit-forms";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  return { title: `SV-${(await params).number}` };
}

const Thumbs = ({ urls }: { urls: string[] }) => urls.length ? <div className="mt-1.5 flex flex-wrap gap-1.5">{urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="relative block h-16 w-16 overflow-hidden rounded bg-cloud"><Image src={u} alt="Visit photo" fill sizes="64px" className="object-cover" /></a>)}</div> : null;

export default async function VisitPage({ params }: { params: Promise<{ number: string }> }) {
  const me = await requirePermission("self.time");
  const n = Number((await params).number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const d = await visitDetail(me, n);
  if (!d) notFound();
  const { visit: v, isAuditor, manages, atShop } = d;
  const at = now();
  const title = `${visitRef(v.number)} · ${v.store.name}`;
  if (v.status === "DRAFT") {
    return (
      <>
        <PageHeader title={title} description={`${v.auditorName} · started ${formatDateTime(v.startedAt)}`} actions={<Link href="/admin/visits" className="text-[13.5px] underline underline-offset-4">All visits</Link>} />
        {isAuditor ? <Card><VisitWalk id={v.id} items={v.items} /></Card> : <Card><p className="p-6 text-[14px] text-muted">{v.auditorName} is doing this visit now. You&apos;ll see it when it&apos;s submitted.</p></Card>}
      </>
    );
  }
  return (
    <>
      <PageHeader title={title} description={`${v.auditorName} · ${formatDate(v.submittedAt!)}`} actions={<Link href="/admin/visits" className="text-[13.5px] underline underline-offset-4">All visits</Link>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-3 p-5">
              <span className={cn("text-[34px] font-semibold tabular-nums", (v.score ?? 0) >= 85 ? "text-success" : (v.score ?? 0) < 60 ? "text-danger" : "")}>{v.score == null ? "—" : `${v.score}%`}</span>
              <span className="flex flex-wrap gap-1.5">{v.criticalFails > 0 && <Pill tone="danger">{v.criticalFails} critical</Pill>}<Pill tone={v.status === "ACKNOWLEDGED" ? "success" : "warn"}>{STATUS_LABEL[v.status]}</Pill></span>
            </div>
            {v.summary && <p className="whitespace-pre-line border-t border-line px-5 py-3 text-[14.5px]">{v.summary}</p>}
            {v.ackAt && <p className="border-t border-line px-5 py-3 text-[13px] text-muted">Acknowledged by {v.ackByName}, {formatDateTime(v.ackAt)}{v.ackNote ? `: “${v.ackNote}”` : ""}</p>}
          </Card>
          <Card title="Checklist">
            <ul>{v.items.map((it, i, items) => {
              const head = i === 0 || items[i - 1].section !== it.section ? it.section : null;
              return (
                <li key={i} className="border-b border-line last:border-0">
                  {head && <p className="bg-cloud/50 px-5 py-2 text-[12px] font-semibold uppercase tracking-wider text-muted">{head}</p>}
                  <div className="flex items-start justify-between gap-3 px-5 py-2.5 text-[14px]">
                    <div className="min-w-0">{it.critical && <span className="mr-1.5 rounded bg-danger/10 px-1.5 py-0.5 text-[11px] font-semibold text-danger">CRITICAL</span>}{it.text}{it.note && <p className="text-[13px] text-ink-soft">{it.note}</p>}<Thumbs urls={it.photos ?? []} /></div>
                    <span className={cn("shrink-0 text-[13px] font-medium", it.result === "PASS" ? "text-success" : it.result === "FAIL" ? "text-danger" : "text-muted")}>{it.result === "PASS" ? "Pass" : it.result === "FAIL" ? "Fail" : "N/A"}</span>
                  </div>
                </li>
              );
            })}</ul>
          </Card>
        </div>
        <div className="space-y-4">
          {v.status === "SUBMITTED" && atShop && !isAuditor && <Card title="Acknowledge"><AcknowledgeVisit id={v.id} /></Card>}
          <Card title={v.actions.length ? `To fix · ${v.actions.filter((a) => a.status !== "VERIFIED").length} open` : "Nothing to fix"}>
            {!v.actions.length ? <p className="p-4 text-[14px] text-muted">Every item passed.</p> : (
              <ul className="divide-y divide-line">{v.actions.map((a) => {
                const late = a.status === "OPEN" && a.dueAt.getTime() < at;
                return (
                  <li key={a.id} className="px-4 py-3 text-[14px]">
                    <p>{a.critical && <span className="mr-1.5 rounded bg-danger/10 px-1.5 py-0.5 text-[11px] font-semibold text-danger">CRITICAL</span>}{a.text}</p>
                    {a.note && <p className="text-[13px] text-ink-soft">{a.note}</p>}
                    <p className={cn("mt-0.5 text-[12.5px]", late ? "font-medium text-danger" : "text-muted")}>{a.status === "VERIFIED" ? `Fixed and verified ${formatDate(a.verifiedAt!)}` : a.status === "DONE" ? `Fixed by ${a.doneByName}, ${formatDateTime(a.doneAt!)}: ${a.doneNote}` : `${late ? "Overdue since" : "Fix by"} ${formatDateTime(a.dueAt)}`}</p>
                    <Thumbs urls={a.donePhotos} />
                    <div className="mt-2 flex flex-wrap">{a.status === "OPEN" && atShop && <FixAction id={a.id} />}{a.status === "DONE" && manages && a.doneById !== me.id && <CheckAction id={a.id} />}</div>
                  </li>
                );
              })}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
