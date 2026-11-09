import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, type Job, type PrismaClient } from "@prisma/client";
import { db } from "./db";
import { reportError } from "./errors";
import { HANDLERS, RECURRING, type Handler, type JobType } from "./job-handlers";

// A small durable job queue in Postgres (no Redis, no extra process on a 1 GB server).
//  - enqueue() inside a business transaction: the job exists only if the change committed
//  - workers claim with FOR UPDATE SKIP LOCKED, so any number of workers never run a job twice at once
//  - failures retry with exponential backoff; after maxAttempts the job is DEAD and shown at Admin → System
//  - a worker that dies mid-job leaves it RUNNING; after LOCK_TIMEOUT it is picked up again
//  - recurring jobs are enqueued once per time slot with key `type@slot`, so many schedulers are harmless

type Db = PrismaClient | Prisma.TransactionClient;
export const LOCK_TIMEOUT_MS = 10 * 60_000;
const WORKER_ID = `${process.pid}-${randomBytes(3).toString("hex")}`;

export async function enqueue(tx: Db, type: JobType, payload: Prisma.InputJsonObject = {}, opts: { key?: string; runAt?: Date; maxAttempts?: number } = {}) {
  // createMany + skipDuplicates = INSERT … ON CONFLICT DO NOTHING on the idempotency key
  await tx.job.createMany({
    data: [{ type, payload, key: opts.key ?? null, runAt: opts.runAt ?? new Date(), maxAttempts: opts.maxAttempts ?? (HANDLERS[type] as Handler).maxAttempts ?? 5 }],
    skipDuplicates: true,
  });
}

/** Seconds to wait before retry n (1-based): 30s, 1m, 2m, 4m … capped at 1h. */
export const backoffMs = (attempt: number) => Math.min(30_000 * 2 ** (attempt - 1), 3_600_000);

/** Put one job per recurring type into the queue for the current time slot (idempotent). */
export async function scheduleRecurring(now = new Date()) {
  for (const r of RECURRING) {
    const slot = Math.floor(now.getTime() / r.everyMs);
    await enqueue(db, r.type, {}, { key: `${r.type}@${slot}`, runAt: new Date(slot * r.everyMs) });
  }
}

async function claim(limit: number): Promise<Job[]> {
  // Prisma stores timestamp columns as UTC wall time, but the database session runs in
  // Asia/Kathmandu: compare with AT TIME ZONE 'UTC' or every retry looks 5h45m overdue.
  const at = new Date();
  const staleBefore = new Date(at.getTime() - LOCK_TIMEOUT_MS);
  return db.$queryRaw<Job[]>`
    UPDATE "Job" SET "status" = 'RUNNING', "lockedAt" = (${at}::timestamptz AT TIME ZONE 'UTC'), "lockedBy" = ${WORKER_ID}, "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "Job"
      WHERE ("status" = 'QUEUED' AND ("runAt" AT TIME ZONE 'UTC') <= ${at}::timestamptz)
         OR ("status" = 'RUNNING' AND ("lockedAt" AT TIME ZONE 'UTC') < ${staleBefore}::timestamptz)
      ORDER BY "runAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

async function runOne(job: Job) {
  const handler: Handler | undefined = HANDLERS[job.type as JobType];
  try {
    if (!handler) throw new Error(`No handler for job type "${job.type}"`);
    const result = await Promise.race([
      handler.run(job.payload as Prisma.JsonObject),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${(handler.timeoutMs ?? 60_000) / 1000}s`)), handler.timeoutMs ?? 60_000).unref?.()),
    ]);
    await db.job.updateMany({ where: { id: job.id, lockedBy: WORKER_ID }, data: { status: "DONE", finishedAt: new Date(), lockedAt: null, lastError: null, result: (result ?? Prisma.JsonNull) as Prisma.InputJsonValue } });
    return "done" as const;
  } catch (e) {
    const dead = job.attempts >= job.maxAttempts;
    const msg = e instanceof Error ? e.message : String(e);
    await db.job.updateMany({
      where: { id: job.id, lockedBy: WORKER_ID },
      data: dead
        ? { status: "DEAD", finishedAt: new Date(), lockedAt: null, lastError: msg.slice(0, 1000) }
        : { status: "QUEUED", runAt: new Date(Date.now() + backoffMs(job.attempts)), lockedAt: null, lastError: msg.slice(0, 1000) },
    });
    await reportError(`job:${job.type}`, e, { source: "job", context: { attempt: job.attempts, of: job.maxAttempts, dead } });
    return dead ? ("dead" as const) : ("retry" as const);
  }
}

/** One worker pass: schedule recurring work, then run due jobs until the batch or time budget runs out. */
export async function runDueJobs(opts: { limit?: number; budgetMs?: number; now?: Date } = {}) {
  const started = Date.now();
  const tally = { done: 0, retry: 0, dead: 0 };
  // a job that keeps crashing its worker must not loop forever on lock timeouts
  await db.job.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - LOCK_TIMEOUT_MS) }, attempts: { gte: db.job.fields.maxAttempts } },
    data: { status: "DEAD", finishedAt: new Date(), lastError: "Worker stopped while running it (too many times)" },
  });
  await scheduleRecurring(opts.now);
  while (Date.now() - started < (opts.budgetMs ?? 45_000)) {
    const batch = await claim(Math.min(10, opts.limit ?? 50));
    if (!batch.length) break;
    for (const job of batch) tally[await runOne(job)]++;
    if (opts.limit && tally.done + tally.retry + tally.dead >= opts.limit) break;
  }
  return tally;
}

/** Put a dead job back in the queue (owner action from Admin → System). */
export async function retryJob(id: string) {
  const res = await db.job.updateMany({ where: { id, status: "DEAD" }, data: { status: "QUEUED", attempts: 0, runAt: new Date(), finishedAt: null, lastError: null } });
  return res.count > 0;
}
