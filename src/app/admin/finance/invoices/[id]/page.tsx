import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { invoiceView } from "@/lib/invoices";
import { PrintDocument } from "@/components/invoices/print-document";

export const metadata = { title: "Tax invoice" };

// A4 tax invoice (online orders, or a till sale printed in full). Staff who sell, handle orders or keep the books.
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  if (!(["pos.sell", "orders", "finance"] as const).some((p) => can(me, p))) redirect("/admin");
  const doc = await invoiceView({ id: (await params).id });
  if (!doc) notFound();
  return <div className="bg-white py-4"><PrintDocument doc={doc} size="a4" /></div>;
}
