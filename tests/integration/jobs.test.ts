import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { enqueue, runDueJobs, scheduleRecurring, LOCK_TIMEOUT_MS } from "@/lib/jobs";
import { HANDLERS } from "@/lib/job-handlers";
import { normaliseMessage, reportError } from "@/lib/errors";
import { resolveError, retryDeadJob } from "@/actions/admin/system";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";

const past = () => new Date(Date.now() - 1000);

describe("background jobs", () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  it("enqueueing the same key twice is a no-op; recurring work gets one job per time slot", async () => {
    await enqueue(db, "jobs.prune", {}, { key: "k1" });
    await enqueue(db, "jobs.prune", {}, { key: "k1" });
    expect(await db.job.count({ where: { key: "k1" } })).toBe(1);
    const at = new Date("2026-11-11T10:00:30Z");
    await scheduleRecurring(at);
    await scheduleRecurring(new Date("2026-11-11T10:00:50Z")); // same minute
    expect(await db.job.count({ where: { type: "notifications.dispatch" } })).toBe(1);
    await scheduleRecurring(new Date("2026-11-11T10:01:05Z"));
    expect(await db.job.count({ where: { type: "notifications.dispatch" } })).toBe(2);
    expect(await db.job.count({ where: { type: "stock.audit" } })).toBe(1);
  });

  it("runs due jobs and stores their result; the stock audit passes on consistent data", async () => {
    await makeProduct({ stock: { M: 4, L: 2 } });
    await runDueJobs({ budgetMs: 5_000 });
    const audit = await db.job.findFirstOrThrow({ where: { type: "stock.audit" } });
    expect(audit).toMatchObject({ status: "DONE", attempts: 1, result: { variants: 2, units: 6, drift: [] } });
  });

  it("retries with backoff, then parks the job as DEAD and groups the error", async () => {
    vi.spyOn(HANDLERS["payments.expire"], "run").mockRejectedValue(new Error("Khalti lookup timed out for order 1234"));
    await enqueue(db, "payments.expire", {}, { key: "pe", maxAttempts: 3 });
    for (let i = 0; i < 3; i++) {
      await db.job.updateMany({ where: { key: "pe" }, data: { runAt: past() } }); // skip the backoff wait
      await runDueJobs({ budgetMs: 2_000 });
      const j = await db.job.findUniqueOrThrow({ where: { key: "pe" } });
      expect(j.attempts).toBe(i + 1);
      if (i < 2) expect(j.runAt.getTime()).toBeGreaterThan(Date.now() + 20_000);
    }
    expect(await db.job.findUniqueOrThrow({ where: { key: "pe" } })).toMatchObject({ status: "DEAD", lastError: expect.stringMatching(/timed out/) });
    // every failure of this job lands in one error group (the recurring slot fails too, so ≥ 3)
    const groups = await db.errorEvent.findMany({ where: { where: "job:payments.expire" } });
    expect(groups).toHaveLength(1);
    expect(groups[0].source).toBe("job");
    expect(groups[0].count).toBeGreaterThanOrEqual(3);

    // the owner can put it back in the queue (audited); managers can't
    const dead = await db.job.findUniqueOrThrow({ where: { key: "pe" } });
    actAs(await makeUser("MANAGER"));
    await expect(retryDeadJob(dead.id)).rejects.toThrow();
    actAs(await makeUser("ADMIN"));
    expect(await retryDeadJob(dead.id)).toEqual({ ok: true });
    expect(await db.job.findUniqueOrThrow({ where: { key: "pe" } })).toMatchObject({ status: "QUEUED", attempts: 0 });
    expect(await db.auditLog.count({ where: { action: "job.retry" } })).toBe(1);
  });

  it("two workers at once never run the same job twice", async () => {
    let runs = 0;
    vi.spyOn(HANDLERS["jobs.prune"], "run").mockImplementation(async () => { runs++; await new Promise((r) => setTimeout(r, 50)); return { deleted: 0 }; });
    for (let i = 0; i < 6; i++) await enqueue(db, "jobs.prune", {}, { key: `p${i}` });
    await Promise.all([runDueJobs({ budgetMs: 3_000 }), runDueJobs({ budgetMs: 3_000 }), runDueJobs({ budgetMs: 3_000 })]);
    // 6 queued + 1 recurring slot
    expect(runs).toBe(7);
    expect(await db.job.count({ where: { type: "jobs.prune", status: "DONE", attempts: 1 } })).toBe(7);
  });

  it("picks up a job whose worker died mid-run", async () => {
    await enqueue(db, "jobs.prune", {}, { key: "stuck" });
    await db.job.updateMany({ where: { key: "stuck" }, data: { status: "RUNNING", attempts: 1, lockedBy: "dead-worker", lockedAt: new Date(Date.now() - LOCK_TIMEOUT_MS - 1000) } });
    await runDueJobs({ budgetMs: 2_000 });
    expect(await db.job.findUniqueOrThrow({ where: { key: "stuck" } })).toMatchObject({ status: "DONE", attempts: 2 });
  });

  it("the stock audit fails loudly when a total drifts from its locations", async () => {
    const p = await makeProduct({ stock: { M: 4 } });
    await db.$executeRawUnsafe(`ALTER TABLE "Variant" DISABLE TRIGGER variant_stock_guard`);
    try {
      await db.variant.update({ where: { id: p.variants[0].id }, data: { stock: 9 } });
    } finally {
      await db.$executeRawUnsafe(`ALTER TABLE "Variant" ENABLE TRIGGER variant_stock_guard`);
    }
    await runDueJobs({ budgetMs: 5_000 });
    expect(await db.job.findFirstOrThrow({ where: { type: "stock.audit" } })).toMatchObject({ status: "DEAD", lastError: expect.stringMatching(new RegExp(`1 variant.*${p.variants[0].sku}`)) });
  });
});

describe("error tracking", () => {
  beforeEach(resetDb);

  it("groups repeats of the same bug, ignoring ids and numbers, and reopens fixed ones", async () => {
    expect(normaliseMessage("Order cmw9dj10x0002uo2wv9rou6co failed after 3 tries")).toBe("Order :id failed after # tries");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await reportError("placeOrder", new Error("Timeout after 5000ms on order 12"));
    await reportError("placeOrder", new Error("Timeout after 5001ms on order 99"));
    await reportError("saveProduct", new Error("Timeout after 5000ms on order 12"));
    const groups = await db.errorEvent.findMany({ orderBy: { where: "asc" } });
    expect(groups.map((g) => [g.where, g.count])).toEqual([["placeOrder", 2], ["saveProduct", 1]]);

    actAs(await makeUser("ADMIN"));
    expect(await resolveError(groups[0].id)).toEqual({ ok: true });
    await reportError("placeOrder", new Error("Timeout after 7000ms on order 5"));
    expect(await db.errorEvent.findUniqueOrThrow({ where: { id: groups[0].id } })).toMatchObject({ count: 3, resolvedAt: null });
  });

  it("never throws, even if recording fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db.errorEvent, "upsert").mockRejectedValue(new Error("db down"));
    await expect(reportError("x", new Error("boom"))).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });
});
