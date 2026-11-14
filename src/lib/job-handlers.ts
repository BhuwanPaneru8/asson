import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { dispatchNotifications } from "./notifications";
import { expireUnpaidOrders } from "./payments";
import { birthdayRun } from "./referrals";
import { autoDraftReplenishment } from "./replenishment";
import { watchdog } from "./health";
import { autoCloseForgotten } from "./people";
import { findNoShows } from "./absences";
import { buildRecommendations } from "./recommend";
import { escalateOverdue } from "./issues";
import { postRecurring } from "./shop-pl";
import { runPriceEvents } from "./markdowns";
import { sendMetaPurchase } from "./marketing";
import { syncCbms } from "./cbms";

// What each background job does. Handlers must be safe to run twice (a worker can die after the
// work but before marking it done), so each one is idempotent or guarded by conditional updates.

export type Handler = { run: (payload: Prisma.JsonObject) => Promise<unknown>; maxAttempts?: number; timeoutMs?: number; label: string };

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** Variants whose total doesn't equal the sum of their locations (should always be empty: a trigger keeps it). */
export async function stockAudit() {
  const drift = await db.$queryRaw<{ sku: string; stock: number; located: bigint }[]>`
    SELECT v."sku", v."stock", COALESCE(SUM(s."quantity"), 0) AS "located"
    FROM "Variant" v LEFT JOIN "StoreStock" s ON s."variantId" = v."id"
    GROUP BY v."id" HAVING v."stock" <> COALESCE(SUM(s."quantity"), 0)
    LIMIT 50`;
  const [variants, units] = await Promise.all([db.variant.count(), db.storeStock.aggregate({ _sum: { quantity: true } })]);
  const result = { variants, units: units._sum.quantity ?? 0, drift: drift.map((d) => ({ sku: d.sku, total: d.stock, atLocations: Number(d.located) })) };
  if (result.drift.length) throw new Error(`Stock audit: ${result.drift.length} variant(s) don't match their locations (${result.drift.slice(0, 5).map((d) => d.sku).join(", ")})`);
  return result;
}

export const HANDLERS = {
  "notifications.dispatch": { label: "Send queued SMS", run: () => dispatchNotifications(200), maxAttempts: 3 },
  // off (a no-op) until CBMS_MODE and the taxpayer credentials are set
  "cbms.sync": { label: "Post invoices and credit notes to the IRD (CBMS)", run: () => syncCbms(200), maxAttempts: 3 },
  "system.watchdog": { label: "Health checks and owner alerts", run: () => watchdog(), maxAttempts: 1 },
  "costs.recurring": { label: "Post this month's recurring costs (rent, internet…) to Expenses", run: () => postRecurring(), maxAttempts: 3 },
  "issues.escalate": { label: "Flag shop issues past their due time to HQ", run: () => escalateOverdue(), maxAttempts: 2 },
  "people.autoclose": { label: "Close forgotten clock-outs (for a manager to fix)", run: () => autoCloseForgotten(), maxAttempts: 2 },
  "recommend.build": { label: "Rebuild recommendations (bought together, similar)", run: () => buildRecommendations(), maxAttempts: 2 },
  "people.absences": { label: "Record missed shifts as absences (for a manager to decide)", run: () => findNoShows(), maxAttempts: 3 },
  "payments.expire": { label: "Release unpaid online orders", run: () => expireUnpaidOrders(), maxAttempts: 3 },
  // a mismatch is a bug, not a flaky network: fail once, loudly
  "stock.audit": { label: "Nightly stock audit", run: stockAudit, maxAttempts: 1, timeoutMs: 5 * MIN },
  "replenishment.drafts": { label: "Draft shop restock transfers (if switched on)", run: () => autoDraftReplenishment(), maxAttempts: 2, timeoutMs: 5 * MIN },
  "loyalty.birthdays": { label: "Birthday points and greetings", run: () => birthdayRun(), maxAttempts: 3 },
  "ads.purchase": { label: "Report a purchase to Meta (shoppers who accepted ad cookies)", run: (p) => sendMetaPurchase(p as Parameters<typeof sendMetaPurchase>[0]), maxAttempts: 4 },
  "markdowns.run": { label: "Start and end scheduled sales (prices)", run: () => runPriceEvents(), maxAttempts: 3, timeoutMs: 5 * MIN },
  "jobs.prune": {
    label: "Tidy finished jobs",
    // finished bookkeeping rows only; dead jobs and errors stay until a human deals with them
    run: async () => ({ deleted: (await db.job.deleteMany({ where: { status: "DONE", finishedAt: { lt: new Date(Date.now() - 30 * DAY) } } })).count }),
    maxAttempts: 2,
  },
} satisfies Record<string, Handler>;

export type JobType = keyof typeof HANDLERS;

/** Recurring work. Slots are aligned to the epoch, so "daily" runs just after 05:45 Nepal time. */
export const RECURRING: { type: JobType; everyMs: number }[] = [
  { type: "notifications.dispatch", everyMs: 1 * MIN },
  { type: "cbms.sync", everyMs: 1 * MIN },
  { type: "system.watchdog", everyMs: 5 * MIN },
  { type: "people.autoclose", everyMs: 60 * MIN },
  { type: "people.absences", everyMs: 60 * MIN },
  { type: "recommend.build", everyMs: DAY },
  { type: "issues.escalate", everyMs: 15 * MIN },
  { type: "costs.recurring", everyMs: DAY },
  { type: "payments.expire", everyMs: 10 * MIN },
  { type: "markdowns.run", everyMs: 5 * MIN },
  { type: "stock.audit", everyMs: DAY },
  { type: "jobs.prune", everyMs: DAY },
  { type: "loyalty.birthdays", everyMs: DAY },
  { type: "replenishment.drafts", everyMs: DAY },
];

export const EVERY_LABEL = (ms: number) => (ms >= DAY ? "daily" : ms >= 60 * MIN ? `every ${ms / (60 * MIN)} h` : `every ${ms / MIN} min`);
