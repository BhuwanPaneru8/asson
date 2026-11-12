"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelOrder, requestExchange, requestReturn } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useT } from "@/components/site/i18n-provider";
import type { MessageKey } from "@/lib/i18n";

const CANCEL_REASONS = ["Ordered by mistake", "Found a better price", "Delivery is too slow", "Want to change size/colour", "Other"];
const RETURN_REASONS = ["Size too small", "Size too large", "Not as pictured", "Quality not as expected", "Received damaged/wrong item", "Changed my mind"];

export type ExchangeItem = { orderItemId: string; name: string; color: string; size: string; left: number; sizes: { variantId: string; size: string }[] };

export function OrderActions({ orderId, canCancel, canReturn, exchange = [] }: { orderId: string; canCancel: boolean; canReturn: boolean; exchange?: ExchangeItem[] }) {
  const [mode, setMode] = useState<"cancel" | "return" | "exchange" | null>(null);
  const [pick, setPick] = useState<Record<string, { variantId: string; quantity: number }>>({});
  const canExchange = exchange.some((i) => i.left > 0 && i.sizes.length > 0);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const { t } = useT();
  if (!canCancel && !canReturn && !canExchange) return null;

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
        {canExchange && <Button variant="secondary" onClick={() => setMode("exchange")}>{t("ex.button")}</Button>}
        {canReturn && <Button variant="secondary" onClick={() => setMode("return")}>{t("ord.return")}</Button>}
      </div>
      <Sheet open={mode === "exchange"} onClose={() => setMode(null)} side="right" title={t("ex.title")}>
        <div className="space-y-5 p-5">
          <p className="text-[14.5px] text-ink-soft">{t("ex.body")}</p>
          {exchange.filter((i) => i.left > 0).map((i) => {
            const cur = pick[i.orderItemId];
            return (
              <div key={i.orderItemId} className="border-b border-line pb-4">
                <p className="text-[14px] font-medium">{i.name} · {i.color} · {i.size}</p>
                {!i.sizes.length ? <p className="mt-1 text-[13px] text-muted">{t("ex.noSizes")}</p> : (
                  <div className="mt-2 grid grid-cols-[1fr_96px] gap-2">
                    <Select aria-label={`${t("ex.newSize")}: ${i.name} ${i.size}`} value={cur?.variantId ?? ""} onChange={(e) => setPick({ ...pick, [i.orderItemId]: { variantId: e.target.value, quantity: cur?.quantity ?? 1 } })}>
                      <option value="">{t("ex.keep")} {i.size}</option>
                      {i.sizes.map((s) => <option key={s.variantId} value={s.variantId}>{t("ex.newSize")}: {s.size}</option>)}
                    </Select>
                    {i.left > 1 && cur?.variantId ? (
                      <Select aria-label={t("ex.qty")} value={String(cur.quantity)} onChange={(e) => setPick({ ...pick, [i.orderItemId]: { ...cur, quantity: Number(e.target.value) } })}>
                        {Array.from({ length: i.left }, (_, n) => <option key={n + 1} value={n + 1}>× {n + 1}</option>)}
                      </Select>
                    ) : <span />}
                  </div>
                )}
              </div>
            );
          })}
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{t("ex.why")}</span>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">{t("ord.selectReason")}</option>
              {["Size too small", "Size too large"].map((r) => <option key={r} value={r}>{t(`why.${r}` as MessageKey)}</option>)}
            </Select>
          </label>
          <Button className="w-full" size="lg" disabled={!Object.values(pick).some((p) => p.variantId)} loading={pending} onClick={() => start(async () => {
            const lines = Object.entries(pick).filter(([, p]) => p.variantId).map(([orderItemId, p]) => ({ orderItemId, newVariantId: p.variantId, quantity: p.quantity }));
            const r = await requestExchange(orderId, { lines, reason });
            if (r.ok) { toast.success(t("ex.done")); setMode(null); setPick({}); } else toast.error(r.error);
          })}>{t("ex.submit")}</Button>
        </div>
      </Sheet>
      <Sheet open={mode === "cancel" || mode === "return"} onClose={() => setMode(null)} side="right" title={mode === "cancel" ? t("ord.cancel") : t("ord.requestReturn")}>
        <div className="space-y-5 p-5">
          <p className="text-[14.5px] text-ink-soft">{mode === "cancel" ? t("ord.cancelBody") : t("ord.returnBody")}</p>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{t("ord.reason")}</span>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">{t("ord.selectReason")}</option>
              {reasons.map((r) => <option key={r} value={r}>{t(`why.${r}` as MessageKey)}</option>)}
            </Select>
          </label>
          <Button className="w-full" size="lg" variant={mode === "cancel" ? "danger" : "primary"} disabled={!reason} loading={pending} onClick={go}>{mode === "cancel" ? t("ord.cancel") : t("ord.requestReturnBtn")}</Button>
        </div>
      </Sheet>
    </>
  );
}
