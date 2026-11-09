import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { PaymentProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewOrder } from "@/lib/order-access";
import { PROVIDER_LABEL, startPayment } from "@/lib/payments";
import { buttonClass } from "@/components/ui/button";
import { AutoPostForm } from "@/components/cart/auto-post-form";

export const metadata: Metadata = { title: "Redirecting to payment", robots: { index: false } };

// Starting a payment has side effects, so this page is only reached via redirects/plain links (never prefetched).
export default async function PayPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ provider?: string }> }) {
  const [{ orderId }, { provider }, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, userId: true } });
  if (!order || !canViewOrder(order, user)) notFound();
  const p = (provider ?? "").toUpperCase() as PaymentProvider;
  if (p !== "ESEWA" && p !== "KHALTI") redirect(`/orders/${orderId}`);

  const r = await startPayment(orderId, p);
  if (r.kind === "redirect") redirect(r.url);
  if (r.kind === "error") {
    return (
      <div className="container-page flex min-h-[50vh] flex-col items-center justify-center text-center">
        <h1 className="font-display text-3xl">Payment couldn&apos;t start</h1>
        <p className="mt-2 max-w-md text-muted">{r.message}</p>
        <Link href={`/orders/${orderId}`} className={buttonClass("primary", "md", "mt-6")}>Back to your order</Link>
      </div>
    );
  }
  return (
    <div className="container-page flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ink" />
      <h1 className="mt-5 font-display text-3xl">Taking you to {PROVIDER_LABEL[p]}…</h1>
      <p className="mt-2 text-muted">Don&apos;t close this window. You&apos;ll come back here after paying.</p>
      <AutoPostForm action={r.action} fields={r.fields} label={`Continue to ${PROVIDER_LABEL[p]}`} />
    </div>
  );
}
