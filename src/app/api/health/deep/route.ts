import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { criticalFailures, runChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * For the uptime monitor (UptimeRobot etc.): 200 when nothing critical is failing, 503 otherwise, so the owner
 * is alerted for "site up but backups/worker/queue broken" too, even when SMS alerts aren't set up.
 * Needs HEALTH_KEY (env) as ?key=… or a Bearer token; without HEALTH_KEY configured the route doesn't exist.
 * Answers only check names and ok/failing: no counts, no data.
 */
export async function GET(req: NextRequest) {
  const want = process.env.HEALTH_KEY;
  if (!want) return new NextResponse("Not found", { status: 404 });
  const given = req.nextUrl.searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = Buffer.from(given), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new NextResponse("Not found", { status: 404 });
  const checks = await runChecks();
  const failing = criticalFailures(checks);
  return NextResponse.json(
    { ok: failing.length === 0, release: process.env.ASSON_RELEASE, checks: checks.map((c) => ({ check: c.key, ok: c.ok, critical: c.critical })) },
    { status: failing.length ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
