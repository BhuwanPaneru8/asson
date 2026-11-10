"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelOrder, requestReturn } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useT } from "@/components/site/i18n-provider";

const CANCEL_REASONS = ["Ordered by mistake", "Found a better price", "Delivery is too slow", "Want to change size/colour", "Other"];
const RETURN_REASONS = ["Size too small", "Size too large", "Not as pictured", "Quality not as expected", "Received damaged/wrong item", "Changed my mind"];

export function OrderActions({ orderId, canCancel, canReturn }: { orderId: string; canCancel: boolean; canReturn: boolean }) {
  const [mode, setMode] = useState<"cancel" | "return" | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const { t } = useT();
  if (!canCancel && !canReturn) return null;

  const go = () => start(async () => {
    const r = mode === "cancel" ? await cancelOrder(orderId, reason) : await requestReturn(orderId, reason);
    if (r.ok) { toast.success(mode === "cancel" ? t("ord.cancelled") : t("ord.returnRequested")); setMode(null); }
    else toast.error(r.error);
  });

  const reasons = mode === "cancel" ? CANCEL_REASONS : RETURN_REASONS;
  return (
    <>
      <div className="flex gap-2">
        {canCancel && <Button variant="secondary" onClick={() => setMode("cancel")}>{t("ord.cancel")}</Button>}
        {canReturn && <Button variant="secondary" onClick={() => setMode("return")}>{t("ord.return")}</Button>}
      </div>
      <Sheet open={!!mode} onClose={() => setMode(null)} side="right" title={mode === "cancel" ? t("ord.cancel") : t("ord.requestReturn")}>
        <div className="space-y-5 p-5">
          <p className="text-[14.5px] text-ink-soft">{mode === "cancel" ? t("ord.cancelBody") : t("ord.returnBody")}</p>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{t("ord.reason")}</span>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">{t("ord.selectReason")}</option>
              {reasons.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </label>
          <Button className="w-full" size="lg" variant={mode === "cancel" ? "danger" : "primary"} disabled={!reason} loading={pending} onClick={go}>{mode === "cancel" ? t("ord.cancel") : t("ord.requestReturnBtn")}</Button>
        </div>
      </Sheet>
    </>
  );
}
