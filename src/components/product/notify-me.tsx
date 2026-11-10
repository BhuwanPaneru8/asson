"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, Check } from "lucide-react";
import { subscribeStockAlert } from "@/actions/stock-alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { store } from "@/lib/config";
import { useT } from "@/components/site/i18n-provider";

/** Inline "text me when it's back" form for a sold-out size. */
export function NotifyMe({ variantId, label }: { variantId: string; label: string }) {
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { t } = useT();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { setPhone(localStorage.getItem("asson_phone") ?? ""); } catch {} setDone(null); setError(null); }, [variantId]);

  if (done) return <p role="status" className="flex items-center gap-2 border border-success/30 bg-[#e6f1ea] p-3 text-[14px] text-success"><Check className="h-4 w-4" />{done}</p>;
  return (
    <form
      className="border border-line bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await subscribeStockAlert({ variantId, phone });
          if (r.ok) { setDone(r.message); try { localStorage.setItem("asson_phone", phone); } catch {} }
          else setError(r.error);
        });
      }}
    >
      <p className="flex items-center gap-2 text-[14px] font-medium"><BellRing className="h-4 w-4" /> {t("nm.soldOut", { label })}</p>
      <p className="mt-1 text-[13px] text-muted">{t("nm.body")}</p>
      <div className="mt-3 flex">
        <span className="flex h-11 items-center border border-r-0 border-line bg-cloud px-3 text-[14px] text-muted">{store.phonePrefix}</span>
        <Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel-national" placeholder="98XXXXXXXX" aria-label={t("nm.aria")} aria-invalid={!!error} className="border-r-0" />
        <Button type="submit" loading={pending} className="shrink-0">{t("nm.notify")}</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p>}
    </form>
  );
}
