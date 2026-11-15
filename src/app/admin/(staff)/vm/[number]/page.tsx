import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { briefDetail, STATUS_LABEL, vmRef } from "@/lib/vm";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { CloseBrief, ReviewDisplay, SubmitDisplay } from "@/components/admin/vm-forms";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  return { title: `VM-${(await params).number}` };
}

const Photo = ({ src, alt, size = 112 }: { src: string; alt: string; size?: number }) => (
  <a href={src} target="_blank" rel="noreferrer" className="relative block shrink-0 overflow-hidden rounded-md bg-cloud" style={{ width: size, height: Math.round(size * 1.25) }}><Image src={src} alt={alt} fill sizes={`${size}px`} className="object-cover" /></a>
);

export default async function BriefPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ store?: string }> }) {
  const me = await requirePermission("self.time");
  const n = Number((await params).number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const d = await briefDetail(me, n);
  if (!d) notFound();
  const { brief: b, rows, reviewer, hq } = d;
  const want = (await searchParams).store;
  // one shop's view: the person's own shop, or the one HQ picked from the grid
  const focus = rows.find((r) => r.store.id === want) ?? (rows.length === 1 ? rows[0] : null);
  const canSend = !b.closedAt && focus && (!focus.sub || focus.sub.status === "REDO");
  return (
    <>
      <PageHeader title={`${vmRef(b.number)} · ${b.title}`} description={`Send by ${formatDate(b.dueAt)}${b.closedAt ? " · closed" : ""}`} actions={<span className="flex items-center gap-3">{hq && !b.closedAt && <CloseBrief id={b.id} />}<Link href="/admin/vm" className="text-[13.5px] underline underline-offset-4">All briefs</Link></span>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="min-w-0 space-y-4">
          <Card title="How it should look">
            <div className="space-y-3 p-5">
              {b.instructions && <p className="whitespace-pre-line text-[14.5px]">{b.instructions}</p>}
              {b.refPhotos.length > 0 && <div className="flex flex-wrap gap-2">{b.refPhotos.map((p) => <Photo key={p} src={p} alt="Reference photo" />)}</div>}
              <p className="text-[13px] text-muted">Shots: {b.areas.map((a) => a.name).join(", ")} · Scored on: {b.criteria.map((c) => c.text).join("; ")}</p>
            </div>
          </Card>
          {focus?.sub && (
            <Card title={`${focus.store.name} · ${STATUS_LABEL[focus.sub.status]}${focus.sub.score != null ? ` · ${focus.sub.score}%` : ""}`} action={<span className="text-[12.5px] text-muted">round {focus.sub.round}{focus.late ? " · sent late" : ""}</span>}>
              <div className="space-y-4 p-5">
                {b.areas.map((a) => (
                  <div key={a.name}><p className="mb-1.5 text-[13.5px] font-medium">{a.name}</p><div className="flex flex-wrap gap-2">{focus.sub!.photos.filter((p) => p.area === a.name).map((p) => <Photo key={p.url} src={p.url} alt={`${a.name} at ${focus.store.name}`} size={160} />)}</div></div>
                ))}
                <ol className="space-y-1 border-t border-line pt-3 text-[13px]">{focus.sub.events.map((e) => (
                  <li key={e.id}><span className="text-muted">{formatDateTime(e.createdAt)} · {e.byName} · {STATUS_LABEL[e.status]}</span>{e.message && <span className="block whitespace-pre-line">{e.message}</span>}</li>
                ))}</ol>
              </div>
            </Card>
          )}
          {rows.length > 1 && (
            <Card title="Shops">
              <ul className="divide-y divide-line">{rows.map((r) => (
                <li key={r.store.id}><Link href={`/admin/vm/${b.number}?store=${r.store.id}`} className={cn("flex items-center justify-between gap-3 px-5 py-2.5 text-[14px] hover:bg-cloud/40", focus?.store.id === r.store.id && "bg-cloud/60")}>
                  <span className="font-medium">{r.store.name}</span>
                  <span className="flex gap-1 text-[12.5px]">{r.sub?.status === "APPROVED" ? <Pill tone="success">{r.sub.score}%</Pill> : r.sub?.status === "SUBMITTED" ? <Pill tone="warn">To review</Pill> : r.sub?.status === "REDO" ? <Pill>Redo</Pill> : <Pill tone={r.late ? "danger" : "neutral"}>Not sent{r.late ? " · late" : ""}</Pill>}</span>
                </Link></li>
              ))}</ul>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          {focus?.sub?.status === "REDO" && focus.sub.feedback && <Card title="What to change"><p className="whitespace-pre-line p-4 text-[14px]">{focus.sub.feedback}</p></Card>}
          {canSend && <Card title={`Send photos · ${focus!.store.name}`}><SubmitDisplay briefId={b.id} storeId={focus!.store.id} areas={b.areas} redo={focus!.sub?.status === "REDO"} /></Card>}
          {reviewer && focus?.sub?.status === "SUBMITTED" && (focus.sub.submittedById === me.id
            ? <Card><p className="p-4 text-[13.5px] text-muted">You sent these photos, so someone else reviews them.</p></Card>
            : <Card title={`Review · ${focus.store.name}`}><ReviewDisplay key={`${focus.sub.id}-${focus.sub.round}`} submissionId={focus.sub.id} round={focus.sub.round} criteria={b.criteria} /></Card>)}
          {!focus && rows.length > 1 && <Card><p className="p-4 text-[13.5px] text-muted">Pick a shop to see its photos{reviewer ? " and review them" : ""}.</p></Card>}
        </div>
      </div>
    </>
  );
}
