import type { Instrumentation } from "next";

/** Runs once when the server starts: refuse to boot production with missing or weak settings, then start the job worker. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const problems: string[] = [];
  for (const key of ["DATABASE_URL", "NEXT_PUBLIC_SITE_URL", "CRON_SECRET", "MEDIA_DIR"]) if (!process.env[key]) problems.push(`${key} is not set`);
  if ((process.env.AUTH_SECRET ?? "").length < 32) problems.push("AUTH_SECRET must be at least 32 characters");
  if (problems.length && process.env.SKIP_ENV_CHECK !== "1") {
    throw new Error(`Asson cannot start:\n - ${problems.join("\n - ")}`);
  }
  // background jobs run inside the app server (JOBS_WORKER=off to disable, e.g. for a second instance)
  if (process.env.JOBS_WORKER !== "off" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startWorker } = await import("./lib/job-worker");
    startWorker();
  }
}

/** Every server-side crash Next catches (pages, route handlers, server actions) goes to Admin → System. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("./lib/errors");
  // path without the query string (it can carry tokens or personal data)
  await reportError(context.routePath || request.path.split("?")[0], err, {
    source: "server",
    context: { method: request.method, routeType: context.routeType, path: request.path.split("?")[0].slice(0, 200) },
  });
};
