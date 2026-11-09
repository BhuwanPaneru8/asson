"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { retryNotification, sendQueuedNow } from "@/actions/admin/notifications";

export function NotificationActions() {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { const r = await sendQueuedNow(); if (r.ok) toast.success(r.message); else toast(r.message); })} className="h-10 rounded-md bg-ink px-4 text-[14px] text-white disabled:opacity-50">{pending ? "Sending…" : "Send queued now"}</button>;
}

export function RetryButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { await retryNotification(id); toast.success("Queued for retry"); })} className="h-8 shrink-0 rounded-md border border-line px-3 text-[13px] hover:border-ink">Retry</button>;
}
