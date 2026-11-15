import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/admin/ui";
import { PayTermsRow } from "@/components/admin/payroll-forms";

export const metadata = { title: "Pay terms" };
const th = "px-2 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";

export default async function PayTermsPage() {
  await requirePermission("payroll");
  const staff = await db.user.findMany({ where: { role: { not: "CUSTOMER" } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true, employment: true } });
  return (
    <>
      <PageHeader title="Pay terms" description="Monthly basic salary and fixed allowances in rupees. SSF is 11% (employee) and 20% (employer) of basic. Married couples use their own tax bands." />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={`${th} pl-4`}>Person</th><th className={th}>Basic / month</th><th className={th}>Allowance</th><th className={th}>Status</th><th className={th}>PAN · bank</th><th className={th} /><th className={th} /></tr></thead>
            <tbody className="divide-y divide-line">{staff.map((s) => (
              <PayTermsRow key={s.id} userId={s.id} name={s.name} role={ROLE_LABEL[s.role]} terms={s.employment ? { basic: s.employment.basic, allowance: s.employment.allowance, inSsf: s.employment.inSsf, married: s.employment.married, active: s.employment.active, pan: s.employment.pan ?? "", bankAccount: s.employment.bankAccount ?? "", joinedOn: s.employment.joinedOn ?? "" } : null} />
            ))}</tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
