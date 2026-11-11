"use client";

import { useState, useTransition } from "react";
import type { OrderStatus } from "@prisma/client";
import { toast } from "sonner";
import { addOrderNote, markPaid, updateOrderStatus } from "@/actions/admin/orders";
import { Card } from "./ui";

const LABEL: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Confirm order", PACKED: "Mark as packed", SHIPPED: "Mark as shipped", OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Mark delivered", CANCELLED: "Cancel order", RETURNED: "Return received & refund", RETURN_REQUESTED: "Open return",
};
import { CARRIERS } from "@/lib/carriers";

export function OrderControls({ orderId, status, next: allowed, paymentPending, carrier, tracking, pickupAt }: { orderId: string; status: OrderStatus; next: OrderStatus[]; paymentPending: boolean; carrier: string | null; tracking: string | null; pickupAt?: string | null }) {
  // pickup orders are handed over (and paid) at the shop's till, not from here
  const next = pickupAt ? allowed.filter((s) => s !== "DELIVERED") : allowed;
  const [pending, start] = useTransition();
  const [c, setC] = useState<string>(carrier ?? CARRIERS[0]);
  const [awb, setAwb] = useState(tracking ?? "");
  const [note, setNote] = useState("");

  const go = (to: OrderStatus) => {
    if ((to === "CANCELLED" || to === "RETURNED") && !confirm(to === "CANCELLED" ? "Cancel this order? Stock will be restored." : "Confirm return received? Stock will be restored and payment marked refunded.")) return;
    start(async () => {
      const r = await updateOrderStatus({ orderId, to, carrier: c, trackingNumber: awb });
      if (r.ok) toast.success("Order updated"); else toast.error(r.error);
    });
  };
  const forward = next.filter((s) => s !== "CANCELLED");
  const needsShip = forward.includes("SHIPPED");

  return (
    <Card title="Fulfilment">
      <div className="space-y-3 px-5 py-4">
        {needsShip && (
          <div className="grid grid-cols-2 gap-2">
            <select value={c} onChange={(e) => setC(e.target.value)} className="h-10 rounded-md border border-line bg-white px-2 text-[13.5px]" aria-label="Courier">{CARRIERS.map((x) => <option key={x}>{x}</option>)}</select>
            <input value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="AWB / tracking no." className="h-10 rounded-md border border-line bg-white px-3 text-[13.5px] outline-none focus:border-ink" aria-label="Tracking number" />
          </div>
        )}
        {forward.map((s, i) => (
          <button key={s} disabled={pending} onClick={() => go(s)} className={`h-10 w-full rounded-md text-[14px] font-medium disabled:opacity-50 ${i === 0 ? "bg-ink text-white hover:bg-ink-soft" : "border border-line bg-white hover:border-ink"}`}>{pickupAt && s === "PACKED" ? `Ready for pickup at ${pickupAt} (texts customer)` : LABEL[s] ?? s}</button>
        ))}
        {pickupAt && status === "PACKED" && <p className="text-[13.5px] text-muted">Waiting at {pickupAt}. Hand it over at that shop&apos;s till: Point of sale → Pickups.</p>}
        {next.includes("CANCELLED") && <button disabled={pending} onClick={() => go("CANCELLED")} className="h-10 w-full rounded-md text-[14px] text-danger hover:bg-[#fbe9e7] disabled:opacity-50">Cancel order</button>}
        {next.length === 0 && !(pickupAt && status === "PACKED") && <p className="text-[13.5px] text-muted">This order is {status.toLowerCase().replace(/_/g, " ")}. No further steps.</p>}
        {paymentPending && <button disabled={pending} onClick={() => start(async () => { const r = await markPaid(orderId); if (r.ok) toast.success("Marked paid"); else toast.error(r.error); })} className="h-10 w-full rounded-md border border-line bg-white text-[14px] hover:border-ink">Mark payment received</button>}
      </div>
      <form className="border-t border-line px-5 py-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addOrderNote(orderId, note); if (r.ok) { setNote(""); toast.success("Note added"); } else toast.error(r.error); }); }}>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add an internal note (not visible to customer)" className="w-full rounded-md border border-line bg-white p-2.5 text-[13.5px] outline-none focus:border-ink" aria-label="Internal note" />
        <button disabled={pending || !note.trim()} className="mt-2 rounded-md border border-line bg-white px-3 py-1.5 text-[13px] hover:border-ink disabled:opacity-40">Add note</button>
      </form>
    </Card>
  );
}
