import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ktmDate } from "@/lib/pos";
import { commissionsFor } from "@/lib/commissions";
import { cn, formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { CommissionRuleRow } from "@/components/admin/payroll-forms";

export const metadata = { title: "Commissions" };
const th = "px-4 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePermission("payroll");
  const thisMonth = ktmDate().slice(0, 7);
  const sp = (await searchParams).month;
  const month = /^\d{4}-\d{2}$/.test(sp ?? "") && sp! <= thisMonth ? sp! : thisMonth;
  const prev = (() => { const d = new Date(`${month}-15T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const [shops, rules, rows] = await Promise.all([
    db.store.findMany({ where: { active: true, kind: "SHOP" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.commissionRule.findMany(),
    commissionsFor(month),
  ]);
  const people = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, name: true } });
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "—";
  const shop = (id: string) => shops.find((s) => s.id === id)?.name ?? "Other location";
  const rule = (storeId: string | null) => rules.find((r) => r.storeId === storeId) ?? null;
  const sorted = [...rows].sort((a, b) => b.base - a.base);
  return (
    <>
      <PageHeader title="Sales commission" description="Till staff earn a share of what they sell: a percentage of sales excluding VAT, less refunds given this month, once the shop's monthly target is reached. It's added to their payslip when the month's payroll is built." />
      <Card title="Rules" className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>Where</th><th className={th}>Rate</th><th className={th}>Monthly target, Rs. (excl. VAT)</th><th className={th} /><th className={th} /></tr></thead>
            <tbody className="divide-y divide-line">
              <CommissionRuleRow storeId={null} label="Every shop" rule={rule(null)} />
              {shops.map((s) => <CommissionRuleRow key={s.id} storeId={s.id} label={s.name} rule={rule(s.id)} />)}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">A shop&apos;s own rule wins over &quot;every shop&quot;. Leave a shop blank to use the general rule. A target of 0 pays from the first rupee.</p>
      </Card>
      <Card title={`League · ${month}`} action={<span className="flex gap-3 text-[13px]"><Link href={`/admin/payroll/commissions?month=${prev}`} className="underline">← {prev}</Link>{month < thisMonth && <Link href="/admin/payroll/commissions" className="underline">this month →</Link>}</span>}>
        {!sorted.length ? <p className="p-8 text-center text-[14px] text-muted">No till sales this month.</p> : (
          <table className="w-full text-[13.5px]">
            <thead className="border-b border-line bg-cloud/40"><tr><th className={th}>#</th><th className={th}>Person</th><th className={th}>Shop</th><th className={`${th} text-right`}>Sales</th><th className={`${th} text-right`}>Sales excl. VAT</th><th className={`${th} text-right`}>Refunds</th><th className={`${th} text-right`}>Target</th><th className={`${th} text-right`}>Commission</th></tr></thead>
            <tbody className="divide-y divide-line">{sorted.map((r, i) => (
              <tr key={`${r.userId}${r.storeId}`}><td className="px-4 py-2 text-muted">{i + 1}</td><td className="px-4 py-2 font-medium">{name(r.userId)}</td><td className="px-4 py-2">{shop(r.storeId)}</td><td className="px-4 py-2 text-right tabular-nums">{r.orders}</td><td className="px-4 py-2 text-right tabular-nums">{formatPrice(r.sales)}</td><td className="px-4 py-2 text-right tabular-nums">{r.refunds ? `−${formatPrice(r.refunds)}` : "—"}</td><td className={cn("px-4 py-2 text-right tabular-nums", r.base < r.threshold && "text-warn")}>{r.threshold ? formatPrice(r.threshold) : "—"}</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{r.commission ? formatPrice(r.commission) : "—"}{r.rateBp ? <span className="block text-[11.5px] font-normal text-muted">{r.rateBp / 100}%</span> : null}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
