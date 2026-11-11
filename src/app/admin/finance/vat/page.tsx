import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { ktmDate } from "@/lib/pos";
import { suggestNextPeriod, vatOverview } from "@/lib/vat";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { Card, PageHeader, Pill } from "@/components/admin/ui";
import { FileVatReturn, NewVatReturn, PayVatReturn, ReopenVatReturn } from "@/components/admin/vat-forms";

export const metadata = { title: "VAT returns" };
const money = (v: number) => formatPrice(v);

export default async function VatPage() {
  await requirePermission("finance");
  const [returns, suggestion] = await Promise.all([vatOverview(), suggestNextPeriod()]);
  const today = ktmDate();
  return (
    <>
      <PageHeader title="VAT returns" description="One return per Nepali month: output VAT on sales less returns, minus input VAT on supplier bills with a PAN, less credit carried from the last return. File them in order; a filed return freezes its figures and locks its period's purchase bills." actions={<Link href="/admin/finance/export" className="text-[13.5px] underline underline-offset-4">Registers (CSV)</Link>} />
      <Card title="Start a return" className="mb-4"><NewVatReturn suggestion={suggestion} /></Card>
      {!returns.length && <Card><p className="p-6 text-[14px] text-muted">No returns yet.</p></Card>}
      <div className="space-y-4">{returns.map((r) => {
        const f = r.status === "FILED" ? { outputVat: r.outputVat, inputVat: r.inputVat, unclaimableVat: r.unclaimableVat, broughtForward: r.broughtForward, payable: r.payable, carryForward: r.carryForward, noPan: ((r.snapshot as { noPan?: { bill: string; supplier: string; invoice: string; vat: number }[] } | null)?.noPan ?? []) } : r.live!;
        return (
          <Card key={r.id} title={`${r.label} · ${r.from} to ${r.to}`} action={<Pill tone={r.status === "FILED" ? (r.paidOn || !r.payable ? "success" : "warn") : "neutral"}>{r.status === "FILED" ? (r.paidOn ? "Filed · paid" : r.payable ? "Filed · to pay" : "Filed") : "Draft"}</Pill>}>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <dl className="space-y-1 text-[14px]">
                <div className="flex justify-between"><dt>Output VAT (sales less returns)</dt><dd className="tabular-nums">{money(f.outputVat)}</dd></div>
                <div className="flex justify-between"><dt>Input VAT (bills with a supplier PAN)</dt><dd className="tabular-nums">−{money(f.inputVat)}</dd></div>
                {f.broughtForward > 0 && <div className="flex justify-between"><dt>Credit from the last return</dt><dd className="tabular-nums">−{money(f.broughtForward)}</dd></div>}
                <div className={cn("flex justify-between border-t border-line pt-1 font-semibold", f.payable ? "" : "text-success")}><dt>{f.payable ? "VAT payable" : "Credit to carry forward"}</dt><dd className="tabular-nums">{money(f.payable || f.carryForward)}</dd></div>
                {f.unclaimableVat > 0 && <p className="pt-1 text-[12.5px] text-warn">{money(f.unclaimableVat)} of VAT on bills from suppliers with no PAN can&apos;t be claimed: {f.noPan.map((b) => `${b.supplier} (${b.invoice})`).join(", ")}. Add the supplier&apos;s PAN to claim it.</p>}
              </dl>
              <div className="space-y-2 text-[13.5px]">
                {r.status === "DRAFT" ? <>
                  {"prevFiled" in r && r.prevFiled === false && <p className="text-warn">File {r.prevLabel} first: its credit carries into this one.</p>}
                  {r.reopenReason && <p className="text-muted">Reopened: “{r.reopenReason}”</p>}
                  {r.to < today ? <FileVatReturn id={r.id} /> : <p className="text-muted">The period hasn&apos;t ended yet: the figures above are live.</p>}
                </> : <>
                  <p className="text-muted">Filed {formatDateTime(r.filedAt!)} · ack {r.ackNo}</p>
                  {r.payable > 0 && (r.paidOn ? <p>Paid {money(r.paidAmount ?? 0)} on {r.paidOn}{r.paidRef ? ` (${r.paidRef})` : ""}{r.statementLine ? " · seen on the bank statement" : ""}</p> : <PayVatReturn id={r.id} payable={r.payable} today={today} />)}
                  {!r.paidOn && <ReopenVatReturn id={r.id} />}
                </>}
              </div>
            </div>
          </Card>
        );
      })}</div>
    </>
  );
}
