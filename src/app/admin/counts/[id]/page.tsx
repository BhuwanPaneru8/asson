import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { scopeFor, canActAt } from "@/lib/scope";
import { countNo, variance } from "@/lib/counts";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { CountSheet } from "@/components/admin/count-sheet";
import { CountReview } from "@/components/admin/count-review";

export const metadata = { title: "Stock count" };

export default async function CountPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("stock.count");
  const c = await db.stockCount.findUnique({
    where: { id: (await params).id },
    include: {
      store: { select: { name: true } },
      lines: { include: { variant: { select: { sku: true, color: true, size: true, costPrice: true, product: { select: { name: true } } } } }, orderBy: [{ variant: { product: { name: "asc" } } }, { variant: { position: "asc" } }] },
    },
  });
  if (!c) notFound();
  if (!canActAt(await scopeFor(me), c.storeId)) notFound(); // counts belong to the people who work there
  const people = await db.user.findMany({ where: { id: { in: [c.createdById, c.submittedById, c.approvedById].filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const who = (id: string | null) => people.find((p) => p.id === id)?.name ?? "—";
  const title = `${countNo(c.number)} · ${c.store.name} · ${c.scopeLabel}`;
  const back = <Link href="/admin/counts" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Stock counts</Link>;

  if (c.status === "COUNTING") {
    return (
      <>
        {back}
        <PageHeader title={title} description={`Started by ${who(c.createdById)} · ${formatDateTime(c.createdAt)}. Count each item in one go; the shop can keep selling.`} />
        <CountSheet countId={c.id} lines={c.lines.map((l) => ({ variantId: l.variantId, sku: l.variant.sku, name: l.variant.product.name, color: l.variant.color, size: l.variant.size, counted: l.counted }))} />
      </>
    );
  }

  // review: system figures appear only now, and only to people who could adjust stock
  const reviewer = can(me.role, "inventory.adjust");
  const showCost = can(me.role, "finance");
  const counted = c.lines.filter((l) => l.counted != null);
  const diffs = counted.filter((l) => variance(l) !== 0).sort((a, b) => Math.abs(variance(b)) - Math.abs(variance(a)));
  const plus = diffs.reduce((s, l) => s + Math.max(0, variance(l)), 0);
  const minus = diffs.reduce((s, l) => s + Math.max(0, -variance(l)), 0);
  const value = diffs.reduce((s, l) => s + variance(l) * (l.variant.costPrice ?? 0), 0);
  const tone = c.status === "APPROVED" ? "success" : c.status === "CANCELLED" ? "neutral" : "warn";

  return (
    <>
      {back}
      <PageHeader title={title} description={`${counted.length} of ${c.lines.length} items counted · submitted by ${who(c.submittedById)}${c.submittedAt ? ` · ${formatDateTime(c.submittedAt)}` : ""}${c.approvedAt ? ` · approved by ${who(c.approvedById)} ${formatDateTime(c.approvedAt)}` : ""}`} actions={<Pill tone={tone}>{c.status === "SUBMITTED" ? "Waiting for approval" : c.status === "APPROVED" ? "Approved" : "Cancelled"}</Pill>} />
      {!reviewer ? (
        <p className="rounded-lg border border-line bg-white p-6 text-[14px] text-muted">Thanks, this count is with a manager.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card title={diffs.length ? `${diffs.length} differences · +${plus} / −${minus} units${showCost ? ` · ${formatPrice(value)} at cost` : ""}` : "No differences"}>
            {!diffs.length ? <p className="p-8 text-center text-[14px] text-muted">Everything counted matches the system. 👏</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[12px] uppercase tracking-wider text-muted"><th className="px-4 py-2.5">Item</th><th className="px-3 text-right">System</th><th className="px-3 text-right">Counted</th><th className="px-3 text-right">Difference</th>{showCost && <th className="px-3 text-right">At cost</th>}</tr></thead>
                  <tbody className="divide-y divide-line">
                    {diffs.map((l) => {
                      const v = variance(l);
                      return (
                        <tr key={l.id}>
                          <td className="px-4 py-2">{l.variant.product.name} · {l.variant.color} {l.variant.size}{l.added && <Pill>found</Pill>}<span className="block font-mono text-[11.5px] text-muted">{l.variant.sku}</span></td>
                          <td className="px-3 text-right tabular-nums">{l.systemAt ?? 0}</td>
                          <td className="px-3 text-right tabular-nums">{l.counted}</td>
                          <td className={cn("px-3 text-right font-semibold tabular-nums", v < 0 ? "text-danger" : "text-success")}>{v > 0 ? `+${v}` : v}</td>
                          {showCost && <td className="px-3 text-right tabular-nums">{l.variant.costPrice != null ? formatPrice(v * l.variant.costPrice) : "—"}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <div className="space-y-3">
            {c.status === "SUBMITTED" && <CountReview countId={c.id} canApprove changes={diffs.length} />}
            {c.note && <p className="whitespace-pre-line rounded-lg border border-line bg-white p-4 text-[13.5px] text-muted">{c.note}</p>}
            <p className="text-[12.5px] text-muted">Differences are worked out against the system figure at the moment each item was counted, so sales during the count don&apos;t show up as losses. Items not counted stay as they are.</p>
          </div>
        </div>
      )}
    </>
  );
}
