import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { smsProvider } from "@/lib/notifications";
import { EVERY_LABEL, HANDLERS, RECURRING, type JobType } from "@/lib/job-handlers";
import { cn, formatDateTime, now } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { ResolveErrorButton, RetryJobButton, RunJobsNowButton } from "@/components/admin/system-actions";

export const metadata = { title: "System" };

const short = (v: unknown) => {
  if (v == null) return "—";
  const s = JSON.stringify(v);
  return s.length > 90 ? `${s.slice(0, 90)}…` : s;
};

export default async function SystemPage({ searchParams }: { searchParams: Promise<{ errors?: string }> }) {
  await requirePermission("system");
  const showResolved = (await searchParams).errors === "all";
  const t0 = now();
  await db.$queryRaw`SELECT 1`;
  const dbMs = now() - t0;
  const dayAgo = new Date(now() - 86_400_000);

  const [byStatus, overdue, lastDone, dead, errors, openErrors, sms, sent24, audit] = await Promise.all([
    db.job.groupBy({ by: ["status"], _count: { _all: true } }),
    db.job.count({ where: { status: "QUEUED", runAt: { lt: new Date(now() - 5 * 60_000) } } }),
    Promise.all(RECURRING.map((r) => db.job.findFirst({ where: { type: r.type, status: "DONE" }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true, result: true } }))),
    db.job.findMany({ where: { status: "DEAD" }, orderBy: { finishedAt: "desc" }, take: 20 }),
    db.errorEvent.findMany({ where: showResolved ? {} : { resolvedAt: null }, orderBy: { lastSeen: "desc" }, take: 50 }),
    db.errorEvent.count({ where: { resolvedAt: null } }),
    db.notification.groupBy({ by: ["status"], _count: { _all: true } }),
    db.notification.count({ where: { status: "SENT", sentAt: { gte: dayAgo } } }),
    db.job.findFirst({ where: { type: "stock.audit", status: { in: ["DONE", "DEAD"] } }, orderBy: { finishedAt: "desc" }, select: { status: true, finishedAt: true, result: true, lastError: true } }),
  ]);
  const jobs = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const outbox = (s: string) => sms.find((b) => b.status === s)?._count._all ?? 0;
  const workerSeen = lastDone.map((d) => d?.finishedAt?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0);
  const workerOk = workerSeen > now() - 5 * 60_000;
  const auditResult = audit?.result as { variants?: number; units?: number } | null;

  const tile = (label: string, value: React.ReactNode, sub: string, bad = false) => (
    <div className={cn("rounded-lg border bg-white p-4", bad ? "border-danger/40" : "border-line")}>
      <p className="text-[12px] uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-1 text-[22px] font-semibold", bad && "text-danger")}>{value}</p>
      <p className="text-[12.5px] text-muted">{sub}</p>
    </div>
  );

  return (
    <>
      <PageHeader title="System" description="Is everything running? Background jobs, errors, the SMS outbox and the nightly stock check, in one place." actions={<RunJobsNowButton />} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tile("Release", process.env.ASSON_RELEASE || "dev", `database ${dbMs} ms`)}
        {tile("Job worker", workerOk ? "Running" : "Not seen", workerSeen ? `last finished ${formatDateTime(new Date(workerSeen))}` : "no finished jobs yet", !workerOk && process.env.NODE_ENV === "production")}
        {tile("Queue", jobs("QUEUED") + jobs("RUNNING"), overdue ? `${overdue} overdue by 5+ min` : "nothing overdue", overdue > 0)}
        {tile("Failed jobs", jobs("DEAD"), jobs("DEAD") ? "need a look below" : "none", jobs("DEAD") > 0)}
        {tile("Open errors", openErrors, openErrors ? "grouped below" : "all clear", openErrors > 0)}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Scheduled work">
          <table className="w-full text-[13.5px]">
            <tbody className="divide-y divide-line">
              {RECURRING.map((r, i) => (
                <tr key={r.type}>
                  <td className="px-5 py-2.5"><p className="font-medium">{HANDLERS[r.type as JobType].label}</p><p className="font-mono text-[11.5px] text-muted">{r.type} · {EVERY_LABEL(r.everyMs)}</p></td>
                  <td className="px-3 text-right text-[12.5px] text-muted">{lastDone[i]?.finishedAt ? <>last ran {formatDateTime(lastDone[i]!.finishedAt!)}<br /><span className="font-mono">{short(lastDone[i]!.result)}</span></> : "not run yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Stock audit">
          <div className="px-5 py-4 text-[14px]">
            {!audit ? <p className="text-muted">Runs daily. Nothing yet — use “Run due jobs now”.</p>
              : audit.status === "DONE"
                ? <p className="flex items-start gap-2 text-success"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> <span>Every variant&apos;s total matches its locations ({auditResult?.variants?.toLocaleString("en-IN")} variants, {auditResult?.units?.toLocaleString("en-IN")} units). Checked {formatDateTime(audit.finishedAt!)}.</span></p>
                : <p className="flex items-start gap-2 text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{audit.lastError}</span></p>}
          </div>
          <div className="border-t border-line px-5 py-3 text-[13.5px]">
            <p className="font-medium">SMS outbox {smsProvider() ? "" : <Pill tone="warn">no SMS gateway set up</Pill>}</p>
            <p className="mt-1 text-muted">{outbox("QUEUED")} waiting · {outbox("FAILED")} failed · {sent24} sent in 24 h · <Link href="/admin/notifications" className="underline">open outbox</Link></p>
          </div>
        </Card>
      </div>

      {dead.length > 0 && (
        <Card title={`Failed background jobs (${dead.length})`} className="mt-4">
          <ul className="divide-y divide-line">
            {dead.map((j) => (
              <li key={j.id} className="flex items-start justify-between gap-3 px-5 py-3 text-[13.5px]">
                <div className="min-w-0"><p className="font-mono">{j.type} <span className="text-muted">· {j.attempts} attempt{j.attempts === 1 ? "" : "s"} · {j.finishedAt ? formatDateTime(j.finishedAt) : ""}</span></p><p className="mt-0.5 break-words text-danger">{j.lastError}</p></div>
                <RetryJobButton id={j.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={showResolved ? "All errors" : "Open errors"} className="mt-4" action={<Link href={showResolved ? "/admin/system" : "/admin/system?errors=all"} className="text-[13px] underline">{showResolved ? "Open only" : "Show fixed too"}</Link>}>
        {!errors.length ? <p className="p-8 text-center text-[14px] text-muted">No errors. 🎉</p> : (
          <ul className="divide-y divide-line">
            {errors.map((e) => (
              <li key={e.id} className={cn("px-5 py-3 text-[13.5px]", e.resolvedAt && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2"><Pill tone={e.source === "client" ? "neutral" : "danger"}>{e.source}</Pill><span className="font-mono text-[12.5px]">{e.where}</span><span className="text-muted">× {e.count}</span></p>
                    <p className="mt-1 break-words font-medium">{e.message}</p>
                    <p className="text-[12px] text-muted">first {formatDateTime(e.firstSeen)} · last {formatDateTime(e.lastSeen)}{e.digest ? ` · digest ${e.digest}` : ""}{e.resolvedAt ? ` · fixed by ${e.resolvedBy}` : ""}</p>
                    {e.stack && <details className="mt-1"><summary className="cursor-pointer text-[12.5px] text-muted">Stack trace</summary><pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-cloud p-2 text-[11.5px]">{e.stack}</pre></details>}
                  </div>
                  {!e.resolvedAt && <ResolveErrorButton id={e.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
