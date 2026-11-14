import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewOrder } from "@/lib/order-access";
import { creditNoteView, invoiceView } from "@/lib/invoices";
import { TaxDocument } from "@/components/invoices/tax-document";
import { PrintButton } from "@/components/admin/print-button";

export const metadata: Metadata = { title: "Tax invoice", robots: { index: false } };

// The customer's tax invoice (A4) for a delivered or collected order, with any credit notes. It's marked as the
// customer's electronic copy; the shop's own paper prints are numbered copies (Admin → Finance → Tax invoices).
export default async function OrderInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const order = await db.order.findUnique({ where: { id }, select: { id: true, userId: true, invoice: { select: { creditNotes: { select: { id: true }, orderBy: { issuedAt: "asc" } } } } } });
  if (!order || !canViewOrder(order, user) || !order.invoice) notFound();
  const [invoice, ...notes] = await Promise.all([invoiceView({ orderId: order.id }), ...order.invoice.creditNotes.map((c) => creditNoteView({ id: c.id }))]);
  if (!invoice) notFound();
  return (
    <div className="container-page py-8 print:p-0">
      <p className="mb-4 print:hidden"><Link href={`/orders/${order.id}`} className="text-[14px] underline underline-offset-4">Back to the order</Link></p>
      <div className="border border-line print:border-0"><TaxDocument doc={invoice} size="a4" copy="Customer copy (electronic)" /></div>
      {notes.map((n) => n && <div key={n.id} className="mt-8 border border-line print:mt-0 print:break-before-page print:border-0"><TaxDocument doc={n} size="a4" copy="Customer copy (electronic)" /></div>)}
      <div className="text-center"><PrintButton /></div>
    </div>
  );
}
