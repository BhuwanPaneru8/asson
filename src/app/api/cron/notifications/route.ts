import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { dispatchNotifications } from "@/lib/notifications";

/** Retries and sends queued customer messages. Schedule every 1–5 minutes. */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await dispatchNotifications(200));
}
