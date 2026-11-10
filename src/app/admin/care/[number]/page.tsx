import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORY_LABEL, CHANNEL_LABEL, caseDetail, careRef, STATUS_LABEL } from "@/lib/care";
import { scopeFor, storeFilter } from "@/lib/scope";
import { cn, formatDateTime, formatOrderNumber, formatPrice, now } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { CaseCompose, CaseTriage } from "@/components/admin/care-forms";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  return { title: `C-${(await params).number}` };
}

export default async function CasePage({ params }: { params: Promise<{ number: string }> }) {
  const me = await requirePermission("care");
  const n = Number((await params).number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const d = await caseDetail(me, n);
  if (!d) notFound();
  const c = d.case;
  const [staff, locations] = await Promise.all([
    db.user.findMany({ where: { role: { not: "CUSTOMER" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.store.findMany({ where: { active: true, kind: "SHOP", ...storeFilter(await scopeFor(me)) }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const overdue = !!c.respondBy && c.respondBy.getTime() < now();
  return (
    <>
      <PageHeader title={`${careRef(c.number)} · ${c.subject}`} description={`${CHANNEL_LABEL[c.channel]} · ${CATEGORY_LABEL[c.category]} · ${formatDateTime(c.createdAt)}`} actions={<Link href="/admin/care" className="text-[13.5px] underline underline-offset-4">Queue</Link>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
            {c.priority === "URGENT" && <Pill tone="danger">Urgent</Pill>}
            <Pill tone={c.status === "RESOLVED" ? "success" : c.status === "WAITING" ? "neutral" : "warn"}>{STATUS_LABEL[c.status]}</Pill>
            {c.respondBy && <span className={cn("ml-1", overdue ? "font-medium text-danger" : "text-muted")}>{overdue ? "reply overdue since" : "reply by"} {formatDateTime(c.respondBy)}</span>}
            <span className="text-muted">· {c.assignee ? `handled by ${c.assignee.name}` : "unassigned"}</span>
          </div>
          <Card title="Conversation">
            <ol className="divide-y divide-line">{c.messages.map((m) => (
              <li key={m.id} className={cn("px-5 py-3", m.kind === "NOTE" && "bg-accent-soft/30", m.kind === "REPLY" && "bg-cloud/40")}>
                <p className="text-[12.5px] text-muted">{m.kind === "CUSTOMER" ? `${m.byName} (customer)` : m.kind === "REPLY" ? `${m.byName} → customer` : `${m.byName} · internal note`} · {formatDateTime(m.createdAt)}</p>
                <p className="mt-0.5 whitespace-pre-line text-[14.5px]">{m.body}</p>
              </li>
            ))}</ol>
            <div className="border-t border-line"><CaseCompose id={c.id} hasPhone={!!c.phone} /></div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Customer">
            <div className="space-y-1 p-4 text-[14px]">
              <p className="font-medium">{c.name}</p>
              {c.phone && <p><a href={`tel:${c.phone}`} className="underline">{c.phone}</a></p>}
              {c.email && <p className="break-all">{c.email}</p>}
              {c.user && <p className="text-[12.5px] text-muted">Has an account ({c.user.email})</p>}
              <p className="text-[12.5px] text-muted">Writes in {c.locale === "ne" ? "Nepali" : "English"}</p>
            </div>
            {d.orders.length > 0 && <ul className="divide-y divide-line border-t border-line text-[13.5px]">{d.orders.map((o) => (
              <li key={o.id}><Link href={`/admin/orders/${o.id}`} className={cn("flex justify-between gap-2 px-4 py-2 hover:bg-cloud/40", o.id === c.orderId && "font-semibold")}><span>{formatOrderNumber(o.number)} · {o.status.toLowerCase().replace(/_/g, " ")}</span><span className="text-muted">{formatPrice(o.total)}</span></Link></li>
            ))}</ul>}
            {d.history.length > 0 && <div className="border-t border-line p-4"><p className="mb-1 text-[12px] font-medium uppercase tracking-wider text-muted">Earlier cases</p><ul className="space-y-1 text-[13.5px]">{d.history.map((h) => <li key={h.number}><Link href={`/admin/care/${h.number}`} className="hover:underline"><span className="text-muted">{careRef(h.number)}</span> {h.subject}</Link> <span className="text-[12px] text-muted">{STATUS_LABEL[h.status]}</span></li>)}</ul></div>}
          </Card>
          <Card title="Triage">
            <CaseTriage id={c.id} status={c.status} priority={c.priority} category={c.category} assigneeId={c.assigneeId} storeId={c.storeId} order={c.order ? formatOrderNumber(c.order.number) : ""} staff={staff} locations={locations} />
          </Card>
        </div>
      </div>
    </>
  );
}
