import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { reconcile } from "@/lib/payments";

// Khalti redirects here with ?pidx=…&status=… — the query is never trusted; reconcile() calls the lookup API.
export async function GET(req: NextRequest) {
  const pidx = req.nextUrl.searchParams.get("pidx");
  const payment = pidx ? await db.payment.findFirst({ where: { providerRef: pidx, provider: "KHALTI" } }) : null;
  if (!payment) return NextResponse.redirect(new URL("/", req.url));
  const outcome = await reconcile(payment);
  const q = outcome === "COMPLETED" ? "paid=1" : outcome === "FAILED" ? "payment=failed" : "payment=pending";
  return NextResponse.redirect(new URL(`/orders/${payment.orderId}?${q}`, req.url));
}
