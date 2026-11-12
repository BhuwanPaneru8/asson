import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ktmDate } from "@/lib/pos";
import { AGING_BUCKETS, billNo, payablesSummary, todayStart } from "@/lib/payables";
import { cn, formatDate, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { RecordBill, RecordCredit, RecordPayment } from "@/components/admin/payables-forms";

export const metadata = { title: "Payables" };

export default async function PayablesPage() {
  const me = await requirePermission("purchasing");
  const canPay = can(me.role, "finance");
  const today = ktmDate();
  const [s, suppliers, pos] = await Promise.all([
    payablesSummary(),
    db.supplier.findMany({ where: { active: true }, select: { id: true, name: true, paymentTermsDays: true }, orderBy: { name: "asc" } }),
    db.purchaseOrder.findMany({ where: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"] } }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, number: true, supplierId: true, items: { select: { quantityReceived: true, unitCost: true } } } }),
  ]);
  // damaged goods sent back and still waiting for the supplier's credit
  const waiting = canPay ? await db.damageEntry.findMany({ where: { kind: "TO_SUPPLIER", creditAt: null }, orderBy: { createdAt: "asc" }, take: 200, select: { id: true, supplierId: true, quantity: true, creditExpected: true, createdAt: true, variant: { select: { sku: true, product: { select: { name: true } } } } } }) : [];
  const start = todayStart();
  const tile = (l: string, v: string, sub: string, bad = false) => (
    <div className={cn("rounded-lg border bg-white p-4", bad ? "border-danger/40" : "border-line")}><p className="text-[12px] uppercase tracking-wider text-muted">{l}</p><p className={cn("mt-1 text-[22px] font-semibold", bad && "text-danger")}>{v}</p><p className="text-[12.5px] text-muted">{sub}</p></div>
  );
  return (
    <>
      <PageHeader title="Payables" description="What you owe suppliers and when. Bills are recorded as they arrive; payments are allocated to the oldest bills first, and anything extra is kept as credit." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tile("You owe", formatPrice(s.owed), `${s.open.length} open bill${s.open.length === 1 ? "" : "s"}`)}
        {tile("Overdue", formatPrice(s.overdue), s.overdueCount ? `${s.overdueCount} bill${s.overdueCount === 1 ? "" : "s"} past due` : "nothing late", s.overdue > 0)}
        {tile("Due in 7 days", formatPrice(s.dueThisWeek), "plan the cash")}
        {tile("Supplier credit", formatPrice(s.credit), "paid in advance or credit notes")}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <Card title="By supplier">
            {!s.suppliers.length ? <p className="p-8 text-center text-muted">Nothing owed. 🎉</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[11.5px] uppercase tracking-wider text-muted"><th className="px-4 py-2.5">Supplier</th>{AGING_BUCKETS.map((b) => <th key={b.key} className="px-3 text-right">{b.label}</th>)}<th className="px-4 text-right">Total</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {s.suppliers.map((x) => (
                      <tr key={x.id}>
                        <td className="px-4 py-2.5"><Link href={`/admin/payables/${x.id}`} className="font-medium underline">{x.name}</Link>{x.credit > 0 && <span className="ml-2 text-[12px] text-success">{formatPrice(x.credit)} credit</span>}</td>
                        {AGING_BUCKETS.map((b) => <td key={b.key} className={cn("px-3 text-right tabular-nums", b.key !== "current" && x.buckets[b.key] > 0 && "text-danger")}>{x.buckets[b.key] ? formatPrice(x.buckets[b.key]) : "—"}</td>)}
                        <td className="px-4 text-right font-semibold tabular-nums">{formatPrice(x.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Open bills">
            {!s.open.length ? <p className="p-8 text-center text-muted">No open bills.</p> : (
              <ul className="divide-y divide-line">
                {s.open.map((b) => {
                  const late = b.dueDate < start;
                  return (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13.5px]">
                      <div><Link href={`/admin/payables/${b.supplier.id}`} className="font-medium hover:underline">{b.supplier.name}</Link> · {billNo(b.number)} <span className="text-muted">· invoice {b.reference}</span></div>
                      <div className="flex items-center gap-3">
                        <Pill tone={late ? "danger" : "neutral"}>{late ? `${b.daysLate} day${b.daysLate === 1 ? "" : "s"} late` : `due ${formatDate(b.dueDate)}`}</Pill>
                        <span className="tabular-nums">{b.paid ? <span className="text-muted">{formatPrice(b.paid)} paid · </span> : null}<b>{formatPrice(b.outstanding)}</b></span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Record a bill"><RecordBill today={today} suppliers={suppliers.map((x) => ({ id: x.id, name: x.name, terms: x.paymentTermsDays }))} pos={pos.map((p) => ({ id: p.id, supplierId: p.supplierId, label: `PO-${String(p.number).padStart(5, "0")}`, received: p.items.reduce((a, i) => a + i.quantityReceived * i.unitCost, 0) }))} /></Card>
          {canPay
            ? <Card title="Record a payment"><RecordPayment today={today} suppliers={suppliers.map((x) => ({ id: x.id, name: x.name, terms: x.paymentTermsDays }))} bills={s.open.map((b) => ({ id: b.id, supplierId: b.supplier.id, label: `${billNo(b.number)} (${b.reference})`, outstanding: b.outstanding, due: b.dueDate.toISOString().slice(0, 10) }))} /></Card>
            : <p className="rounded-lg border border-line bg-white p-4 text-[13.5px] text-muted">Payments are recorded by the owner.</p>}
          {canPay && <Card title="Record a credit note"><RecordCredit today={today} suppliers={suppliers.map((x) => ({ id: x.id, name: x.name, terms: x.paymentTermsDays }))} bills={s.open.map((b) => ({ id: b.id, supplierId: b.supplier.id, label: `${billNo(b.number)} (${b.reference})`, outstanding: b.outstanding, due: b.dueDate.toISOString().slice(0, 10) }))} damaged={waiting.map((d) => ({ id: d.id, supplierId: d.supplierId!, label: `${-d.quantity} × ${d.variant.product.name} (${d.variant.sku}), sent ${d.createdAt.toISOString().slice(0, 10)}`, expected: d.creditExpected ?? 0 }))} /></Card>}
        </div>
      </div>
    </>
  );
}
