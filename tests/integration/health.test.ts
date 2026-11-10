import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { providers } from "@/lib/notifications";
import { runChecks, watchdog } from "@/lib/health";
import { GET as deepHealth } from "@/app/api/health/deep/route";
import { resetDb } from "../support/db";

const HOUR = 3_600_000;
const sent: { to: string; body: string }[] = [];
providers.fake = { name: "fake", send: async (to, body) => { sent.push({ to, body }); return { ok: true, ref: "x" }; } };
const env = (k: string, v: string | undefined) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };
const saved = { ...process.env };

describe("health checks, watchdog and alerts", () => {
  let dir: string;
  beforeEach(async () => {
    await resetDb();
    sent.length = 0;
    dir = mkdtempSync(path.join(tmpdir(), "asson-backups-"));
    env("BACKUP_STATUS_DIR", dir);
    writeFileSync(path.join(dir, ".last-offsite-ok"), new Date(Date.now() - 3 * HOUR).toISOString());
  });
  afterEach(() => { for (const k of ["BACKUP_STATUS_DIR", "NOTIFY_SMS_PROVIDER", "ALERT_PHONES", "HEALTH_KEY"]) env(k, saved[k]); });

  const check = async (key: string) => (await runChecks()).find((c) => c.key === key);

  it("knows when backups are stale or missing, and when the job queue is stuck", async () => {
    expect(await check("backups")).toMatchObject({ ok: true, critical: true });
    writeFileSync(path.join(dir, ".last-offsite-ok"), new Date(Date.now() - 30 * HOUR).toISOString());
    expect(await check("backups")).toMatchObject({ ok: false, detail: "last good copy 30 h ago" });
    writeFileSync(path.join(dir, ".last-hourly-ok"), new Date(Date.now() - 4 * HOUR).toISOString());
    expect(await check("backups_hourly")).toMatchObject({ ok: false, critical: true });

    expect(await check("queue")).toMatchObject({ ok: true });
    await db.job.create({ data: { type: "notifications.dispatch", runAt: new Date(Date.now() - 20 * 60_000) } });
    expect(await check("queue")).toMatchObject({ ok: false, critical: false }); // late: a warning
    await db.job.updateMany({ data: { runAt: new Date(Date.now() - 45 * 60_000) } });
    expect(await check("queue")).toMatchObject({ ok: false, critical: true }); // very late: text the owner
  });

  it("opens one incident, texts the owner once, and again when it recovers", async () => {
    env("NOTIFY_SMS_PROVIDER", "fake");
    env("ALERT_PHONES", "9841000001, +977-9851000002, nonsense");
    writeFileSync(path.join(dir, ".last-offsite-ok"), new Date(Date.now() - 30 * HOUR).toISOString());

    expect((await watchdog()).opened).toEqual(["backups"]);
    expect(sent.map((s) => s.to)).toEqual(["9841000001", "9851000002"]);
    expect(sent[0].body).toMatch(/^Asson ALERT: Nightly off-site backup — last good copy 30 h ago/);
    await watchdog(); // still failing: no second text
    expect(sent).toHaveLength(2);
    expect(await db.incident.count()).toBe(1);

    writeFileSync(path.join(dir, ".last-offsite-ok"), new Date().toISOString());
    expect((await watchdog()).resolved).toEqual(["backups"]);
    expect(sent.slice(2).map((s) => s.body)).toEqual([expect.stringMatching(/^Asson OK: Nightly off-site backup is back to normal/), expect.any(String)]);
    expect(await db.incident.findFirstOrThrow()).toMatchObject({ resolvedAt: expect.any(Date), alertedAt: expect.any(Date), recoveryAlertAt: expect.any(Date) });
    expect(await db.notification.count({ where: { template: "system_alert", status: "SENT" } })).toBe(4);
  });

  it("warnings are recorded but never text anyone", async () => {
    env("NOTIFY_SMS_PROVIDER", "fake");
    env("ALERT_PHONES", "9841000001");
    await db.job.create({ data: { type: "loyalty.birthdays", status: "DEAD", finishedAt: new Date(), lastError: "boom" } }); // (a failed stock audit would be critical)
    const r = await watchdog();
    expect(r.opened).toContain("dead_jobs");
    expect(sent).toEqual([]);
  });

  it("deep health: hidden without the key, 503 when something critical fails", async () => {
    const call = (q = "") => deepHealth(new NextRequest(`http://x/api/health/deep${q}`));
    expect((await call()).status).toBe(404); // no HEALTH_KEY configured: the route doesn't exist
    env("HEALTH_KEY", "k".repeat(32));
    expect((await call("?key=wrong")).status).toBe(404);
    const ok = await call(`?key=${"k".repeat(32)}`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, checks: expect.arrayContaining([{ check: "backups", ok: true, critical: true }]) });
    writeFileSync(path.join(dir, ".last-offsite-ok"), new Date(Date.now() - 30 * HOUR).toISOString());
    expect((await call(`?key=${"k".repeat(32)}`)).status).toBe(503);
  });
});
