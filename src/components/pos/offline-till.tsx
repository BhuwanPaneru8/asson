"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { store } from "@/lib/config";
import { offlineCode, queueStats, unsent, type QueuedSale } from "@/lib/till-offline";
import { formatDateTime, formatPrice } from "@/lib/utils";

const LABEL: Record<string, string> = { CASH: "Cash", ESEWA_QR: "eSewa QR", KHALTI_QR: "Khalti QR", FONEPAY_QR: "Fonepay QR", CARD: "Card" };

/** The strip above the till: offline, sales waiting to sync, sales the server refused. */
export function TillBanner({ online, queue, syncing, waitingForOthers, standalone, onRetry }: {
  online: boolean; queue: QueuedSale[]; syncing: boolean; waitingForOthers: number; standalone?: boolean; onRetry: () => void;
}) {
  const st = queueStats(queue);
  const failed = unsent(queue).filter((s) => s.status === "failed");
  if (online && !st.pending && !standalone) return null;
  return (
    <div role="status" className={`-mx-4 -mt-4 mb-4 space-y-1 border-b border-line px-4 py-2.5 text-[14px] md:-mx-8 md:-mt-8 md:px-8 ${online ? "bg-cloud" : "bg-[#fbf1df]"}`}>
      {!online ? (
        <p className="flex flex-wrap items-center gap-2 font-medium text-warn">
          <CloudOff className="h-4 w-4" aria-hidden /> Offline: sales are saved on this device
          {st.pending > 0 && <span className="font-normal">· {st.pending} waiting to sync ({formatPrice(st.total)})</span>}
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-2">
          {st.pending > 0 ? (
            <>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} aria-hidden />
              {syncing ? `Sending ${st.pending} offline sale${st.pending > 1 ? "s" : ""}…` : `${st.pending} offline sale${st.pending > 1 ? "s" : ""} waiting to sync`}
              {!syncing && <button onClick={onRetry} className="rounded border border-line bg-white px-2 py-0.5 text-[13px] hover:border-ink">Send now</button>}
            </>
          ) : "Connection is back. Every sale has synced."}
          {standalone && <Link href="/admin/pos" className="ml-auto rounded bg-ink px-3 py-1 text-[13px] font-medium text-white">Open the full till</Link>}
        </p>
      )}
      {waitingForOthers > 0 && <p className="text-[13px] text-muted">{waitingForOthers} sale{waitingForOthers > 1 ? "s were" : " was"} made by another cashier on this till. They must sign in here to send {waitingForOthers > 1 ? "them" : "it"}.</p>}
      {failed.map((s) => (
        <p key={s.clientRef} className="flex items-start gap-2 text-[13px] text-danger">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {offlineCode(s.clientRef)} ({formatPrice(s.total)}) couldn&apos;t be recorded: {s.error}
        </p>
      ))}
    </div>
  );
}

/** The 80 mm receipt for a sale saved offline. Rendered into <body> so printing shows only the receipt. */
export function OfflineReceipt({ sale }: { sale: QueuedSale }) {
  return createPortal(
    <div id="till-receipt" className="hidden print:block">
      <div className="mx-auto w-[302px] bg-white p-3 font-mono text-[12px] leading-snug text-black print:p-0">
        <div className="text-center">
          <p className="font-display text-[22px]">{store.name.toLowerCase()}.</p>
          <p>{store.storeAddress}</p>
          <p>{store.supportPhone}</p>
        </div>
        <div className="my-2 border-t border-dashed border-black" />
        <p className="text-center font-bold">OFFLINE · PENDING SYNC</p>
        <p>Ref: {sale.number ?? offlineCode(sale.clientRef)}</p>
        <p>Date: {formatDateTime(sale.soldAt)}</p>
        <p>Shop: {sale.store}</p>
        <p>Cashier: {sale.cashierName}</p>
        {sale.customer?.name && <p>Customer: {sale.customer.name}</p>}
        <div className="my-2 border-t border-dashed border-black" />
        {sale.lines.map((l) => (
          <div key={l.variantId} className="mb-1">
            <p>{l.name}</p>
            <p className="flex justify-between"><span>{l.color}/{l.size} {l.quantity} × {formatPrice(l.price)}</span><span>{formatPrice(l.price * l.quantity)}</span></p>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-black" />
        <p className="flex justify-between"><span>Subtotal</span><span>{formatPrice(sale.subtotal)}</span></p>
        {sale.discountAmount > 0 && <p className="flex justify-between"><span>Discount</span><span>-{formatPrice(sale.discountAmount)}</span></p>}
        <p className="flex justify-between text-[14px] font-bold"><span>TOTAL</span><span>{formatPrice(sale.total)}</span></p>
        <div className="my-2 border-t border-dashed border-black" />
        {sale.tenders.map((t, i) => (
          <p key={i} className="flex justify-between"><span>{LABEL[t.method]}{t.reference ? ` (${t.reference})` : ""}</span><span>{formatPrice(t.method === "CASH" && t.tendered ? t.tendered : t.amount)}</span></p>
        ))}
        {sale.change > 0 && <p className="flex justify-between font-bold"><span>Change</span><span>{formatPrice(sale.change)}</span></p>}
        <div className="my-2 border-t border-dashed border-black" />
        <p className="text-center text-[11px]">Made while the shop was offline. It is recorded when the till reconnects; ask for a tax invoice then if you need one.</p>
        <p className="text-center">Thank you for shopping with {store.name}!</p>
        <p className="text-center text-[11px]">Exchanges within {store.returnWindowDays} days with this receipt and tags attached.</p>
      </div>
    </div>,
    document.body,
  );
}

/** Print only the offline receipt (the rest of the page is hidden while printing). */
export function printOfflineReceipt() {
  document.body.classList.add("printing-receipt");
  const done = () => { document.body.classList.remove("printing-receipt"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
}
