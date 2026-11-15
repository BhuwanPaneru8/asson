import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { stockByLocation } from "@/lib/stock";
import { TRANSFER_STATUS_LABEL, transferNo } from "@/lib/transfers";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { TransferActions } from "@/components/admin/transfer-actions";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Transfer" };

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("transfers");
  const t = await db.stockTransfer.findUnique({
    where: { id: (await params).id },
    include: {
      from: { select: { id: true, name: true, address: true } }, to: { select: { id: true, name: true, address: true } },
      items: { include: { variant: { select: { sku: true, color: true, size: true, product: { select: { name: true } } } } }, orderBy: { variant: { sku: "asc" } } },
    },
  });
  if (!t) notFound();
  const people = await db.user.findMany({ where: { id: { in: [t.createdById, t.sentById, t.receivedById].filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const who = (id: string | null) => people.find((p) => p.id === id)?.name ?? "—";
  const at = t.status === "DRAFT" ? await stockByLocation(t.items.map((i) => i.variantId)) : null;
  const units = t.items.reduce((s, i) => s + i.quantity, 0);
  const tone = t.status === "RECEIVED" ? "success" : t.status === "SENT" ? "warn" : "neutral";

  return (
    <>
      <Link href="/admin/transfers" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink print:hidden"><ArrowLeft className="h-4 w-4" /> Transfers</Link>
      <PageHeader title={`${transferNo(t.number)} · ${t.from.name} → ${t.to.name}`} description={`${units} unit${units === 1 ? "" : "s"} across ${t.items.length} item${t.items.length === 1 ? "" : "s"}`} actions={<Pill tone={tone}>{TRANSFER_STATUS_LABEL[t.status]}</Pill>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[12px] uppercase tracking-wider text-muted"><th className="px-4 py-2.5">SKU</th><th className="px-3">Item</th>{at && <th className="px-3 text-right">At {t.from.name}</th>}<th className="px-3 text-right">Sent</th>{t.status === "RECEIVED" && <th className="px-3 text-right">Received</th>}</tr></thead>
              <tbody className="divide-y divide-line">
                {t.items.map((i) => {
                  const have = at?.get(i.variantId)?.get(t.fromId) ?? 0;
                  return (
                    <tr key={i.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12.5px]">{i.variant.sku}</td>
                      <td className="px-3">{i.variant.product.name} · {i.variant.color} {i.variant.size}</td>
                      {at && <td className={`px-3 text-right tabular-nums ${have < i.quantity ? "font-semibold text-danger" : ""}`}>{have}</td>}
                      <td className="px-3 text-right tabular-nums">{i.quantity}</td>
                      {t.status === "RECEIVED" && <td className={`px-3 text-right tabular-nums ${(i.received ?? 0) < i.quantity ? "font-semibold text-danger" : ""}`}>{i.received}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Timeline">
            <dl className="space-y-2 p-4 text-[13.5px]">
              <div><dt className="text-muted">Drafted</dt><dd>{who(t.createdById)} · {formatDateTime(t.createdAt)}</dd></div>
              {t.sentAt && <div><dt className="text-muted">Sent</dt><dd>{who(t.sentById)} · {formatDateTime(t.sentAt)}</dd></div>}
              {t.receivedAt && <div><dt className="text-muted">Received</dt><dd>{who(t.receivedById)} · {formatDateTime(t.receivedAt)}</dd></div>}
              {t.note && <div><dt className="text-muted">Notes</dt><dd className="whitespace-pre-line">{t.note}</dd></div>}
            </dl>
          </Card>
          <div className="print:hidden">
            <TransferActions id={t.id} status={t.status} to={t.to.name} items={t.items.map((i) => ({ id: i.id, sku: i.variant.sku, label: `${i.variant.product.name} · ${i.variant.color} ${i.variant.size}`, quantity: i.quantity }))} />
          </div>
          {t.status !== "CANCELLED" && <PrintButton />}
        </div>
      </div>
    </>
  );
}
