import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/admin/ui";
import { PinForm } from "@/components/admin/pin-form";

export const metadata = { title: "Approval PIN" };

export default async function MePage() {
  const me = await requirePermission("approve.discount");
  const u = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { approvalPinHash: true } });
  return (
    <>
      <PageHeader title="Approval PIN" description="Cashiers can give up to 5% off on their own. Above that, you approve by typing your PIN on the till. Managers approve up to 15%; the owner approves anything. Every approval is recorded with your name." />
      <Card className="max-w-md p-6">
        <p className="mb-4 text-[14px]">{u.approvalPinHash ? "✓ Your PIN is set. You can change it below." : "You haven't set a PIN yet."}</p>
        <PinForm />
      </Card>
    </>
  );
}
