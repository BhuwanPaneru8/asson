import "server-only";
import { runDueJobs } from "./jobs";
import { reportError } from "./errors";

// The in-process worker: one pass every TICK_MS inside the app server. Passes never overlap, and the
// timer doesn't keep the process alive on shutdown. /api/cron/jobs runs the same pass from the server's
// cron as a heartbeat; SKIP LOCKED makes running both (or two app instances) safe.

const TICK_MS = 15_000;
let started = false;
let busy = false;

export function startWorker() {
  if (started) return;
  started = true;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await runDueJobs({ budgetMs: 10_000 });
    } catch (e) {
      await reportError("job-worker", e, { source: "job" });
    } finally {
      busy = false;
    }
  };
  setInterval(tick, TICK_MS).unref();
  setTimeout(tick, 5_000).unref(); // first pass shortly after boot
  console.log(`[jobs] worker started (every ${TICK_MS / 1000}s)`);
}
