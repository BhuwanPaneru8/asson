import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { securityStatus } from "@/lib/two-factor";
import { PageHeader, Card } from "@/components/admin/ui";
import { PinForm } from "@/components/admin/pin-form";
import { SecurityPanel } from "@/components/admin/security-forms";

export const metadata = { title: "My account & security" };

export default async function MePage() {
  const me = await requireStaff();
  const [u, security] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: me.id }, select: { approvalPinHash: true } }),
    securityStatus(me.id),
  ]);
  return (
    <>
      <PageHeader title="My account & security" description="Keep your staff login safe. Everything you do in the system is recorded under your name." />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title="Two-step sign-in">
          <div className="p-6"><SecurityPanel status={{ ...security, enabledAt: security.enabledAt?.toISOString() ?? null }} /></div>
        </Card>
        {can(me, "approve.discount") && (
          <Card title="Approval PIN">
            <div className="p-6">
              <p className="mb-4 text-[13.5px] text-muted">Cashiers can give up to 5% off on their own. Above that, you approve by typing your PIN on the till. Managers approve up to 15%; the owner approves anything. Every approval is recorded with your name.</p>
              <p className="mb-4 text-[14px]">{u.approvalPinHash ? "✓ Your PIN is set. You can change it below." : "You haven't set a PIN yet."}</p>
              <PinForm />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
