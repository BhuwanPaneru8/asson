import type { DocView } from "@/lib/invoices";
import { amountInWords, amountText } from "@/lib/invoice-math";
import { BS_MONTHS } from "@/lib/nepali-calendar";
import { store } from "@/lib/config";
import { cn } from "@/lib/utils";

// A tax invoice, abbreviated tax invoice or credit note laid out as the Electronic Billing Procedure's
// Schedule 6 format: bill number, dates (BS and AD), seller and purchaser with PAN, payment method, lines, then
// amount, discount, taxable amount, VAT 13% and total, the total in words. Two sizes: 80 mm till roll, A4.

const bsLong = (bs: string) => { const [y, m, d] = bs.split("-").map(Number); return `${d} ${BS_MONTHS[m - 1]} ${y}`; };
const title = (d: DocView) => (d.kind === "credit" ? ["CREDIT NOTE", "क्रेडिट नोट"] : d.abbreviated ? ["ABBREVIATED TAX INVOICE", "संक्षिप्त कर बीजक"] : ["TAX INVOICE", "कर बीजक"]);
const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: store.timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function TaxDocument({ doc, copy, size, note }: { doc: DocView; copy: string | null; size: "thermal" | "a4"; note?: React.ReactNode }) {
  const [en, ne] = title(doc);
  const thermal = size === "thermal";
  const row = (label: string, value: string, strong = false) => (
    <div className={cn("flex justify-between gap-3", strong && "font-bold", strong && !thermal && "border-t border-black pt-1 text-[15px]")}><dt>{label}</dt><dd className="tabular-nums">{value}</dd></div>
  );
  const totals = (
    <dl className={thermal ? "" : "ml-auto w-72 space-y-0.5"}>
      {row("Amount", amountText(doc.gross))}
      {doc.discount > 0 && row("Discount", `-${amountText(doc.discount)}`)}
      {row("Taxable amount", amountText(doc.taxable))}
      {!doc.abbreviated && row(`VAT ${store.vatPercent}%`, amountText(doc.vat))}
      {row(doc.kind === "credit" ? "Total credited" : "Total", amountText(doc.total), true)}
    </dl>
  );
  const info: [string, string | null][] = [
    [doc.kind === "credit" ? "Credit note no." : "Invoice no.", doc.number],
    ["Date", `${bsLong(doc.dateBs)} BS (${doc.dateAd} AD) ${time(doc.issuedAt)}`],
    ...(doc.against ? [["Against invoice", `${doc.against.number} of ${bsLong(doc.against.dateBs)} BS (${doc.against.dateAd})`] as [string, string]] : []),
    ["Order", doc.orderNumber],
    ["Purchaser", doc.buyer.name],
    ["Purchaser's address", doc.buyer.address],
    ["Purchaser's PAN", doc.buyer.pan],
    ["Payment", doc.paymentMethod],
    ["Reason", doc.reason],
    ["Issued by", doc.issuedBy],
  ];

  return (
    <article aria-label={`${en} ${doc.number}`} className={cn("bg-white text-black", thermal ? "mx-auto w-[302px] p-3 font-mono text-[12px] leading-snug print:p-0" : "mx-auto max-w-[794px] p-10 text-[13px] leading-relaxed print:max-w-none print:p-0")}>
      {copy && <p className={cn("mb-2 border-2 border-black text-center font-bold uppercase", thermal ? "py-0.5" : "py-1 text-[15px]")}>{copy}</p>}
      <header className={thermal ? "text-center" : "flex items-start justify-between gap-6 border-b-2 border-black pb-4"}>
        <div className={thermal ? "" : "space-y-0.5"}>
          <p className={cn("font-bold", thermal ? "text-[15px]" : "text-[20px]")}>{doc.seller.name}</p>
          <p>{doc.seller.address}</p>
          <p>{doc.seller.pan ? `PAN/VAT No.: ${doc.seller.pan}` : <span className="font-bold">PAN/VAT No.: not set</span>}</p>
          {!thermal && <p>{store.supportPhone} · {store.supportEmail}</p>}
        </div>
        <div className={thermal ? "mt-2" : "text-right"}>
          <h1 className={cn("font-bold tracking-wide", thermal ? "text-[14px]" : "text-[22px]")}>{en}</h1>
          <p>{ne}</p>
        </div>
      </header>

      <dl className={thermal ? "my-2 space-y-0.5 border-y border-dashed border-black py-2" : "my-5 grid grid-cols-2 gap-x-8 gap-y-1"}>
        {info.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className={thermal ? "" : "flex gap-2"}><dt className={thermal ? "inline" : "w-40 shrink-0 text-[#444]"}>{k}{thermal ? ": " : ""}</dt><dd className={thermal ? "inline" : "font-medium"}>{v}</dd></div>
        ))}
      </dl>

      {thermal ? (
        <div className="space-y-1">
          {doc.lines.map((l, i) => (
            <div key={i}><p>{i + 1}. {l.name}</p><p className="flex justify-between"><span>{l.quantity} × {amountText(l.rate)}</span><span className="tabular-nums">{amountText(l.amount)}</span></p></div>
          ))}
        </div>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead><tr className="border-y border-black">{["S.No.", "Details", "Qty", "Rate", "Amount (Rs)"].map((h, i) => <th key={h} scope="col" className={cn("py-1.5 font-semibold", i > 1 && "text-right", i === 0 && "w-12")}>{h}</th>)}</tr></thead>
          <tbody>{doc.lines.map((l, i) => (
            <tr key={i} className="border-b border-[#ccc]"><td className="py-1.5">{i + 1}</td><td>{l.name}{l.sku ? <span className="text-[#555]"> · {l.sku}</span> : null}</td><td className="text-right tabular-nums">{l.quantity}</td><td className="text-right tabular-nums">{amountText(l.rate)}</td><td className="text-right tabular-nums">{amountText(l.amount)}</td></tr>
          ))}</tbody>
        </table>
      )}

      <div className={thermal ? "my-2 border-t border-dashed border-black pt-2" : "mt-4"}>{totals}</div>
      <p className={thermal ? "text-[11px]" : "mt-3"}>In words: {amountInWords(doc.total)}</p>
      <p className={thermal ? "text-[11px]" : "text-[12px] text-[#444]"}>Rates and amounts are before VAT; prices include {store.vatPercent}% VAT.{doc.abbreviated ? " The purchaser can't claim input VAT on an abbreviated invoice." : ""}</p>
      {note}
      {!thermal && <div className="mt-16 flex justify-end"><p className="w-56 border-t border-black pt-1 text-center">Authorised signature</p></div>}
    </article>
  );
}
