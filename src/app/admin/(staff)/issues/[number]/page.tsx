import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORY_LABEL, issueDetail, issueRef, STATUS_LABEL } from "@/lib/issues";
import { cn, formatDateTime, formatPrice, now } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { IssueComment, ManageIssue, ReopenIssue } from "@/components/admin/issue-forms";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  return { title: `ISS-${(await params).number}` };
}

export default async function IssuePage({ params }: { params: Promise<{ number: string }> }) {
  const me = await requirePermission("self.time");
  const n = Number((await params).number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const d = await issueDetail(me, n);
  if (!d) notFound();
  const { issue: i, repeats, manages, assigned, here } = d;
  const staff = manages ? await db.user.findMany({ where: { role: { not: "CUSTOMER" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];
  const overdue = i.status !== "RESOLVED" && i.dueAt.getTime() < now();
  return (
    <>
      <PageHeader title={`${issueRef(i.number)} · ${i.title}`} description={`${i.store.name} · ${CATEGORY_LABEL[i.category]} · reported by ${i.createdBy.name}, ${formatDateTime(i.createdAt)}`} actions={<Link href="/admin/issues" className="text-[13.5px] underline underline-offset-4">All issues</Link>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                {i.priority === "URGENT" ? <Pill tone="danger">Urgent</Pill> : <Pill>{i.priority === "LOW" ? "Low" : "Normal"} priority</Pill>}
                <Pill tone={i.status === "RESOLVED" ? "success" : i.status === "ON_HOLD" ? "warn" : "neutral"}>{STATUS_LABEL[i.status]}</Pill>
                <span className={cn("ml-1", overdue ? "font-medium text-danger" : "text-muted")}>{i.status === "RESOLVED" ? `fixed ${formatDateTime(i.resolvedAt!)}` : `${overdue ? "overdue since" : "due"} ${formatDateTime(i.dueAt)}`}</span>
              </div>
              {i.description && <p className="whitespace-pre-line text-[14.5px]">{i.description}</p>}
              <p className="text-[13px] text-muted">{i.assignee ? `Being handled by ${i.assignee.name}` : "Nobody assigned yet"}{i.cost ? ` · repair cost ${formatPrice(i.cost)}` : ""}</p>
              {repeats > 0 && <p className="rounded-md bg-accent-soft/50 px-3 py-2 text-[13px]">{repeats + 1}{repeats === 1 ? "nd" : repeats === 2 ? "rd" : "th"} {CATEGORY_LABEL[i.category].toLowerCase()} issue at {i.store.name} in 30 days.</p>}
            </div>
          </Card>
          <Card title="Timeline">
            <ol className="divide-y divide-line">{i.events.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <p className="text-[12.5px] text-muted">{e.byName} · {formatDateTime(e.createdAt)}{e.status ? ` · ${STATUS_LABEL[e.status]}` : ""}</p>
                {e.message && <p className="mt-0.5 whitespace-pre-line text-[14px]">{e.message}</p>}
                {e.photos.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{e.photos.map((p) => <a key={p} href={p} target="_blank" rel="noreferrer" className="relative block h-24 w-24 overflow-hidden rounded-md bg-cloud"><Image src={p} alt="Issue photo" fill sizes="96px" className="object-cover" /></a>)}</div>}
              </li>
            ))}</ol>
            <div className="border-t border-line"><IssueComment id={i.id} /></div>
          </Card>
        </div>
        <div className="space-y-4">
          {(manages || assigned) && <Card title={manages ? "Manage" : "Update status"}><ManageIssue id={i.id} status={i.status} priority={i.priority} assigneeId={i.assigneeId} cost={i.cost} staff={staff} full={manages} /></Card>}
          {i.status === "RESOLVED" && here && <Card><div className="p-4"><p className="mb-2 text-[13.5px] text-muted">Not actually fixed?</p><ReopenIssue id={i.id} /></div></Card>}
        </div>
      </div>
    </>
  );
}
