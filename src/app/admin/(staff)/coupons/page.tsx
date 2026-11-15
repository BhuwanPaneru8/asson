import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill, Td, Th } from "@/components/admin/ui";
import { CouponForm, CouponHomeToggle, CouponToggle } from "@/components/admin/coupon-form";

export const metadata = { title: "Coupons" };

export default async function Coupons() {
  await requireAdmin();
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();
  return (
    <>
      <PageHeader title="Coupons" description="Codes are validated on the server at checkout — limits, dates and minimums are enforced atomically." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead className="border-b border-line bg-cloud/40"><tr><Th>Code</Th><Th>Offer</Th><Th>Min. order</Th><Th className="text-right">Used</Th><Th>Ends</Th><Th>Status</Th></tr></thead>
              <tbody className="divide-y divide-line">
                {coupons.map((c) => {
                  const expired = c.endsAt && c.endsAt < now;
                  return (
                    <tr key={c.id}>
                      <Td><p className="font-mono font-semibold">{c.code}{c.showOnHome && <span className="ml-2"><Pill tone="success">on home page</Pill></span>}</p>{c.description && <p className="text-[12.5px] text-muted">{c.description}</p>}</Td>
                      <Td>{c.isCredit ? `Store credit · balance ${formatPrice(c.value)}` : c.type === "PERCENT" ? `${c.value}% off${c.maxDiscount ? ` (max ${formatPrice(c.maxDiscount)})` : ""}` : c.type === "FIXED" ? `${formatPrice(c.value)} off` : "Free shipping"}</Td>
                      <Td>{c.minSubtotal ? formatPrice(c.minSubtotal) : "—"}</Td>
                      <Td className="text-right tabular-nums">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</Td>
                      <Td className="whitespace-nowrap text-muted">{c.endsAt ? formatDate(c.endsAt) : "No end"}</Td>
                      <Td><div className="flex items-center gap-2">{expired ? <Pill tone="warn">expired</Pill> : <Pill tone={c.active ? "success" : "neutral"}>{c.active ? "active" : "paused"}</Pill>}<CouponToggle id={c.id} active={c.active} />{!c.isCredit && <CouponHomeToggle id={c.id} on={c.showOnHome} />}</div></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Create coupon"><CouponForm /></Card>
      </div>
    </>
  );
}
