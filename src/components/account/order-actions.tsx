"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelOrder, requestReturn } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";

const CANCEL_REASONS = ["Ordered by mistake", "Found a better price", "Delivery is too slow", "Want to change size/colour", "Other"];
const RETURN_REASONS = ["Size too small", "Size too large", "Not as pictured", "Quality not as expected", "Received damaged/wrong item", "Changed my mind"];

export function OrderActions({ orderId, canCancel, canReturn }: { orderId: string; canCancel: boolean; canReturn: boolean }) {
  const [mode, setMode] = useState<"cancel" | "return" | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  if (!canCancel && !canReturn) return null;

  const go = () => start(async () => {
    const r = mode === "cancel" ? await cancelOrder(orderId, reason) : await requestReturn(orderId, reason);
    if (r.ok) { toast.success(mode === "cancel" ? "Order cancelled" : "Return requested — we'll schedule a pickup"); setMode(null); }
    else toast.error(r.error);
  });

  const reasons = mode === "cancel" ? CANCEL_REASONS : RETURN_REASONS;
  return (
    <>
      <div className="flex gap-2">
        {canCancel && <Button variant="secondary" onClick={() => setMode("cancel")}>Cancel order</Button>}
        {canReturn && <Button variant="secondary" onClick={() => setMode("return")}>Return items</Button>}
      </div>
      <Sheet open={!!mode} onClose={() => setMode(null)} side="right" title={mode === "cancel" ? "Cancel order" : "Request a return"}>
        <div className="space-y-5 p-5">
          <p className="text-[14.5px] text-ink-soft">{mode === "cancel" ? "Your order will be cancelled right away. Prepaid amounts are refunded in 5–7 business days." : "We'll pick up from your delivery address within 2–3 days. Refunds are issued once the items pass a quick quality check."}</p>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Reason</span>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Select a reason</option>
              {reasons.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </label>
          <Button className="w-full" size="lg" variant={mode === "cancel" ? "danger" : "primary"} disabled={!reason} loading={pending} onClick={go}>{mode === "cancel" ? "Cancel order" : "Request return"}</Button>
        </div>
      </Sheet>
    </>
  );
}
