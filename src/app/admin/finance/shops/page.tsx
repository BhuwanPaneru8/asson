import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { ktmDate } from "@/lib/pos";
import { shopPl, type PlRow } from "@/lib/shop-pl";
import { cn, formatPrice } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Profit by shop" };
const th = "px-3 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-wider text-muted whitespace-nowrap";
const money = (v: number) => (v < 0 ? `−${formatPrice(-v)}` : formatPrice(v));

function Row({ x, muted }: { x: PlRow; muted?: boolean }) {
  return (
    <tr className={cn(muted && "bg-cloud/40 text-ink-soft")}>
      <td className="px-3 py-2 text-left"><span className="font-medium">{x.name}</span>{x.kind === "WAREHOUSE" && <span className="block text-[12px] text-muted">warehouse (online orders)</span>}</td>
      <td className="px-3 py-2 text-right tabular-nums">{money(x.netSales)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{money(x.grossProfit)}{x.grossMargin !== null && <span className="block text-[12px] text-muted">{x.grossMargin}%</span>}</td>
      <td className="px-3 py-2 text-right tabular-nums">{x.staff ? money(-x.staff) : "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">{x.rent ? money(-x.rent) : "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">{x.other ? money(-x.other) : "—"}{x.deliveryIncome > 0 && <span className="block text-[12px] text-muted">+{formatPrice(x.deliveryIncome)} delivery</span>}</td>
      <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", x.profit < 0 ? "text-danger" : "text-success")}>{money(x.profit)}{x.margin !== null && <span className="block text-[12px] font-normal text-muted">{x.margin}%</span>}</td>
      <td className={cn("px-3 py-2 text-right tabular-nums", x.kind === "HQ" || x.kind === "UNLINKED" ? "text-muted" : x.afterHq < 0 ? "text-danger" : "")}>{x.kind === "HQ" || x.kind === "UNLINKED" ? "—" : money(x.afterHq)}</td>
    </tr>
  );
}

export default async function ShopPlPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePermission("finance");
  const thisMonth = ktmDate().slice(0, 7);
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth;
  const r = await shopPl(month);
  const label = new Date(`${month}-15T12:00:00+05:45`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const losing = r.rows.filter((x) => x.afterHq < 0).length;
  return (
    <>
      <PageHeader title={`Profit by shop · ${label}`} description="Same rules as the Finance P&L (sales incl. VAT after discounts and returns, cost of goods as sold), split by the location the goods came from. Costs are the expenses recorded against each location; salaries follow each person's location." actions={<form className="flex gap-2"><input type="month" name="month" defaultValue={month} max={thisMonth} aria-label="Month" className="h-10 rounded-md border border-line bg-white px-3 text-[14px]" /><button className="h-10 rounded-md border border-line bg-white px-3 text-[14px] hover:border-ink">Go</button><Link href={`/admin/finance?month=${month}`} className="flex h-10 items-center text-[13.5px] underline underline-offset-4">Company P&L</Link></form>} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Company net profit", money(r.total.profit)], ["Shops and warehouses", String(r.rows.length)], ["Losing money after HQ costs", String(losing)], ["Central (HQ) net cost", r.hq ? money(-r.hq.profit) : "—"]].map(([l, v]) => (
          <Card key={l}><div className="p-4"><p className="text-[12px] text-muted">{l}</p><p className={cn("mt-1 text-[22px] font-semibold tabular-nums", l.startsWith("Losing") && losing > 0 && "text-danger")}>{v}</p></div></Card>
        ))}
      </div>
      {r.unitsWithoutCost > 0 && <p className="mb-4 rounded-md bg-[#fbf1df] px-4 py-3 text-[14px] text-warn">{r.unitsWithoutCost} units sold this month had no purchase cost, so profit is overstated.</p>}
      <Card>
        <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
          <thead className="border-b border-line bg-cloud/40"><tr><th className={cn(th, "text-left")}>Location</th><th className={th}>Net sales</th><th className={th}>Gross profit</th><th className={th}>Staff</th><th className={th}>Rent</th><th className={th}>Other costs</th><th className={th}>Shop profit</th><th className={th}>After HQ share</th></tr></thead>
          <tbody className="divide-y divide-line">
            {r.rows.map((x) => <Row key={x.storeId} x={x} />)}
            {r.unlinked && <Row x={r.unlinked} muted />}
            {r.hq && <Row x={r.hq} muted />}
            <tr className="border-t-2 border-ink font-semibold"><td className="px-3 py-2.5 text-left">Company</td><td className="px-3 py-2.5 text-right tabular-nums">{money(r.total.netSales)}</td><td className="px-3 py-2.5 text-right tabular-nums">{money(r.total.grossProfit)}</td><td colSpan={3} className="px-3 py-2.5 text-right tabular-nums">{money(-r.total.expenses)}</td><td className={cn("px-3 py-2.5 text-right tabular-nums", r.total.profit < 0 ? "text-danger" : "text-success")}>{money(r.total.profit)}</td><td /></tr>
          </tbody>
        </table></div>
        <p className="border-t border-line px-4 py-3 text-[12.5px] text-muted">“After HQ share” spreads HQ&apos;s net cost (central salaries, marketing, office, minus delivery charged to customers) over locations by their share of sales. A partial return on a line sold from two locations is shared between them in the same proportion. Record rent and other shop costs against the shop (Finance → Expenses, or as a monthly cost).</p>
      </Card>
    </>
  );
}
