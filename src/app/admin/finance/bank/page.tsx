import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconciliation } from "@/lib/bank-statements";
import { depositRef } from "@/lib/cash";
import { formatDate, formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { ResolveLine, StatementImport } from "@/components/admin/bank-forms";

export const metadata = { title: "Bank statements" };

export default async function BankPage() {
  await requirePermission("finance");
  const [r, recent] = await Promise.all([
    reconciliation(),
    db.statementLine.findMany({ where: { status: { in: ["MATCHED", "IGNORED"] } }, orderBy: { matchedAt: "desc" }, take: 20, include: { deposit: { select: { number: true, store: { select: { name: true } } } }, remittance: { select: { carrier: true, reference: true } }, payment: { select: { supplier: { select: { name: true } } } }, expense: { select: { description: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Bank statements" description="Import each account's statement (CSV from internet banking). Money in is matched to shop deposits and courier COD remittances; money out to supplier payments and expenses paid by bank. You explain the rest (or book a bank charge as an expense). Deposits the bank never shows are listed for chasing." actions={<Link href="/admin/cash" className="text-[13.5px] underline underline-offset-4">Cash</Link>} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Lines to explain", `${r.unmatched.length} (${r.unmatched.filter((l) => l.amount > 0).length} in, ${r.unmatched.filter((l) => l.amount < 0).length} out)`], ["Deposits not on the statement", String(r.notOnStatement.length)], ["COD remittances not seen", String(r.unseenRemittances.length)], ["Accounts", r.accounts.map((a) => `${a.account} to ${a.lastDate}`).join(" · ") || "none yet"]].map(([l, v]) => (
          <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className="mt-1 text-[17px] font-semibold tabular-nums">{v}</p></div></Card>
        ))}
      </div>
      <Card title="Import a statement" className="mb-4"><StatementImport accounts={r.accounts.map((a) => a.account)} /></Card>
      {r.unmatched.length > 0 && (
        <Card title={`Lines to explain · ${r.unmatched.length}`} className="mb-4">
          <ul className="divide-y divide-line">{r.unmatched.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[14px]">
              <span className="min-w-0"><b className={l.amount < 0 ? "tabular-nums text-danger" : "tabular-nums text-success"}>{l.amount < 0 ? `−${formatPrice(-l.amount)}` : `+${formatPrice(l.amount)}`}</b> · {l.account} · {formatDate(`${l.date}T12:00:00+05:45`)}<span className="block truncate text-[12.5px] text-muted">{l.description}{l.reference ? ` · ${l.reference}` : ""}</span></span>
              <ResolveLine lineId={l.id} debit={l.amount < 0} deposits={l.depositOptions} remittances={l.remittanceOptions} payments={l.paymentOptions} expenses={l.expenseOptions} />
            </li>
          ))}</ul>
        </Card>
      )}
      {(r.notOnStatement.length > 0 || r.unseenRemittances.length > 0) && (
        <Card title="The bank hasn't shown these" className="mb-4">
          <ul className="divide-y divide-line text-[14px]">
            {r.notOnStatement.map((d) => <li key={d.id} className="px-5 py-2.5"><span className="text-muted">{depositRef(d.number)}</span> {d.store} · <b>{formatPrice(d.amount)}</b> · {d.bank} slip {d.slipNo} · deposited {d.depositedOn} <span className="text-[12.5px] text-danger">· not on the statement up to {d.lastStatement}</span></li>)}
            {r.unseenRemittances.map((x) => <li key={x.id} className="px-5 py-2.5">{x.carrier} COD remittance <b>{formatPrice(x.received)}</b> ({x.reference}) · recorded {formatDate(x.createdAt)} <span className="text-[12.5px] text-danger">· not seen on any statement</span></li>)}
          </ul>
          <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">Ask the shop for the slip, or the courier for proof of transfer. If the money never arrived, mark the deposit on the Cash page as “Different” with 0: it goes back on the shop&apos;s book.</p>
        </Card>
      )}
      {recent.length > 0 && (
        <Card title="Recently matched">
          <ul className="divide-y divide-line text-[13.5px]">{recent.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 px-5 py-2"><span>{l.date} · {formatPrice(l.amount)} · {l.description}</span><span className="text-muted">{l.deposit ? `${depositRef(l.deposit.number)} ${l.deposit.store.name}` : l.remittance ? `${l.remittance.carrier} COD ${l.remittance.reference}` : l.payment ? `Payment to ${l.payment.supplier.name}` : l.expense ? `Expense: ${l.expense.description}` : l.note}</span></li>
          ))}</ul>
        </Card>
      )}
    </>
  );
}
