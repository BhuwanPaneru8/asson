import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { ktmDate } from "@/lib/pos";
import { periodBounds } from "@/lib/accounting";
import { cbmsOverview } from "@/lib/cbms";
import { formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";

export const metadata = { title: "Tax invoices" };
const day = /^\d{4}-\d{2}-\d{2}$/;
const th = "px-4 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-muted";
const SYNC: Record<string, { label: string; tone: "success" | "warn" | "neutral" }> = { SENT: { label: "In CBMS", tone: "success" }, FAILED: { label: "Refused", tone: "warn" }, QUEUED: { label: "Waiting", tone: "neutral" }, SENDING: { label: "Sending", tone: "neutral" } };

export default async function TaxInvoicesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; q?: string }> }) {
  await requirePermission("finance");
  const sp = await searchParams;
  const today = ktmDate();
  const from = sp.from && day.test(sp.from) ? sp.from : `${today.slice(0, 7)}-01`;
  const to = sp.to && day.test(sp.to) && sp.to >= from ? sp.to : today;
  const q = (sp.q ?? "").trim().toUpperCase().slice(0, 40);
  const { start, end } = periodBounds({ from, to });
  const where = q ? { number: { contains: q } } : { issuedAt: { gte: start, lt: end } };
  const [invoices, notes, totals, cbms] = await Promise.all([
    db.taxInvoice.findMany({ where, orderBy: { issuedAt: "desc" }, take: 100, select: { id: true, number: true, abbreviated: true, dateBs: true, dateAd: true, buyerName: true, buyerPan: true, total: true, vat: true, _count: { select: { prints: true } }, cbms: { select: { status: true, error: true } } } }),
    db.creditNote.findMany({ where, orderBy: { issuedAt: "desc" }, take: 100, select: { id: true, number: true, dateBs: true, dateAd: true, buyerName: true, total: true, vat: true, invoice: { select: { number: true } }, _count: { select: { prints: true } }, cbms: { select: { status: true, error: true } } } }),
    db.taxInvoice.aggregate({ where: { issuedAt: { gte: start, lt: end } }, _count: { _all: true }, _sum: { total: true, vat: true } }),
    cbmsOverview(),
  ]);
  const sync = (c: { status: string; error: string | null } | null) => c && <Pill tone={SYNC[c.status].tone}>{SYNC[c.status].label}</Pill>;
  const printed = (n: number) => (n ? `${n} print${n > 1 ? "s" : ""}${n > 1 ? ` (${n - 1} cop${n > 2 ? "ies" : "y"})` : ""}` : "Not printed");

  return (
    <>
      <PageHeader title="Tax invoices" description="Every invoice and credit note, numbered without gaps per fiscal year and series (each shop's till, and WEB for online orders). Issued documents can't be changed: a return is a credit note against its invoice." actions={<Link href={`/admin/finance/export?from=${from}&to=${to}`} className="text-[13.5px] underline underline-offset-4">Sales register (CSV)</Link>} />
      {!store.vatNumber && <p className="mb-4 rounded-md bg-[#fbf1df] px-4 py-3 text-[14px] text-warn">The business PAN isn&apos;t set, so invoices print &quot;PAN/VAT No.: not set&quot;. Add it as <code>vatNumber</code> in the store settings (lib/config.ts).</p>}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card title="This period">
          <dl className="space-y-1 px-5 py-3 text-[14px]">
            <div className="flex justify-between"><dt>Invoices issued</dt><dd className="tabular-nums">{totals._count._all}</dd></div>
            <div className="flex justify-between"><dt>Total incl. VAT</dt><dd className="tabular-nums">{formatPrice(totals._sum.total ?? 0)}</dd></div>
            <div className="flex justify-between"><dt>VAT</dt><dd className="tabular-nums">{formatPrice(totals._sum.vat ?? 0)}</dd></div>
          </dl>
        </Card>
        <Card title="IRD electronic billing (CBMS)">
          <div className="px-5 py-3 text-[14px]">
            <p>{cbms.on ? "On: invoices and credit notes are posted to the IRD within a minute of issue." : "Off. Documents wait here and are posted once CBMS is switched on with the taxpayer login (server settings)."}</p>
            <p className="mt-1 text-muted">{cbms.sent} sent · {cbms.queued} waiting · {cbms.failed} refused</p>
          </div>
        </Card>
      </div>
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-[13px] font-medium text-ink-soft">From<input type="date" name="from" defaultValue={from} max={today} className="mt-1 block h-10 rounded-md border border-line bg-white px-3 text-[14px]" /></label>
        <label className="text-[13px] font-medium text-ink-soft">To<input type="date" name="to" defaultValue={to} max={today} className="mt-1 block h-10 rounded-md border border-line bg-white px-3 text-[14px]" /></label>
        <label className="text-[13px] font-medium text-ink-soft">Number<input name="q" defaultValue={q} placeholder="e.g. 000123" className="mt-1 block h-10 rounded-md border border-line bg-white px-3 text-[14px]" /></label>
        <button className="h-10 rounded-md bg-ink px-4 text-[14px] text-white">Show</button>
      </form>
      <Card title={`Invoices${invoices.length === 100 ? " (latest 100)" : ""}`} className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead><tr className="border-b border-line"><th scope="col" className={th}>Number</th><th scope="col" className={th}>Date (BS / AD)</th><th scope="col" className={th}>Purchaser</th><th scope="col" className={`${th} text-right`}>Total</th><th scope="col" className={`${th} text-right`}>VAT</th><th scope="col" className={th}>Printed</th><th scope="col" className={th}>CBMS</th></tr></thead>
            <tbody>{invoices.map((i) => (
              <tr key={i.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2"><Link href={`/admin/finance/invoices/${i.id}`} className="font-medium hover:underline">{i.number}</Link>{i.abbreviated && <span className="ml-1 text-muted">(abbr.)</span>}</td>
                <td className="px-4 py-2 tabular-nums">{i.dateBs} · {i.dateAd}</td>
                <td className="px-4 py-2">{i.buyerName}{i.buyerPan ? <span className="text-muted"> · PAN {i.buyerPan}</span> : null}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatPrice(i.total)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatPrice(i.vat)}</td>
                <td className="px-4 py-2 text-muted">{printed(i._count.prints)}</td>
                <td className="px-4 py-2" title={i.cbms?.error ?? undefined}>{sync(i.cbms)}</td>
              </tr>
            ))}</tbody>
          </table>
          {!invoices.length && <p className="p-6 text-[14px] text-muted">No invoices in this period.</p>}
        </div>
      </Card>
      <Card title="Credit notes">
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead><tr className="border-b border-line"><th scope="col" className={th}>Number</th><th scope="col" className={th}>Against</th><th scope="col" className={th}>Date (BS / AD)</th><th scope="col" className={th}>Purchaser</th><th scope="col" className={`${th} text-right`}>Credited</th><th scope="col" className={`${th} text-right`}>VAT</th><th scope="col" className={th}>Printed</th><th scope="col" className={th}>CBMS</th></tr></thead>
            <tbody>{notes.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2"><Link href={`/admin/finance/invoices/credit/${c.id}`} className="font-medium hover:underline">{c.number}</Link></td>
                <td className="px-4 py-2">{c.invoice.number}</td>
                <td className="px-4 py-2 tabular-nums">{c.dateBs} · {c.dateAd}</td>
                <td className="px-4 py-2">{c.buyerName}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatPrice(c.total)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatPrice(c.vat)}</td>
                <td className="px-4 py-2 text-muted">{printed(c._count.prints)}</td>
                <td className="px-4 py-2" title={c.cbms?.error ?? undefined}>{sync(c.cbms)}</td>
              </tr>
            ))}</tbody>
          </table>
          {!notes.length && <p className="p-6 text-[14px] text-muted">No credit notes in this period.</p>}
        </div>
      </Card>
    </>
  );
}
