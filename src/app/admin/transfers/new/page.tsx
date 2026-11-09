import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getLocations } from "@/lib/stock";
import { PageHeader } from "@/components/admin/ui";
import { TransferForm } from "@/components/admin/transfer-form";

export const metadata = { title: "New transfer" };

export default async function NewTransferPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePermission("transfers");
  const sp = await searchParams;
  const locations = await getLocations();
  const ids = locations.map((l) => l.id);
  // default route: warehouse → first shop
  const from = ids.includes(sp.from ?? "") ? sp.from! : locations.find((l) => l.kind === "WAREHOUSE")?.id ?? ids[0];
  const to = ids.includes(sp.to ?? "") && sp.to !== from ? sp.to! : ids.find((id) => id !== from) ?? "";
  return (
    <>
      <Link href="/admin/transfers" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Transfers</Link>
      <PageHeader title="New transfer" description="Pick the route, scan what goes in the box, then send. Stock leaves the source as soon as it's sent." />
      {locations.length < 2
        ? <p className="rounded-lg border border-line bg-white p-8 text-center text-muted">You need at least two active locations. The owner can add a shop or warehouse under Locations.</p>
        : <TransferForm locations={locations.map((l) => ({ id: l.id, name: l.name }))} defaultFrom={from} defaultTo={to} />}
    </>
  );
}
