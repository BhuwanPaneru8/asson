import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { store } from "@/lib/config";
import { replenishmentPlan, visibleRoutes } from "@/lib/replenishment";
import { canActAt, scopeFor } from "@/lib/scope";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { DraftRouteButton } from "@/components/admin/replenishment-actions";

export const metadata = { title: "Replenishment" };

export default async function ReplenishmentPage() {
  const me = await requirePermission("transfers");
  const scope = await scopeFor(me);
  const routes = visibleRoutes(await replenishmentPlan(), scope);
  const mine = routes.filter((r) => canActAt(scope, r.fromId));
  const cfg = store.replenishment;
  return (
    <>
      <PageHeader
        title="Replenishment"
        description={`What each shop needs to cover ${cfg.shopCoverDays} days of its own sales (and at least ${cfg.minDisplay} of every size it sells), sent from the nearest warehouse, or moved from a shop where it hasn't sold for ${cfg.rebalanceAfterDays} days. Drafts and transfers on their way are already counted.`}
        actions={mine.length > 1 ? <DraftRouteButton primary routes={mine.map((r) => ({ fromId: r.fromId, toId: r.toId }))} label={`Draft all ${mine.length} transfers`} /> : undefined}
      />
      <p className="mb-4 text-[13px] text-muted">{cfg.autoDraft ? "Automatic: these are drafted every night; you only pack and send." : "Automatic drafting is off: draft the routes you want below (the owner can switch on nightly drafting)."}</p>
      {!routes.length ? <p className="rounded-lg border border-line bg-white p-10 text-center text-muted">Every shop has what it needs. 👌</p> : (
        <div className="space-y-4">
          {routes.map((r) => (
            <Card key={`${r.fromId}>${r.toId}`} title={`${r.fromName} → ${r.toName} · ${r.units} unit${r.units === 1 ? "" : "s"}`} action={canActAt(scope, r.fromId) ? <DraftRouteButton routes={[{ fromId: r.fromId, toId: r.toId }]} label="Draft transfer" /> : <span className="text-[12.5px] text-muted">{r.fromName} drafts this</span>}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead className="border-b border-line bg-cloud/40"><tr className="text-left text-[11.5px] uppercase tracking-wider text-muted"><th className="px-4 py-2">Item</th><th className="px-3 text-right">Send</th><th className="px-3">Why</th><th className="px-3 text-right">Lasts at {r.toName}</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {r.lines.map((l) => (
                      <tr key={l.variantId}>
                        <td className="px-4 py-2">{l.name} · {l.color} <b>{l.size}</b> <span className="font-mono text-[11.5px] text-muted">{l.sku}</span></td>
                        <td className="px-3 text-right font-semibold tabular-nums">{l.quantity}</td>
                        <td className="px-3">{l.reason === "warehouse" ? <Pill>restock</Pill> : <Pill tone="warn">not selling at {r.fromName}</Pill>}</td>
                        <td className="px-3 text-right tabular-nums">{l.coverDays == null ? "—" : l.coverDays === 0 ? <span className="text-danger">out now</span> : `${l.coverDays} days`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="mt-4 text-[12.5px] text-muted">Drafted transfers appear under <Link href="/admin/transfers?status=DRAFT" className="underline">Transfers</Link>; the sending location packs and sends them.</p>
    </>
  );
}
