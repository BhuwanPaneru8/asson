import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { scopeFor } from "@/lib/scope";
import { damageRegister, KIND_LABEL } from "@/lib/damage";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { RecordCredit, TakeOut } from "@/components/admin/damage-forms";

export const metadata = { title: "Damaged stock" };

export default async function DamagedPage() {
  const me = await requirePermission("inventory.adjust");
  const [r, suppliers] = await Promise.all([damageRegister(await scopeFor(me)), db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })]);
  const finance = can(me.role, "finance");
  return (
    <>
      <PageHeader title="Damaged stock" description="Everything that came back damaged (store returns, exchanges, parcels back from couriers) or was taken off sale by staff. It's off sale and counted here until it's repaired, written off or sent back to the supplier." />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Damaged units held", String(r.units)], ["At cost", formatPrice(r.value)], ["Came in, 90 days", String(r.flow.IN ?? 0)], ["Supplier credits owed", formatPrice(r.owedTotal)]] as const).map(([l, v]) => <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className="mt-1 text-[20px] font-semibold tabular-nums">{v}</p></div></Card>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <Card title="Held (oldest first)">
          {!r.held.length ? <p className="p-5 text-[14px] text-muted">Nothing damaged is being held.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40 text-left text-[11.5px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-2">Item</th><th className="px-3">Where</th><th className="px-3 text-right">Units</th><th className="px-3 text-right">At cost</th><th className="px-3 text-right">Days</th><th className="px-4" /></tr></thead>
              <tbody className="divide-y divide-line">{r.held.map((h) => (
                <tr key={`${h.storeId}${h.variantId}`} className="align-top">
                  <td className="min-w-[180px] px-4 py-2">{h.name} · {h.color} {h.size}<span className="block font-mono text-[11.5px] text-muted">{h.sku}</span></td>
                  <td className="px-3 py-2">{h.store}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{h.units}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{h.cost != null ? formatPrice(h.cost * h.units) : "—"}</td>
                  <td className={cn("px-3 py-2 text-right tabular-nums", h.days > 30 && "font-semibold text-warn")}>{h.days}</td>
                  <td className="min-w-[120px] px-4 py-2 text-right"><TakeOut storeId={h.storeId} variantId={h.variantId} units={h.units} unitCost={h.cost} suppliers={suppliers} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
        <div className="space-y-4">
          <Card title={`Credits owed by suppliers · ${r.owed.length}`}>
            {!r.owed.length ? <p className="p-5 text-[14px] text-muted">None waiting.</p> : (
              <ul className="divide-y divide-line text-[13.5px]">{r.owed.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"><span><b>{c.supplier?.name}</b> · {-c.quantity} × {c.variant.product.name}<span className="block text-[12px] text-muted">{c.store.name} · sent {formatDateTime(c.createdAt)} · {formatPrice(c.creditExpected ?? 0)} expected</span></span>{finance ? <RecordCredit entryId={c.id} expected={c.creditExpected ?? 0} /> : <span className="text-[12px] text-muted">finance records it</span>}</li>
              ))}</ul>
            )}
          </Card>
          <Card title="Recent">
            <ul className="divide-y divide-line text-[13px]">{r.recent.map((e) => (
              <li key={e.id} className="px-4 py-2"><span className={cn("font-medium", e.kind === "IN" ? "text-danger" : "text-success")}>{e.quantity > 0 ? `+${e.quantity}` : e.quantity}</span> {e.variant.product.name} {e.variant.size} · {e.store.name}<span className="block text-[12px] text-muted">{KIND_LABEL[e.kind]} · {e.source}{e.note ? ` · ${e.note}` : ""} · {formatDateTime(e.createdAt)}</span></li>
            ))}{!r.recent.length && <li className="px-4 py-3 text-muted">Nothing yet.</li>}</ul>
          </Card>
          <p className="px-1 text-[12px] text-muted">Damaged units have already left stock value, so writing them off changes nothing in the books. A supplier credit is money back: give the credit note to the accountant (Payables doesn&apos;t take credit notes yet). <Link href="/admin/inventory" className="underline">Inventory</Link> → adjust with &ldquo;Damaged&rdquo; to take a unit off sale.</p>
        </div>
      </div>
    </>
  );
}
