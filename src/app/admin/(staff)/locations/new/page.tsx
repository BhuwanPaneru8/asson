import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { OpenShopForm } from "@/components/admin/open-shop-form";

export const metadata = { title: "Open a shop" };

export default async function OpenShopPage() {
  await requirePermission("locations");
  const [locations, staff] = await Promise.all([
    db.store.findMany({ where: { active: true }, select: { id: true, name: true, kind: true, district: true }, orderBy: [{ priority: "asc" }, { name: "asc" }] }),
    db.user.findMany({ where: { role: { in: ["CASHIER", "STAFF", "MANAGER"] } }, select: { id: true, name: true, role: true, allLocations: true, locations: { select: { store: { select: { name: true } } } } }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  const warehouses = locations.filter((l) => l.kind === "WAREHOUSE");
  return (
    <>
      <Link href="/admin/locations" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Locations</Link>
      <PageHeader title="Open a shop" description="Create the shop, assign its team and send its opening stock in one go." />
      {!warehouses.length
        ? <p className="rounded-lg border border-line bg-white p-8 text-center text-muted">Add a warehouse first: opening stock is sent from one.</p>
        : <OpenShopForm
            warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, district: w.district }))}
            shops={locations.filter((l) => l.kind === "SHOP").map((s) => ({ id: s.id, name: s.name, district: s.district }))}
            staff={staff.map((s) => ({ id: s.id, name: s.name, role: s.role, where: s.allLocations ? "all locations" : s.locations.map((l) => l.store.name).join(", ") || "not assigned" }))}
          />}
    </>
  );
}
