import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { billMismatch, poReceivedValue, supplierStatement } from "@/lib/payables";
import { cn, formatDate, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { VoidButton } from "@/components/admin/payables-forms";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Supplier statement" };

export default async function SupplierStatementPage({ params }: { params: Promise<{ supplierId: string }> }) {
  const me = await requirePermission("purchasing");
  const canVoid = can(me, "finance");
  const supplier = await db.supplier.findUnique({ where: { id: (await params).supplierId }, select: { id: true, name: true, phone: true, paymentTermsDays: true } });
  if (!supplier) notFound();
  const rows = await supplierStatement(supplier.id);
  // three-way check for bills linked to a PO: billed goods vs goods actually received
  const checks = new Map<string, number>();
  for (const r of rows) {
    if (r.kind === "bill" && r.po && !r.void) {
      const bill = await db.supplierBill.findUniqueOrThrow({ where: { id: r.id }, select: { amount: true, vatAmount: true } });
      checks.set(r.id, billMismatch(bill, await poReceivedValue(r.po.id)));
    }
  }
  const balance = rows.at(-1)?.balance ?? 0;
  return (
    <>
      <Link href="/admin/payables" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink print:hidden"><ArrowLeft className="h-4 w-4" /> Payables</Link>
      <PageHeader title={supplier.name} description={`Statement · ${supplier.paymentTermsDays}-day terms${supplier.phone ? ` · ${supplier.phone}` : ""}`} actions={<Pill tone={balance > 0 ? "warn" : "success"}>{balance > 0 ? `We owe ${formatPrice(balance)}` : balance < 0 ? `${formatPrice(-balance)} credit` : "Settled"}</Pill>} />
      <Card>
        {!rows.length ? <p className="p-8 text-center text-muted">No bills or payments yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[11.5px] uppercase tracking-wider text-muted"><th className="px-4 py-2.5">Date</th><th className="px-3">Entry</th><th className="px-3 text-right">Billed</th><th className="px-3 text-right">Paid</th><th className="px-3 text-right">Balance</th><th className="px-3 print:hidden" /></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const off = checks.get(r.id) ?? 0;
                  return (
                    <tr key={r.id} className={cn(r.void && "text-muted line-through decoration-muted/60")}>
                      <td className="whitespace-nowrap px-4 py-2.5">{formatDate(r.date)}</td>
                      <td className="px-3">
                        <span className="font-medium">{r.label}</span> <span className="text-muted">· {r.detail}</span>
                        {r.po && <Link href={`/admin/purchasing/${r.po.id}`} className="ml-1 text-[12px] underline">PO-{String(r.po.number).padStart(5, "0")}</Link>}
                        {r.kind === "bill" && !r.void && r.status === "PAID" && <span className="ml-2"><Pill tone="success">paid</Pill></span>}
                        {r.kind === "bill" && !r.void && r.status === "OPEN" && r.outstanding! < r.debit && <span className="ml-2"><Pill tone="warn">{formatPrice(r.outstanding!)} left</Pill></span>}
                        {off !== 0 && !r.void && <span className="mt-0.5 block text-[12px] text-warn no-underline">Goods billed {off > 0 ? "more" : "less"} than received by {formatPrice(Math.abs(off))}</span>}
                        {r.void && <span className="block text-[12px] no-underline">Void: {r.void}</span>}
                      </td>
                      <td className="px-3 text-right tabular-nums">{r.debit ? formatPrice(r.debit) : ""}</td>
                      <td className="px-3 text-right tabular-nums">{r.credit ? formatPrice(r.credit) : ""}</td>
                      <td className="px-3 text-right font-medium tabular-nums">{formatPrice(r.balance)}</td>
                      <td className="px-3 text-right print:hidden">{canVoid && !r.void && <VoidButton kind={r.kind} id={r.id} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="print:hidden"><PrintButton /></div>
    </>
  );
}
