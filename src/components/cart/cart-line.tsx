"use client";

import Image from "next/image";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeCartItem, updateCartItem } from "@/actions/cart";
import type { CartLine as Line } from "@/lib/cart";
import { store } from "@/lib/config";
import { cn, formatPrice } from "@/lib/utils";
import { rich } from "@/lib/i18n/rich";
import { useT } from "@/components/site/i18n-provider";
import { pick } from "@/lib/i18n";

export function CartLine({ line, onNavigate, compact }: { line: Line; onNavigate?: () => void; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [qty, setQty] = useOptimistic(line.quantity);
  const { t, locale } = useT();
  const name = pick(locale, line.name, line.nameNe);

  const change = (q: number) =>
    start(async () => {
      setQty(q);
      const r = q <= 0 ? await removeCartItem(line.id) : await updateCartItem(line.id, q);
      if (!r.ok) toast.error(r.error);
      else if (r.message) toast(r.message);
    });

  const max = Math.min(line.stock, store.maxQtyPerItem);
  return (
    <div className={cn("flex gap-4", pending && "opacity-60")}>
      <Link href={`/p/${line.slug}`} onClick={onNavigate} className={cn("relative shrink-0 overflow-hidden bg-cloud", compact ? "h-28 w-[84px]" : "h-36 w-28")}>
        {line.image && <Image src={line.image} alt={name} fill sizes="112px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/p/${line.slug}`} onClick={onNavigate} className="line-clamp-2 text-[14.5px] font-medium leading-snug hover:text-accent">{name}</Link>
            <p className="mt-1 text-[13px] text-muted">{t("line.variant", { color: line.color, size: line.size })}</p>
          </div>
          <div className="text-right">
            <p className="text-[14.5px] font-semibold">{formatPrice(line.unitPrice * qty)}</p>
            {line.compareAtPrice && line.compareAtPrice > line.unitPrice && <p className="text-[12.5px] text-muted line-through">{formatPrice(line.compareAtPrice * qty)}</p>}
          </div>
        </div>
        {!line.available && (
          <p className="mt-1.5 text-[13px] font-medium text-danger">{line.stock === 0 ? t("line.soldOutRemove") : t("line.onlyReduce", { n: line.stock })}</p>
        )}
        {line.available && line.stock <= 3 && <p className="mt-1.5 text-[12.5px] font-medium text-warn">{t("line.only", { n: line.stock })}</p>}
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex h-9 items-center border border-line bg-white">
            <button onClick={() => change(qty - 1)} disabled={pending} className="flex h-full w-9 items-center justify-center hover:bg-cloud" aria-label={t("line.dec")}><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-8 text-center text-[14px] font-medium tabular-nums" aria-live="polite">{qty}</span>
            <button onClick={() => change(qty + 1)} disabled={pending || qty >= max} className="flex h-full w-9 items-center justify-center hover:bg-cloud disabled:opacity-30" aria-label={t("line.inc")}><Plus className="h-3.5 w-3.5" /></button>
          </div>
          <button onClick={() => change(0)} disabled={pending} className="flex items-center gap-1.5 text-[13px] text-muted hover:text-danger" aria-label={t("line.removeName", { name })}>
            <Trash2 className="h-3.5 w-3.5" /> {t("line.remove")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const goal = store.shipping.freeThreshold;
  const pct = Math.min(100, (subtotal / goal) * 100);
  const left = goal - subtotal;
  const { t } = useT();
  return (
    <div>
      <p className="text-[13.5px]">
        {left > 0 ? rich(t("bag.away"), { amount: <span className="font-semibold">{formatPrice(left)}</span> }) : <span className="font-medium text-success">{t("bag.unlocked")}</span>}
      </p>
      <div className="mt-2 h-1 w-full bg-line"><div className={cn("h-full transition-all duration-500", left > 0 ? "bg-ink" : "bg-success")} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
