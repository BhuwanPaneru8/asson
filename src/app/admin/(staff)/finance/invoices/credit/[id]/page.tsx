import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { creditNoteView } from "@/lib/invoices";
import { PrintDocument } from "@/components/invoices/print-document";

export const metadata = { title: "Credit note" };

export default async function CreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  if (!(["pos.sell", "orders", "finance"] as const).some((p) => can(me, p))) redirect("/admin");
  const doc = await creditNoteView({ id: (await params).id });
  if (!doc) notFound();
  return <div className="bg-white py-4"><PrintDocument doc={doc} size="a4" /></div>;
}
