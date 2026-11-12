"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, Check } from "lucide-react";
import { subscribePriceAlert } from "@/actions/stock-alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { store } from "@/lib/config";
import { useT } from "@/components/site/i18n-provider";

/** "Text me if the price drops": a link that opens a phone form. */
export function PriceDropAlert({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { t } = useT();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { setPhone(localStorage.getItem("asson_phone") ?? ""); } catch {} }, []);
  if (done) return <p role="status" className="mt-2 flex items-center gap-1.5 text-[13px] text-success"><Check className="h-3.5 w-3.5" />{done}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted underline underline-offset-4 hover:text-ink"><BellRing className="h-3.5 w-3.5" />{t("pd.link")}</button>;
  return (
    <form className="mt-3" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => {
      const r = await subscribePriceAlert({ productId, phone });
      if (r.ok) { setDone(r.message); try { localStorage.setItem("asson_phone", phone); } catch {} } else setError(r.error);
    }); }}>
      <p className="text-[13px] text-muted">{t("pd.body")}</p>
      <div className="mt-2 flex">
        <span className="flex h-11 items-center border border-r-0 border-line bg-cloud px-3 text-[14px] text-muted">{store.phonePrefix}</span>
        <Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel-national" placeholder="98XXXXXXXX" aria-label={t("pd.aria")} aria-invalid={!!error} className="border-r-0" />
        <Button type="submit" loading={pending} className="shrink-0">{t("nm.notify")}</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p>}
    </form>
  );
}
