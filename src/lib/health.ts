import "server-only";
import { readFile, stat, statfs } from "node:fs/promises";
import { db } from "./db";
import { smsProvider } from "./notifications";
import { formatDateTime } from "./utils";

// Is the whole system healthy? Every moving part a company running on this platform depends on, checked the
// same way for Admin → System, the deep health URL an uptime monitor watches, and the 5-minute watchdog that
// texts the owner. Critical = customers or money are affected now (or backups are at risk); warnings can
// wait for office hours and only show on the System page.

const MIN = 60_000, HOUR = 60 * MIN;

export type Check = { key: string; label: string; ok: boolean; critical: boolean; detail: string };

const prod = () => process.env.NODE_ENV === "production";
/** Where the server's backup script writes its "last good copy" times (deploy/server-setup.sh). */
const backupDir = () => process.env.BACKUP_STATUS_DIR ?? (prod() ? "/var/backups/asson" : null);

async function ageOfStamp(file: string): Promise<number | null> {
  try {
    const iso = (await readFile(file, "utf8")).trim();
    const t = Date.parse(iso) || (await stat(file)).mtimeMs;
    return Number.isFinite(t) ? Date.now() - t : null;
  } catch { return null; }
}

const hrs = (ms: number) => (ms < 2 * HOUR ? `${Math.round(ms / MIN)} min` : `${Math.round(ms / HOUR)} h`);

export async function runChecks(now = new Date()): Promise<Check[]> {
  const t = now.getTime();
  const checks: Check[] = [];
  const add = (key: string, label: string, ok: boolean, critical: boolean, detail: string) => checks.push({ key, label, ok, critical, detail });

  // database
  const t0 = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const ms = Date.now() - t0;
    add("database", "Database", ms < 1000, false, `answers in ${ms} ms`);
  } catch (e) {
    add("database", "Database", false, true, `not answering: ${e instanceof Error ? e.message.slice(0, 120) : "error"}`);
    return checks; // nothing else can be checked
  }

  const [lastDone, overdue, oldestOverdue, dead24, smsStuck, smsFailed24, audit, errorsHour] = await Promise.all([
    db.job.findFirst({ where: { status: "DONE" }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true } }),
    db.job.count({ where: { status: "QUEUED", runAt: { lt: new Date(t - 5 * MIN) } } }),
    db.job.findFirst({ where: { status: "QUEUED", runAt: { lt: new Date(t - 5 * MIN) } }, orderBy: { runAt: "asc" }, select: { runAt: true, type: true } }),
    db.job.count({ where: { status: "DEAD", finishedAt: { gte: new Date(t - 24 * HOUR) } } }),
    db.notification.count({ where: { status: "QUEUED", createdAt: { lt: new Date(t - 30 * MIN) } } }),
    db.notification.count({ where: { status: "FAILED", createdAt: { gte: new Date(t - 24 * HOUR) } } }),
    db.job.findFirst({ where: { type: "stock.audit", status: { in: ["DONE", "DEAD"] } }, orderBy: { finishedAt: "desc" }, select: { status: true, finishedAt: true, lastError: true } }),
    db.errorEvent.count({ where: { lastSeen: { gte: new Date(t - HOUR) }, resolvedAt: null } }),
  ]);

  // background work: SMS, payment expiry, nightly audit… all go through the job queue
  const since = lastDone?.finishedAt ? t - lastDone.finishedAt.getTime() : null;
  if (prod()) add("worker", "Background worker", since != null && since < 10 * MIN, true, since == null ? "has never finished a job" : `last finished a job ${hrs(since)} ago`);
  const lateBy = oldestOverdue ? t - oldestOverdue.runAt.getTime() : 0;
  add("queue", "Job queue", lateBy < 15 * MIN, lateBy >= 30 * MIN, overdue ? `${overdue} job(s) waiting, oldest ${oldestOverdue!.type} ${hrs(lateBy)} late` : "nothing waiting");
  add("dead_jobs", "Failed jobs", dead24 === 0, false, dead24 ? `${dead24} gave up in the last 24 h` : "none in 24 h");

  // customers waiting on texts (only meaningful when a gateway is connected)
  if (smsProvider()) add("sms", "SMS to customers", smsStuck === 0 && smsFailed24 < 20, smsStuck > 0, smsStuck ? `${smsStuck} message(s) stuck for 30+ min` : smsFailed24 ? `${smsFailed24} failed in 24 h` : "sending");

  // stock must add up across locations; the nightly audit proves it
  const auditAge = audit?.finishedAt ? t - audit.finishedAt.getTime() : null;
  if (prod() || audit) add("stock_audit", "Nightly stock audit", audit?.status === "DONE" && auditAge != null && auditAge < 26 * HOUR, audit?.status === "DEAD",
    !audit ? "hasn't run yet" : audit.status === "DEAD" ? `FAILED: ${audit.lastError?.slice(0, 120) ?? "see Failed jobs"}` : `last clean ${hrs(auditAge!)} ago`);

  add("errors", "Errors", errorsHour < 10, false, errorsHour ? `${errorsHour} different error(s) in the last hour` : "none in the last hour");

  // backups: nightly full copies off-site, hourly production copies
  const dir = backupDir();
  if (dir) {
    const nightly = await ageOfStamp(`${dir}/.last-offsite-ok`);
    add("backups", "Nightly off-site backup", nightly != null && nightly < 26 * HOUR, true, nightly == null ? "no successful off-site backup recorded" : `last good copy ${hrs(nightly)} ago`);
    const hourly = await ageOfStamp(`${dir}/.last-hourly-ok`);
    if (hourly != null) add("backups_hourly", "Hourly backup", hourly < 2 * HOUR, hourly >= 3 * HOUR, `last good copy ${hrs(hourly)} ago`);
  }

  // disk: database, photos and backups share it
  try {
    const fs = await statfs(process.env.MEDIA_DIR ?? process.cwd());
    const free = fs.bavail / fs.blocks;
    add("disk", "Disk space", free >= 0.1, free < 0.05, `${Math.round(free * 100)}% free (${Math.round((fs.bavail * fs.bsize) / 1e9)} GB)`);
  } catch { /* not measurable here */ }

  return checks;
}

