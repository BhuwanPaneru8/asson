import Link from "next/link";
import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { REFUND_LABEL } from "@/lib/pos";
import { db } from "@/lib/db";
import { buildDaySummary, getDefaultStore, ktmDate, type DaySummary } from "@/lib/pos";
import { formatDate, formatDateTime, formatOrderNumber, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { LockDayForm } from "@/components/admin/lock-day-form";

export const metadata = { title: "Daily closing" };

export default async function ClosingPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const me = await requirePermission("closing");
  const showProfit = can(me.role, "finance");
  const today = ktmDate();
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const store = await getDefaultStore();
  const [locked, history] = await Promise.all([
    db.dayClose.findUnique({ where: { storeId_date: { storeId: store.id, date } } }),
    db.dayClose.findMany({ where: { storeId: store.id }, orderBy: { date: "desc" }, take: 14 }),
  ]);
  // A locked day shows the frozen snapshot, not a recalculation
  const s = (locked ? locked.summary : await buildDaySummary(store.id, date)) as unknown as DaySummary;
  const lockedBy = locked ? await db.user.findUnique({ where: { id: locked.lockedById }, select: { name: true } }) : null;

  return (
    <>
      <PageHeader
        title="Daily closing"
        description={`${store.name} · ${formatDate(`${date}T12:00:00+05:45`)}`}
        actions={
          <form className="flex gap-2">
            <input type="date" name="date" defaultValue={date} max={today} aria-label="Date" className="h-10 rounded-md border border-line bg-white px-3 text-[14px]" />
            <button className="h-10 rounded-md border border-line bg-white px-3 text-[14px] hover:border-ink">Go</button>
          </form>
        }
      />

      {locked ? (
        <p className="mb-4 flex items-center gap-2 rounded-md bg-[#e6f1ea] px-4 py-3 text-[14px] text-success"><Lock className="h-4 w-4" /> Locked by {lockedBy?.name} on {formatDateTime(locked.lockedAt)}{locked.note ? ` — “${locked.note}”` : ""}</p>
      ) : s.alerts.length ? (
        <ul className="mb-4 space-y-1.5 rounded-md bg-[#fbf1df] px-4 py-3 text-[14px] text-warn">{s.alerts.map((a) => <li key={a} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{a}</li>)}</ul>
      ) : (
        <p className="mb-4 flex items-center gap-2 rounded-md bg-[#e6f1ea] px-4 py-3 text-[14px] text-success"><CheckCircle2 className="h-4 w-4" /> No exceptions so far today.</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Store sales", formatPrice(s.store.net), `${s.store.transactions} transactions · ${s.store.units} units`],
          ["Discounts", formatPrice(s.store.discounts), `${s.discounts.length} discounted sales`],
          ["Online orders", formatPrice(s.online.total), `${s.online.orders} orders placed`],
          ["Cash expected", formatPrice(s.cash.expected), `float ${formatPrice(s.cash.floats)} + sales ${formatPrice(s.cash.sales)} − refunds ${formatPrice(s.cash.refunds ?? 0)}`],
          ["Cash difference", s.cash.counted == null ? "—" : formatPrice(s.cash.difference), s.cash.counted == null ? "count pending" : s.cash.difference === 0 ? "Balanced" : s.cash.difference > 0 ? "Over" : "Short"],
        ].map(([l, v, sub]) => (
          <Card key={l} className="p-4"><p className="text-[13px] text-muted">{l}</p><p className="mt-1 whitespace-nowrap text-[20px] font-semibold tabular-nums">{v}</p><p className="text-[12.5px] text-muted">{sub}</p></Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Payments received in store">
          <table className="w-full text-[14px]"><tbody className="divide-y divide-line">
            {s.tenders.length === 0 && <tr><td className="px-5 py-4 text-muted">No store sales.</td></tr>}
            {s.tenders.map((t) => <tr key={t.method}><td className="px-5 py-2.5">{t.label}</td><td className="px-5 text-muted">{t.count} payments</td><td className="px-5 text-right font-medium tabular-nums">{formatPrice(t.amount)}</td></tr>)}
          </tbody></table>
          <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">Check QR, card and bank totals against the eSewa / Khalti / Fonepay merchant apps and bank statement before locking.</p>
        </Card>
        <Card title="Shifts">
          <table className="w-full text-[13.5px]">
            <thead><tr className="text-left text-[11.5px] uppercase tracking-wider text-muted"><th className="px-5 py-2">Cashier</th><th>Open</th><th className="text-right">Expected</th><th className="text-right">Counted</th><th className="px-5 text-right">Diff</th></tr></thead>
            <tbody className="divide-y divide-line">
              {s.shifts.length === 0 && <tr><td colSpan={5} className="px-5 py-4 text-muted">No shifts.</td></tr>}
              {s.shifts.map((sh) => (
                <tr key={sh.id}>
                  <td className="px-5 py-2.5">{sh.cashier} {sh.status === "OPEN" && <Pill tone="warn">open</Pill>}{sh.closeNote && <p className="text-[12px] text-muted">“{sh.closeNote}”</p>}</td>
                  <td className="text-muted">{formatDateTime(sh.openedAt).split(", ").slice(-1)}</td>
                  <td className="text-right tabular-nums">{formatPrice(sh.expectedCash)}</td>
                  <td className="text-right tabular-nums">{sh.countedCash == null ? "—" : formatPrice(sh.countedCash)}</td>
                  <td className={`px-5 text-right tabular-nums ${sh.difference ? "font-semibold text-danger" : ""}`}>{sh.difference == null ? "—" : formatPrice(sh.difference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Discounts given">
          <ul className="divide-y divide-line text-[13.5px]">
            {s.discounts.length === 0 && <li className="px-5 py-4 text-muted">None.</li>}
            {s.discounts.map((d) => (
              <li key={d.orderId} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div><Link href={`/admin/orders/${d.orderId}`} className="font-medium hover:underline">{formatOrderNumber(d.number)}</Link> <span className="text-muted">· {d.reason} · by {d.cashier}{d.approver ? ` · approved by ${d.approver}` : ""}</span></div>
                <span className={`tabular-nums ${d.percent > 15 ? "font-semibold text-danger" : ""}`}>{formatPrice(d.amount)} ({d.percent}%)</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Returns & refunds">
          <ul className="divide-y divide-line text-[13.5px]">
            {!(s.returns?.length) && <li className="px-5 py-4 text-muted">None.</li>}
            {s.returns?.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 px-5 py-2.5"><span><Link href={`/admin/pos/return/${r.id}`} className="font-medium hover:underline">R{String(r.number).padStart(5, "0")}</Link> <span className="text-muted">· {r.units} item(s) · {r.reason} · {r.by} · approved by {r.approver}{r.voucher ? ` · ${r.voucher}` : ""}</span></span><span className="tabular-nums">{formatPrice(r.amount)} {REFUND_LABEL[r.method]}</span></li>
            ))}
          </ul>
        </Card>
        {showProfit && s.profit && (
          <Card title="Store gross profit (owner only)">
            <dl className="space-y-1.5 px-5 py-4 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">Net store sales</dt><dd className="tabular-nums">{formatPrice(s.profit.revenue)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Cost of goods</dt><dd className="tabular-nums">−{formatPrice(s.profit.cogs)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><dt>Gross profit</dt><dd className="tabular-nums">{formatPrice(s.profit.gross)}</dd></div>
              {s.profit.uncosted > 0 && <p className="text-[12.5px] text-warn">{s.profit.uncosted} unit(s) sold without a recorded cost.</p>}
            </dl>
          </Card>
        )}
        <Card title="Stock movements (non-sale)">
          <ul className="divide-y divide-line text-[13.5px]">
            {s.adjustments.length === 0 && <li className="px-5 py-4 text-muted">None.</li>}
            {s.adjustments.map((a, i) => (
              <li key={i} className="flex justify-between gap-3 px-5 py-2.5"><span>{a.product} <span className="font-mono text-[12px] text-muted">{a.sku}</span><span className="text-muted"> · {a.reason.replace(/_/g, " ").toLowerCase()} · {a.by}</span></span><span className={`tabular-nums ${a.delta < 0 ? "text-danger" : "text-success"}`}>{a.delta > 0 ? "+" : ""}{a.delta}</span></li>
            ))}
          </ul>
        </Card>
      </div>

      {!locked && <LockDayForm date={date} ready={s.allShiftsClosed} hasDifference={s.cash.difference !== 0} />}

      <Card title="Recent closings" className="mt-4">
        <ul className="divide-y divide-line text-[13.5px]">
          {history.length === 0 && <li className="px-5 py-4 text-muted">No days locked yet.</li>}
          {history.map((h) => {
            const hs = h.summary as unknown as DaySummary;
            return (
              <li key={h.id}><Link href={`/admin/closing?date=${h.date}`} className="flex justify-between px-5 py-2.5 hover:bg-cloud/40"><span>{formatDate(`${h.date}T12:00:00+05:45`)}</span><span className="tabular-nums">{formatPrice(hs.store.net)} · cash diff {formatPrice(hs.cash.difference)}</span></Link></li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
