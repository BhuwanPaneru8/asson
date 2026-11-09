import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { reconcile } from "@/lib/payments";

// eSewa sends the customer here on cancel / failure. Confirm with eSewa before giving up on the attempt.
export async function GET(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const payment = await db.payment.findUnique({ where: { reference: ref } });
  if (!payment || payment.provider !== "ESEWA") return NextResponse.redirect(new URL("/", req.url));
  const outcome = await reconcile(payment);
  const q = outcome === "COMPLETED" ? "paid=1" : outcome === "AMBIGUOUS" ? "payment=pending" : "payment=failed";
  return NextResponse.redirect(new URL(`/orders/${payment.orderId}?${q}`, req.url));
}
