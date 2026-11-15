import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { scopeFor, storeFilter } from "@/lib/scope";
import { costOf, fmtQty } from "@/lib/production";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { MaterialForm, ReceiveMaterialForm } from "@/components/admin/production-forms";

export const metadata = { title: "Fabric & trims" };
const th = "px-4 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";
const KIND = { FABRIC: "Fabric", TRIM: "Trim", PACKAGING: "Packaging" } as const;

export default async function MaterialsPage() {
  const me = await requirePermission("production");
  const showCost = can(me, "finance");
  const scope = await scopeFor(me);
  const [materials, suppliers, locations, moves] = await Promise.all([
    db.material.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }], include: { supplier: { select: { name: true } }, stock: { where: { quantity: { gt: 0 } }, include: { store: { select: { code: true } } } } } }),
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.store.findMany({ where: { active: true, ...storeFilter(scope) }, orderBy: [{ kind: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.materialLog.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { material: { select: { name: true, unit: true } }, store: { select: { code: true } } } }),
  ]);
  const total = (m: (typeof materials)[number]) => m.stock.reduce((s, x) => s + x.quantity, 0);
  return (
    <>
      <PageHeader title="Fabric & trims" description="Materials on hand at each location, at weighted-average cost. Receiving with the supplier's invoice number also records their bill." />
      <Card title={`Materials (${materials.length})`} className="mb-4">
        {!materials.length ? <p className="p-8 text-center text-[14px] text-muted">No materials yet: add your first fabric below.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13.5px]">
              <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Material</th><th className={th}>Kind</th><th className={cn(th, "text-right")}>On hand</th><th className={th}>Where</th>{showCost && <th className={cn(th, "text-right")}>Cost</th>}{showCost && <th className={cn(th, "text-right")}>Value</th>}</tr></thead>
              <tbody className="divide-y divide-line">{materials.map((m) => {
                const t = total(m);
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-2"><span className="font-medium">{m.name}</span> <span className="text-[12px] text-muted">{m.code}{m.supplier ? ` · ${m.supplier.name}` : ""}</span></td>
                    <td className="px-4 py-2">{KIND[m.kind]}</td>
                    <td className={cn("px-4 py-2 text-right tabular-nums", m.minStock > 0 && t < m.minStock && "font-medium text-warn")}>{fmtQty(t, m.unit)}</td>
                    <td className="px-4 py-2 text-[12.5px] text-muted">{m.stock.map((s) => `${s.store.code} ${(s.quantity / 1000).toLocaleString("en-IN")}`).join(" · ") || "—"}</td>
                    {showCost && <td className="px-4 py-2 text-right tabular-nums">{m.costPerUnit != null ? `${formatPrice(m.costPerUnit)}/${m.unit}` : "—"}</td>}
                    {showCost && <td className="px-4 py-2 text-right tabular-nums">{formatPrice(costOf(t, m.costPerUnit))}</td>}
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <ReceiveMaterialForm materials={materials.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit, supplierId: m.supplierId }))} locations={locations} suppliers={suppliers} />
        <MaterialForm suppliers={suppliers} />
      </div>
      {moves.length > 0 && (
        <Card title="Recent movements" className="mt-4">
          <ul className="divide-y divide-line text-[13px]">{moves.map((m) => <li key={m.id} className="flex justify-between gap-3 px-5 py-2"><span>{m.reason.toLowerCase()} · {m.material.name} · {m.store.code}{m.note ? <span className="text-muted"> · {m.note}</span> : null}</span><span className={cn("tabular-nums", m.delta < 0 ? "text-ink-soft" : "text-success")}>{m.delta > 0 ? "+" : "−"}{fmtQty(Math.abs(m.delta), m.material.unit)} <span className="text-muted">· {formatDateTime(m.createdAt)}</span></span></li>)}</ul>
        </Card>
      )}
    </>
  );
}
