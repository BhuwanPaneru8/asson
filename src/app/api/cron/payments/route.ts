import { NextResponse, type NextRequest } from "next/server";
import { expireUnpaidOrders } from "@/lib/payments";
import { isCronAuthorized } from "@/lib/cron";

/**
 * Reconciles and releases unpaid online orders. Schedule every 5 minutes, e.g.
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/payments
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await expireUnpaidOrders());
}
