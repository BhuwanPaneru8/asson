"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCoupon, toggleCoupon } from "@/actions/admin/catalog";

const input = "h-10 w-full rounded-md border border-line bg-white px-3 text-[14px] outline-none focus:border-ink";
const lbl = "mb-1 block text-[13px] font-medium text-ink-soft";

export function CouponForm() {
  const [type, setType] = useState("PERCENT");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <form className="space-y-3 p-5" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = Object.fromEntries(new FormData(form));
      start(async () => {
        const r = await createCoupon(data);
        if (r.ok) { toast.success("Coupon created"); form.reset(); setErrors({}); } else setErrors(r.fieldErrors ?? {});
      });
    }}>
      <label className={lbl}>Code<input name="code" className={`${input} font-mono uppercase`} placeholder="DASHAIN20" required /></label>{errors.code && <p className="text-[12.5px] text-danger">{errors.code}</p>}
      <label className={lbl}>Description (shown to shoppers)<input name="description" className={input} placeholder="20% off Dashain picks" /></label>
      <label className={lbl}>Type<select name="type" className={input} value={type} onChange={(e) => setType(e.target.value)}><option value="PERCENT">Percentage off</option><option value="FIXED">Fixed amount off</option><option value="FREE_SHIPPING">Free shipping</option></select></label>
      {type !== "FREE_SHIPPING" && <><label className={lbl}>{type === "PERCENT" ? "Percent (1–90)" : "Amount (Rs)"}<input name="value" inputMode="decimal" className={input} required /></label>{errors.value && <p className="text-[12.5px] text-danger">{errors.value}</p>}</>}
      {type === "FREE_SHIPPING" && <input type="hidden" name="value" value="0" />}
      {type === "PERCENT" && <label className={lbl}>Max discount (Rs, optional)<input name="maxDiscount" inputMode="decimal" className={input} /></label>}
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>Min. order (Rs)<input name="minSubtotal" inputMode="decimal" defaultValue="0" className={input} /></label>
        <label className={lbl}>Usage limit<input name="usageLimit" inputMode="numeric" placeholder="Unlimited" className={input} /></label>
      </div>
      <label className={lbl}>Ends on (optional)<input name="endsAt" type="date" className={input} /></label>
      <button disabled={pending} className="h-10 w-full rounded-md bg-ink text-[14px] font-medium text-white disabled:opacity-50">{pending ? "Creating…" : "Create coupon"}</button>
    </form>
  );
}

export function CouponToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { await toggleCoupon(id); })} className="text-[12.5px] underline">{active ? "Pause" : "Activate"}</button>;
}
