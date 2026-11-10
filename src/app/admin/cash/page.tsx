import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can, type Role } from "@/lib/permissions";
import { store as storeCfg } from "@/lib/config";
import { ktmDate } from "@/lib/pos";
import { scopeFor } from "@/lib/scope";
import { cashBook, cashPosition, codPosition, depositRef, depositsToCheck, KIND_LABEL } from "@/lib/cash";
import { cn, formatDate, formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { CheckDeposit, CountSafe, PettyCash, RecordDeposit } from "@/components/admin/cash-forms";

export const metadata = { title: "Cash" };
const th = "px-3 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wider text-muted whitespace-nowrap";
const money = (v: number) => (v < 0 ? `−${formatPrice(-v)}` : formatPrice(v));

export default async function CashPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const me = await requirePermission("closing");
  const scope = await scopeFor(me);
  const finance = can(me.role as Role, "finance");
  const rows = await cashPosition(scope);
  const want = (await searchParams).store;
  const here = rows.find((r) => r.storeId === want) ?? (rows.length === 1 ? rows[0] : rows.find((r) => r.kind === "SHOP"));
  const [book, toCheck, cod] = await Promise.all([here ? cashBook(me, here.storeId, 60) : Promise.resolve(null), finance ? depositsToCheck() : Promise.resolve([]), finance ? codPosition() : Promise.resolve(null)]);
  const total = rows.reduce((a, r) => a + r.balance + r.inTills, 0);
  const today = ktmDate();
  return (
    <>
      <PageHeader title="Cash" description="Every location's safe: what the cash book says it holds, what's in open tills, deposits waiting for the bank check, and what needs doing. Count the safe regularly; deposit before it passes the limit." />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Cash in the network", formatPrice(total)], ["In safes", formatPrice(rows.reduce((a, r) => a + r.balance, 0))], ["Deposits to check", `${rows.reduce((a, r) => a + r.pending, 0)} · ${formatPrice(rows.reduce((a, r) => a + r.pendingAmount, 0))}`], ["Need attention", String(rows.filter((r) => r.flags.length).length)]].map(([l, v]) => (
          <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className="mt-1 text-[20px] font-semibold tabular-nums">{v}</p></div></Card>
        ))}
      </div>
      {cod && (cod.owedTotal > 0 || cod.unseen.count > 0) && (
        <Card title="Cash on delivery (online orders)" className="mb-4" action={<span className="flex gap-3 text-[13px]"><Link href="/admin/cod" className="underline">COD remittance</Link><Link href="/admin/finance/bank" className="underline">Bank statements</Link></span>}>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <div><p className="text-[12px] text-muted">Still with couriers (delivered, not remitted)</p><p className="mt-1 text-[20px] font-semibold tabular-nums">{formatPrice(cod.owedTotal)}</p><ul className="mt-1 text-[13px] text-ink-soft">{cod.owed.map((o) => <li key={o.carrier}>{o.carrier}: {formatPrice(o.amount)} · {o.orders} order{o.orders === 1 ? "" : "s"}{o.oldest ? ` · oldest ${formatDate(o.oldest)}` : ""}</li>)}</ul></div>
            <div><p className="text-[12px] text-muted">Remitted, not yet seen on a bank statement</p><p className={cn("mt-1 text-[20px] font-semibold tabular-nums", cod.unseen.count > 0 && "text-warn")}>{formatPrice(cod.unseen.amount)}</p><p className="text-[13px] text-ink-soft">{cod.unseen.count} remittance{cod.unseen.count === 1 ? "" : "s"}</p></div>
          </div>
        </Card>
      )}
      <Card title="By location" className="mb-4">
        <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
          <thead className="border-b border-line bg-cloud/40"><tr><th className={cn(th, "text-left")}>Location</th><th className={th}>In the safe</th><th className={th}>In open tills</th><th className={th}>Last count</th><th className={th}>Last deposit</th><th className={th}>To check</th><th className={cn(th, "text-left")}>Needs doing</th></tr></thead>
          <tbody className="divide-y divide-line">{rows.map((r) => (
            <tr key={r.storeId} className={cn(here?.storeId === r.storeId && "bg-cloud/50")}>
              <td className="px-3 py-2"><Link href={`/admin/cash?store=${r.storeId}`} className="font-medium hover:underline">{r.name}</Link></td>
              <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", r.balance > storeCfg.cash.holdLimit && "text-danger")}>{r.started ? money(r.balance) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.inTills ? formatPrice(r.inTills) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.lastCountAt ? formatDate(r.lastCountAt) : "never"}{r.lastCountDiff ? <span className="block text-[12px] text-danger">{r.lastCountDiff > 0 ? "over" : "short"} {formatPrice(Math.abs(r.lastCountDiff))}</span> : null}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.lastDepositOn ? formatDate(`${r.lastDepositOn}T12:00:00+05:45`) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.pending ? `${r.pending} · ${formatPrice(r.pendingAmount)}` : "—"}</td>
              <td className="px-3 py-2 text-[12.5px]">{r.flags.length ? r.flags.map((f) => <span key={f} className="block text-danger">• {f}</span>) : <span className="text-success">OK</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {finance && toCheck.length > 0 && (
        <Card title={`Deposits to check against the bank statement · ${toCheck.length}`} className="mb-4">
          <ul className="divide-y divide-line">{toCheck.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[14px]">
              <span><span className="text-muted">{depositRef(d.number)}</span> {d.store.name} · <b className="tabular-nums">{formatPrice(d.amount)}</b> · {d.bank} slip {d.slipNo} · {formatDate(`${d.depositedOn}T12:00:00+05:45`)} · by {d.byName}{d.slipPhoto && <> · <a href={d.slipPhoto} target="_blank" rel="noreferrer" className="underline">slip photo</a></>}</span>
              {d.byId === me.id ? <span className="text-[12.5px] text-muted">you made this deposit: someone else checks it</span> : <CheckDeposit id={d.id} amount={d.amount} />}
            </li>
          ))}</ul>
        </Card>
      )}
      {here && book && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <Card title={`${here.name} · count the safe`}><CountSafe storeId={here.storeId} started={here.started} /></Card>
            {here.started && <Card title="Record a bank deposit"><RecordDeposit storeId={here.storeId} today={today} /></Card>}
            {here.started && <Card title="Spend petty cash"><PettyCash storeId={here.storeId} max={formatPrice(storeCfg.cash.pettyMax)} /></Card>}
          </div>
          <Card title={`Cash book · ${money(book.balance)}`}>
            {!book.entries.length ? <p className="p-5 text-[14px] text-muted">Nothing yet: count the safe to start the book.</p> : (
              <ul className="divide-y divide-line">{book.entries.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-2.5 text-[13.5px]">
                  <span className="min-w-0"><span className="font-medium">{KIND_LABEL[e.kind]}</span>{e.note && <span className="text-ink-soft"> · {e.note}</span>}<span className="block text-[12px] text-muted">{e.byName} · {formatDateTime(e.createdAt)}</span></span>
                  <span className="shrink-0 text-right tabular-nums"><span className={cn("font-medium", e.amount < 0 ? "text-danger" : e.amount > 0 ? "text-success" : "text-muted")}>{e.amount > 0 ? "+" : ""}{money(e.amount)}</span><span className="block text-[12px] text-muted">{money(e.balanceAfter)}</span></span>
                </li>
              ))}</ul>
            )}
            {book.deposits.length > 0 && <div className="border-t border-line p-4"><p className="mb-1 text-[12px] font-medium uppercase tracking-wider text-muted">Deposits</p><ul className="space-y-1 text-[13px]">{book.deposits.map((d) => <li key={d.id} className="flex justify-between gap-2"><span>{depositRef(d.number)} · {d.bank} {d.slipNo} · {formatPrice(d.amount)}</span><Pill tone={d.status === "VERIFIED" ? "success" : d.status === "DISPUTED" ? "danger" : "warn"}>{d.status === "RECORDED" ? "to check" : d.status === "VERIFIED" ? "on statement" : `bank ${formatPrice(d.bankAmount ?? 0)}`}</Pill></li>)}</ul></div>}
          </Card>
        </div>
      )}
    </>
  );
}
