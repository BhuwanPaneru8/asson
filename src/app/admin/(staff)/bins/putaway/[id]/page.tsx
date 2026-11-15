import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { canActAt, scopeFor } from "@/lib/scope";
import { putawayList } from "@/lib/bins";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Putaway" };

export default async function PutawayPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("stock.count");
  const { id } = await params;
  const r = await db.goodsReceipt.findUnique({ where: { id }, select: { number: true, storeId: true, store: { select: { name: true } }, purchaseOrderId: true } });
  if (!r?.storeId || !canActAt(await scopeFor(me), r.storeId)) notFound();
  const p = (await putawayList(id))!;
  const missing = p.lines.filter((l) => !l.bin).length;
  return (
    <>
      <PageHeader title={`Putaway · receipt ${r.number} · ${r.store!.name}`} description="Where each received item goes, in walking order." actions={<span className="flex gap-3 text-[13.5px]"><Link href={`/admin/purchasing/${r.purchaseOrderId}`} className="underline underline-offset-4">Purchase order</Link><Link href={`/admin/bins?store=${r.storeId}`} className="underline underline-offset-4">Bins</Link></span>} />
      {missing > 0 && <p className="mb-4 rounded-md bg-[#fbf1df] px-4 py-3 text-[14px] text-warn">{missing} item(s) have no bin at {r.store!.name} yet: put them away and scan them into their bin on the Bins page.</p>}
      <Card>
        <table className="w-full text-[14px]">
          <thead className="border-b border-line bg-cloud/40 text-left text-[11.5px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-2">Bin</th><th className="px-3">SKU</th><th className="px-3">Item</th><th className="px-4 text-right">Qty</th></tr></thead>
          <tbody className="divide-y divide-line">{p.lines.map((l) => (
            <tr key={l.sku}><td className="px-4 py-2 font-mono font-semibold">{l.bin?.code ?? <span className="font-sans text-[12.5px] font-normal text-warn">no bin</span>}</td><td className="px-3 font-mono text-[12.5px]">{l.sku}</td><td className="px-3">{l.name} · {l.color} <b>{l.size}</b></td><td className="px-4 text-right tabular-nums">{l.quantity}</td></tr>
          ))}</tbody>
        </table>
      </Card>
    </>
  );
}
