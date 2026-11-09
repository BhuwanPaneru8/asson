import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { runDueJobs } from "@/lib/jobs";

/** Heartbeat for the job queue (the app also runs it in-process). Schedule every minute. */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runDueJobs({ budgetMs: 40_000 }));
}
