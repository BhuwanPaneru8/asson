"use client";

import { useState, useTransition } from "react";
import { Phone, PhoneOff, PhoneMissed, Check } from "lucide-react";
import { toast } from "sonner";
import { recordCall } from "@/actions/admin/orders";
import { Card } from "./ui";

/** Cash-on-delivery verification: call the customer before packing, so fake/impulse orders don't ship. */
export function CallPanel({ orderId, phone, attempts, outcome, risk = null }: { orderId: string; phone: string; attempts: number; outcome: string; risk?: { level: "high" | "medium" | "low"; reasons: string[] } | null }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const go = (o: "CONFIRMED" | "NO_ANSWER" | "REJECTED") => {
    if (o === "REJECTED" && !confirm("Cancel this order? Stock will be restored.")) return;
    start(async () => {
      const r = await recordCall(orderId, o, note || undefined);
      if (!r.ok) return void toast.error(r.error);
      toast.success(o === "CONFIRMED" ? "Confirmed — ready to pack" : o === "REJECTED" ? "Order cancelled" : "Call attempt logged");
      if (r.message) toast(r.message);
      setNote("");
    });
  };
  return (
    <Card title="Confirmation call">
      <div className="space-y-3 px-5 py-4 text-[14px]">
        {risk && risk.level !== "low" && (
          <div className={risk.level === "high" ? "rounded-md bg-[#fbe9e7] px-3 py-2 text-[13px] text-danger" : "rounded-md bg-[#fbeee0] px-3 py-2 text-[13px] text-[#9a5b13]"}>
            <p className="font-semibold">{risk.level === "high" ? "High" : "Some"} risk of coming back</p>
            <p>{risk.reasons.join("; ").replace(/^./, (c) => c.toUpperCase())}.{risk.level === "high" ? " Ask them to pay in advance, or confirm carefully." : " Confirm they'll be in and have the cash."}</p>
          </div>
        )}
        {risk && risk.level === "low" && risk.reasons.length > 0 && <p className="text-[12.5px] text-success">Good record: {risk.reasons.join("; ")}.</p>}
        <a href={`tel:+977${phone}`} className="flex items-center gap-2 font-medium underline underline-offset-4"><Phone className="h-4 w-4" /> Call +977 {phone}</a>
        <p className="text-[12.5px] text-muted">{attempts ? `${attempts} attempt${attempts > 1 ? "s" : ""} so far${outcome === "NO_ANSWER" ? " — no answer yet" : ""}.` : "Not called yet."} Confirm size, address and that they&apos;ll pay on delivery.</p>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — e.g. deliver after 5pm" aria-label="Call note" className="h-9 w-full rounded-md border border-line px-3 text-[13.5px]" />
        <div className="grid grid-cols-3 gap-2">
          <button disabled={pending} onClick={() => go("CONFIRMED")} className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-ink text-[13px] font-medium text-white"><Check className="h-4 w-4" /> Confirmed</button>
          <button disabled={pending} onClick={() => go("NO_ANSWER")} className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-line text-[13px]"><PhoneMissed className="h-4 w-4" /> No answer</button>
          <button disabled={pending} onClick={() => go("REJECTED")} className="flex h-10 items-center justify-center gap-1.5 rounded-md text-[13px] text-danger hover:bg-[#fbe9e7]"><PhoneOff className="h-4 w-4" /> Fake / cancel</button>
        </div>
      </div>
    </Card>
  );
}
