import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { SupplierManager } from "@/components/admin/supplier-manager";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  await requirePermission("purchasing");
  const suppliers = await db.supplier.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { orders: { where: { status: { not: "CANCELLED" } }, include: { items: true } } } });
  const rows = suppliers.map((s) => {
    const units = s.orders.flatMap((o) => o.items).reduce((a, i) => a + i.quantityReceived, 0);
    const damaged = s.orders.flatMap((o) => o.items).reduce((a, i) => a + i.quantityDamaged, 0);
    const spend = s.orders.flatMap((o) => o.items).reduce((a, i) => a + i.quantityReceived * i.unitCost, 0);
    return {
      id: s.id, name: s.name, contact: s.contact ?? "", phone: s.phone ?? "", email: s.email ?? "", location: s.location ?? "", country: s.country, notes: s.notes ?? "", active: s.active,
      orders: s.orders.length, spend: formatPrice(spend), units, damageRate: units + damaged ? Math.round((damaged / (units + damaged)) * 1000) / 10 : 0,
    };
  });
  return (
    <>
      <PageHeader title="Suppliers" description="Who you buy from, what you've spent, and how much arrives damaged — a simple supplier scorecard." />
      <Card><SupplierManager rows={rows} /></Card>
    </>
  );
}
