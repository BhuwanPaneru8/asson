"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { retryJob, runDueJobs } from "@/lib/jobs";

type R = { ok: true } | { ok: false; error: string };

export async function retryDeadJob(id: string): Promise<R> {
  const me = await requirePermission("system");
  const job = await db.job.findUnique({ where: { id }, select: { type: true, lastError: true } });
  if (!job || !(await retryJob(id))) return { ok: false, error: "That job isn't waiting for a retry." };
  await audit(db, me, { action: "job.retry", entity: ["Job", id], summary: `Retried failed background job ${job.type}${job.lastError ? ` (last error: ${job.lastError.slice(0, 120)})` : ""}` });
  refresh();
  return { ok: true };
}

export async function resolveError(id: string): Promise<R> {
  const me = await requirePermission("system");
  const res = await db.errorEvent.updateMany({ where: { id, resolvedAt: null }, data: { resolvedAt: new Date(), resolvedBy: me.name } });
  if (!res.count) return { ok: false, error: "Already resolved." };
  const e = await db.errorEvent.findUniqueOrThrow({ where: { id }, select: { where: true, message: true, count: true } });
  await audit(db, me, { action: "error.resolve", entity: ["ErrorEvent", id], summary: `Marked fixed: ${e.where} — ${e.message.slice(0, 120)} (${e.count}×)` });
  refresh();
  return { ok: true };
}

/** Run due background work now instead of waiting for the next tick. */
export async function runJobsNow(): Promise<R & { done?: number }> {
  await requirePermission("system");
  const t = await runDueJobs({ budgetMs: 20_000 });
  refresh();
  return { ok: true, done: t.done };
}
