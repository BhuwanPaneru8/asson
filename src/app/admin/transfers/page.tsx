import Link from "next/link";
import { Plus } from "lucide-react";
import type { TransferStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn, formatDateTime } from "@/lib/utils";
import { TRANSFER_STATUS_LABEL, transferNo } from "@/lib/transfers";
import { AdminPager, Card, PageHeader, Pill } from "@/components/admin/ui";

export const metadata = { title: "Stock transfers" };
const TAKE = 50;
const TONE = { DRAFT: "neutral", SENT: "warn", RECEIVED: "success", CANCELLED: "neutral" } as const;

export default async function TransfersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requirePermission("transfers");
  const sp = await searchParams;
  const status = (["DRAFT", "SENT", "RECEIVED", "CANCELLED"] as const).find((s) => s === sp.status) as TransferStatus | undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = status ? { status } : {};
  const [rows, total, counts] = await Promise.all([
    db.stockTransfer.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * TAKE, take: TAKE,
      include: { from: { select: { name: true } }, to: { select: { name: true } }, items: { select: { quantity: true, received: true } } },
    }),
    db.stockTransfer.count({ where }),
    db.stockTransfer.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const n = (s: TransferStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const tab = (s: TransferStatus | undefined, label: string) => (
    <Link href={`/admin/transfers${s ? `?status=${s}` : ""}`} className={cn("rounded-md px-3 py-1.5 text-[13.5px]", status === s ? "bg-ink text-white" : "border border-line bg-white hover:border-ink")}>{label}{s && ` (${n(s)})`}</Link>
  );
  return (
    <>
      <PageHeader
        title="Stock transfers"
        description="Move stock between the warehouse and shops. Units leave when sent and only arrive as counted at the other end."
        actions={<Link href="/admin/transfers/new" className="flex h-10 items-center gap-1.5 rounded-md bg-ink px-4 text-[14px] text-white"><Plus className="h-4 w-4" /> New transfer</Link>}
      />
      <div className="mb-4 flex flex-wrap gap-2">{tab(undefined, "All")}{tab("DRAFT", "Drafts")}{tab("SENT", "In transit")}{tab("RECEIVED", "Received")}{tab("CANCELLED", "Cancelled")}</div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[12px] uppercase tracking-wider text-muted"><th className="px-4 py-2.5">Transfer</th><th className="px-3">Route</th><th className="px-3 text-right">Units</th><th className="px-3">Status</th><th className="px-3">Updated</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((t) => {
                const units = t.items.reduce((s, i) => s + i.quantity, 0);
                const short = t.status === "RECEIVED" ? units - t.items.reduce((s, i) => s + (i.received ?? i.quantity), 0) : 0;
                return (
                  <tr key={t.id} className="hover:bg-cloud/40">
                    <td className="px-4 py-2.5"><Link href={`/admin/transfers/${t.id}`} className="font-mono font-medium underline">{transferNo(t.number)}</Link></td>
                    <td className="px-3">{t.from.name} → {t.to.name}</td>
                    <td className="px-3 text-right tabular-nums">{units}{short > 0 && <span className="ml-1 text-danger">(−{short})</span>}</td>
                    <td className="px-3"><Pill tone={short > 0 ? "danger" : TONE[t.status]}>{TRANSFER_STATUS_LABEL[t.status]}{short > 0 ? " · short" : ""}</Pill></td>
                    <td className="px-3 text-muted">{formatDateTime(t.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <p className="p-10 text-center text-muted">No transfers yet. Use “New transfer” to send stock from the warehouse to a shop.</p>}
        </div>
        <AdminPager page={page} pages={Math.max(1, Math.ceil(total / TAKE))} href={(p) => `/admin/transfers?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`} />
      </Card>
    </>
  );
}
