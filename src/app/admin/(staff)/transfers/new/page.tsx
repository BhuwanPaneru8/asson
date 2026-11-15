import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getLocations } from "@/lib/stock";
import { scopeFor, canActAt } from "@/lib/scope";
import { PageHeader } from "@/components/admin/ui";
import { TransferForm } from "@/components/admin/transfer-form";

export const metadata = { title: "New transfer" };

export default async function NewTransferPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const me = await requirePermission("transfers");
  const sp = await searchParams;
  const locations = await getLocations();
  const ids = locations.map((l) => l.id);
  // send only from a location you work at; send to anywhere
  const scope = await scopeFor(me);
  const sources = locations.filter((l) => canActAt(scope, l.id));
  const sourceIds = sources.map((l) => l.id);
  const from = sourceIds.includes(sp.from ?? "") ? sp.from! : sources.find((l) => l.kind === "WAREHOUSE")?.id ?? sourceIds[0] ?? "";
  const to = ids.includes(sp.to ?? "") && sp.to !== from ? sp.to! : ids.find((id) => id !== from) ?? "";
  return (
    <>
      <Link href="/admin/transfers" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Transfers</Link>
      <PageHeader title="New transfer" description="Pick the route, scan what goes in the box, then send. Stock leaves the source as soon as it's sent." />
      {!sources.length
        ? <p className="rounded-lg border border-line bg-white p-8 text-center text-muted">You can send stock only from a location you work at, and you&apos;re not assigned to one yet. Ask the owner to add you under Customers &amp; team.</p>
        : locations.length < 2
        ? <p className="rounded-lg border border-line bg-white p-8 text-center text-muted">You need at least two active locations. The owner can add a shop or warehouse under Locations.</p>
        : <TransferForm locations={locations.map((l) => ({ id: l.id, name: l.name }))} sources={sources.map((l) => ({ id: l.id, name: l.name }))} defaultFrom={from} defaultTo={to} />}
    </>
  );
}