/** For the uptime monitor: healthy unless something critical is failing. */
export const criticalFailures = (checks: Check[]) => checks.filter((c) => !c.ok && c.critical);

const alertPhones = () => (process.env.ALERT_PHONES ?? "").split(",").map((p) => p.replace(/\D/g, "").slice(-10)).filter((p) => /^9[678]\d{8}$/.test(p));

/** Text the owner directly (not via the outbox: the outbox depends on the worker that may be the problem). */
async function alert(text: string) {
  const provider = smsProvider(), phones = alertPhones();
  if (!provider || !phones.length) return false;
  let sent = false;
  for (const to of phones) {
    const r = await provider.send(to, text).catch((e) => ({ ok: false as const, error: String(e), retry: false }));
    await db.notification.create({ data: { channel: "SMS", template: "system_alert", to, body: text, status: r.ok ? "SENT" : "FAILED", sentAt: r.ok ? new Date() : null, error: r.ok ? null : r.error.slice(0, 300) } });
    sent ||= r.ok;
  }
  return sent;
}

/**
 * Every 5 minutes: open an incident when a check starts failing, close it when it passes again, and text the
 * owner once when a critical one starts (and once when it recovers). A check that flaps open/closed within
 * one run is just a new incident; each incident alerts at most once.
 */
export async function watchdog(now = new Date()) {
  const checks = await runChecks(now);
  const open = await db.incident.findMany({ where: { resolvedAt: null } });
  const opened: string[] = [], resolved: string[] = [];
  for (const c of checks) {
    const cur = open.find((i) => i.check === c.key);
    if (!c.ok && !cur) {
      const inc = await db.incident.create({ data: { check: c.key, critical: c.critical, detail: c.detail.slice(0, 300), startedAt: now, lastSeenAt: now } });
      opened.push(c.key);
      if (c.critical && (await alert(`Asson ALERT: ${c.label} — ${c.detail}. Since ${formatDateTime(now)}. Admin → System.`))) await db.incident.update({ where: { id: inc.id }, data: { alertedAt: new Date() } });
    } else if (!c.ok && cur) {
      // still failing: keep the latest detail; escalate if it became critical, and alert if we never managed to
      const critical = cur.critical || c.critical;
      const alertNow = critical && !cur.alertedAt && (await alert(`Asson ALERT: ${c.label} — ${c.detail}. Since ${formatDateTime(cur.startedAt)}. Admin → System.`));
      await db.incident.update({ where: { id: cur.id }, data: { detail: c.detail.slice(0, 300), lastSeenAt: now, critical, ...(alertNow ? { alertedAt: new Date() } : {}) } });
    } else if (c.ok && cur) {
      const recovered = cur.alertedAt ? await alert(`Asson OK: ${c.label} is back to normal (${c.detail}). Down for ${hrs(now.getTime() - cur.startedAt.getTime())}.`) : false;
      await db.incident.update({ where: { id: cur.id }, data: { resolvedAt: now, ...(recovered ? { recoveryAlertAt: new Date() } : {}) } });
      resolved.push(c.key);
    }
  }
  return { checks: checks.length, failing: checks.filter((c) => !c.ok).map((c) => c.key), opened, resolved };
}

export const alertsConfigured = () => !!smsProvider() && alertPhones().length > 0;
