"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { resolveError, retryDeadJob, runJobsNow } from "@/actions/admin/system";

const small = "h-8 shrink-0 rounded-md border border-line bg-white px-3 text-[13px] hover:border-ink disabled:opacity-40";

export function RetryJobButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} className={small} onClick={() => start(async () => { const r = await retryDeadJob(id); if (r.ok) toast.success("Queued again"); else toast.error(r.error); })}>Retry</button>;
}

export function ResolveErrorButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} className={small} onClick={() => start(async () => { const r = await resolveError(id); if (r.ok) toast.success("Marked fixed — it reopens if it happens again"); else toast.error(r.error); })}>Mark fixed</button>;
}

export function RunJobsNowButton() {
  const [pending, start] = useTransition();
  return <button disabled={pending} className="h-10 rounded-md border border-line bg-white px-4 text-[14px] hover:border-ink disabled:opacity-40" onClick={() => start(async () => { const r = await runJobsNow(); if (r.ok) toast.success(`Ran ${r.done ?? 0} job${r.done === 1 ? "" : "s"}`); })}>{pending ? "Running…" : "Run due jobs now"}</button>;
}
