"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buyAgain, changeMyAddress, reduceMyItem, swapMySize } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { DISTRICTS } from "@/lib/config";
import { useT } from "@/components/site/i18n-provider";

type Item = { id: string; name: string; color: string; size: string; quantity: number; sizes: { variantId: string; label: string }[] };
type Addr = { fullName: string; phone: string; line1: string; city: string; district: string };

/** Before packing: the customer changes a size, takes items off (unpaid orders) or changes the address. */
export function OrderChange({ orderId, items, addr, paid }: { orderId: string; items: Item[]; addr: Addr | null; paid: boolean }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(addr ?? { fullName: "", phone: "", line1: "", city: "", district: "" });
  const total = items.reduce((s, i) => s + i.quantity, 0);
  const run = (p: Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => { const r = await p; if (r.ok) { toast.success(t("oc.done")); after?.(); } else toast.error(r.error); });
  return (
    <div className="border border-line bg-white p-5">
      <h3 className="text-[15px] font-semibold">{t("oc.title")}</h3>
      <p className="mt-1 text-[13px] text-muted">{t("oc.body")}</p>
      <ul className="mt-3 divide-y divide-line">{items.map((i) => (
        <li key={i.id} className="py-3 text-[14px]">
          <p className="font-medium">{i.name} · {i.color} {i.size} × {i.quantity}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {i.sizes.length > 0 && (
              <Select aria-label={`${t("oc.size")}: ${i.name} ${i.size}`} defaultValue="" disabled={pending} onChange={(e) => e.target.value && run(swapMySize(orderId, i.id, e.target.value))}>
                <option value="">{t("oc.keep")} {i.color} {i.size}</option>
                {i.sizes.map((s) => <option key={s.variantId} value={s.variantId}>{t("oc.size")}: {s.label}</option>)}
              </Select>
            )}
            {!paid && total > 1 && (
              <Select aria-label={`${t("oc.qty")}: ${i.name} ${i.size}`} defaultValue={String(i.quantity)} disabled={pending} onChange={(e) => run(reduceMyItem(orderId, i.id, Number(e.target.value)))}>
                {Array.from({ length: i.quantity + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? t("oc.remove") : `× ${n}`}</option>)}
              </Select>
            )}
          </div>
        </li>
      ))}</ul>
      {paid && <p className="mt-2 text-[12.5px] text-muted">{t("oc.paidNote")}</p>}
      {addr && (!open ? <button className="mt-3 text-[13.5px] underline underline-offset-4" onClick={() => setOpen(true)}>{t("oc.address")}</button> : (
        <div className="mt-3 grid gap-2">
          <Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} aria-label={t("co.fullName")} placeholder={t("co.fullName")} />
          <Input value={f.phone} inputMode="numeric" onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} aria-label={t("co.phone")} placeholder={t("co.phone")} />
          <Select value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} aria-label={t("co.district")}>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</Select>
          <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} aria-label={t("co.city")} placeholder={t("co.city")} />
          <Input value={f.line1} onChange={(e) => setF({ ...f, line1: e.target.value })} aria-label={t("co.line1")} placeholder={t("co.line1")} />
          <div className="flex gap-2"><Button loading={pending} onClick={() => run(changeMyAddress(orderId, f), () => setOpen(false))}>{t("oc.saveAddress")}</Button><Button variant="secondary" onClick={() => setOpen(false)}>{t("oc.close")}</Button></div>
        </div>
      ))}
    </div>
  );
}

export function BuyAgain({ orderId }: { orderId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button variant="secondary" loading={pending} onClick={() => start(async () => { const r = await buyAgain(orderId); if (r.ok) { toast.success(t("oc.buyAgainDone")); router.push("/cart"); } else toast.error(r.error); })}>{t("oc.buyAgain")}</Button>;
}
