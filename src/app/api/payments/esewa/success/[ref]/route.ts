import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyEsewaCallback, fromRupeeString } from "@/lib/payments/esewa";
import { reconcile, settlePaid } from "@/lib/payments";

// eSewa redirects the customer here with ?data=<base64 signed JSON>.
export async function GET(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const payment = await db.payment.findUnique({ where: { reference: ref } });
  if (!payment || payment.provider !== "ESEWA") return NextResponse.redirect(new URL("/", req.url));
  const back = (q: string) => NextResponse.redirect(new URL(`/orders/${payment.orderId}?${q}`, req.url));

  const data = req.nextUrl.searchParams.get("data");
  const cb = data ? verifyEsewaCallback(data) : null;
  if (cb && cb.transaction_uuid === ref && cb.status === "COMPLETE") {
    const r = await settlePaid(payment.id, { amount: fromRupeeString(cb.total_amount), providerTxn: cb.transaction_code, raw: cb });
    return back(r.ok ? "paid=1" : "payment=review");
  }
  // Missing/invalid signature: don't trust the browser — ask eSewa directly.
  const outcome = await reconcile(payment);
  return back(outcome === "COMPLETED" ? "paid=1" : outcome === "FAILED" ? "payment=failed" : "payment=pending");
}
