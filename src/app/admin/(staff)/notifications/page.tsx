import Link from "next/link";
import type { NotificationStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { smsProvider } from "@/lib/notifications";
import { formatDateTime, formatOrderNumber } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { NotificationActions, RetryButton } from "@/components/admin/notification-actions";

export const metadata = { title: "Notifications" };

const TONE: Record<NotificationStatus, "neutral" | "success" | "warn" | "danger"> = { QUEUED: "warn", SENDING: "warn", SENT: "success", FAILED: "danger", SKIPPED: "neutral" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission("orders");
  const sp = await searchParams;
  const status = (["QUEUED", "SENT", "FAILED", "SKIPPED"] as const).find((s) => s === sp.status);
  const [rows, counts] = await Promise.all([
    db.notification.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 100, include: { order: { select: { id: true, number: true } } } }),
    db.notification.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const provider = smsProvider();
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  return (
    <>
      <PageHeader title="Customer notifications" description="Every SMS sent to customers about their orders — written first, then delivered by the SMS gateway, with automatic retries." actions={<NotificationActions />} />
      {!provider && <p className="mb-4 rounded-md bg-[#fbf1df] px-4 py-3 text-[14px] text-warn">No SMS gateway is connected yet, so messages are queued and will send automatically once one is set up (Sparrow SMS or Aakash SMS account + API key).</p>}
      <div className="mb-4 flex flex-wrap gap-2">
        {[["", "All"], ["QUEUED", `Queued (${count("QUEUED")})`], ["SENT", `Sent (${count("SENT")})`], ["FAILED", `Failed (${count("FAILED")})`], ["SKIPPED", `Skipped (${count("SKIPPED")})`]].map(([v, l]) => (
          <Link key={v} href={v ? `?status=${v}` : "?"} className={`rounded-md px-3 py-1.5 text-[13.5px] ${(status ?? "") === v ? "bg-ink text-white" : "border border-line bg-white"}`}>{l}</Link>
        ))}
      </div>
      <Card>
        <ul className="divide-y divide-line text-[13.5px]">
          {rows.map((n) => (
            <li key={n.id} className="flex gap-4 px-5 py-3">
              <div className="w-36 shrink-0 text-muted">{formatDateTime(n.createdAt)}<p className="text-[12px]">{n.channel} → {n.to}</p></div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2"><Pill tone={TONE[n.status]}>{n.status.toLowerCase()}</Pill><span className="text-muted">{n.template.replace(/_/g, " ")}</span>{n.order && <Link href={`/admin/orders/${n.order.id}`} className="underline">{formatOrderNumber(n.order.number)}</Link>}{n.attempts > 1 && <span className="text-muted">· {n.attempts} attempts</span>}</p>
                <p className="mt-1 text-ink-soft">{n.body}</p>
                {n.error && <p className="mt-1 text-[12.5px] text-danger">{n.error}</p>}
              </div>
              {n.status === "FAILED" && <RetryButton id={n.id} />}
            </li>
          ))}
        </ul>
        {!rows.length && <p className="p-8 text-center text-muted">No messages yet.</p>}
      </Card>
    </>
  );
}
