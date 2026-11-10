import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { canActAt, scopeFor } from "@/lib/scope";
import { fmtQty, pieceCost, prdNo } from "@/lib/production";
import { billNo } from "@/lib/payables";
import { cn, formatDate, formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { ProductionActions } from "@/components/admin/production-forms";

export const metadata = { title: "Production order" };
const th = "px-4 py-2 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";

export default async function ProductionOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("production");
  const showCost = can(me.role, "finance");
  const o = await db.productionOrder.findUnique({
    where: { id: (await params).id },
    include: {
      product: { select: { id: true, name: true } }, workshop: { select: { name: true } }, store: { select: { id: true, name: true } },
      lines: { include: { variant: { select: { sku: true, color: true, size: true, position: true } } } },
      receipts: { orderBy: { createdAt: "asc" } },
      materialLogs: { orderBy: { createdAt: "asc" }, include: { material: { select: { name: true, code: true, unit: true } } } },
    },
  });
  if (!o) notFound();
  const lines = [...o.lines].sort((a, b) => a.variant.position - b.variant.position);
  const planned = lines.reduce((s, l) => s + l.planned, 0), got = lines.reduce((s, l) => s + l.received, 0), rejected = lines.reduce((s, l) => s + l.rejected, 0);
  const bills = await db.supplierBill.findMany({ where: { id: { in: o.receipts.flatMap((r) => (r.billId ? [r.billId] : [])) } }, select: { id: true, number: true, status: true } });
  const mine = canActAt(await scopeFor(me), o.storeId);
  const perPiece = pieceCost(o, planned);
  return (
    <>
      <PageHeader title={`${prdNo(o.number)} · ${o.product.name}`} description={`${o.workshop.name} · materials from and pieces into ${o.store.name}${o.dueDate ? ` · due ${formatDate(o.dueDate)}` : ""}${o.note ? ` · ${o.note}` : ""}`}
        actions={<Link href={`/admin/production/products/${o.product.id}`} className="rounded-md border border-line bg-white px-3 py-2 text-[13.5px] hover:border-ink">Bill of materials</Link>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Status", o.status === "ISSUED" ? "At the workshop" : o.status === "PARTIAL" ? "Part delivered" : o.status[0] + o.status.slice(1).toLowerCase()], ["Received", `${got} of ${planned}`], ["Rejected", `${rejected}${got + rejected ? ` (${Math.round((rejected / (got + rejected)) * 100)}%)` : ""}`],
          showCost ? ["Cost per piece", o.status === "DRAFT" ? "after issuing" : formatPrice(perPiece)] : ["Stitching", "per piece"]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-white p-4"><p className="text-[12px] uppercase tracking-wider text-muted">{k}</p><p className="mt-1 text-[20px] font-semibold">{v}</p></div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Card title="Sizes">
            <table className="w-full text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Size</th><th className={cn(th, "text-right")}>Planned</th><th className={cn(th, "text-right")}>Good</th><th className={cn(th, "text-right")}>Rejected</th></tr></thead>
              <tbody className="divide-y divide-line">{lines.map((l) => <tr key={l.id}><td className="px-4 py-2">{l.variant.color} · {l.variant.size} <span className="text-[12px] text-muted">{l.variant.sku}</span></td><td className="px-4 py-2 text-right tabular-nums">{l.planned}</td><td className="px-4 py-2 text-right tabular-nums">{l.received}</td><td className={cn("px-4 py-2 text-right tabular-nums", l.rejected > 0 && "text-warn")}>{l.rejected}</td></tr>)}</tbody>
            </table>
          </Card>
          {mine ? <ProductionActions id={o.id} status={o.status} lines={lines.map((l) => ({ variantId: l.variantId, label: `${l.variant.color} · ${l.variant.size}`, open: Math.max(0, l.planned - l.received - l.rejected) }))} />
            : <p className="text-[13px] text-muted">Only staff at {o.store.name} can issue or receive this order.</p>}
        </div>
        <div className="space-y-4">
          <Card title="Materials">
            {!o.materialLogs.length ? <p className="p-5 text-[13.5px] text-muted">{o.status === "DRAFT" ? "Nothing issued yet." : "This product has no bill of materials: nothing was issued."}</p> : (
              <ul className="divide-y divide-line text-[13.5px]">{o.materialLogs.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 px-5 py-2"><span>{m.reason === "ISSUED" ? "Issued" : "Returned"} · {m.material.name} <span className="text-muted">({m.material.code})</span></span><span className="tabular-nums">{fmtQty(Math.abs(m.delta), m.material.unit)}{showCost && m.unitCost != null ? <span className="text-muted"> · {formatPrice(Math.round((Math.abs(m.delta) * m.unitCost) / 1000))}</span> : null}</span></li>
              ))}</ul>
            )}
            {showCost && o.materialsCost > 0 && <p className="border-t border-line px-5 py-3 text-[13px] text-muted">Materials {formatPrice(o.materialsCost)} ÷ {planned} planned = {formatPrice(Math.round(o.materialsCost / planned))} a piece, plus stitching {formatPrice(o.labourPerPiece)}. Rejected pieces&apos; fabric is a loss already inside this figure.</p>}
          </Card>
          <Card title="Deliveries">
            {!o.receipts.length ? <p className="p-5 text-[13.5px] text-muted">None yet.</p> : (
              <ul className="divide-y divide-line text-[13.5px]">{o.receipts.map((r) => {
                const b = bills.find((x) => x.id === r.billId);
                return <li key={r.id} className="px-5 py-2.5"><p className="flex justify-between"><span className="font-medium">PR-{r.number} · {r.good} good{r.rejected ? `, ${r.rejected} rejected` : ""}</span><span className="text-muted">{formatDateTime(r.createdAt)}</span></p>
                  {b && <p className="text-[12.5px] text-muted">Workshop billed {formatPrice(r.labourAmount)} as <Link href="/admin/payables" className="underline">{billNo(b.number)}</Link> <Pill tone={b.status === "PAID" ? "success" : "neutral"}>{b.status.toLowerCase()}</Pill></p>}</li>;
              })}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
