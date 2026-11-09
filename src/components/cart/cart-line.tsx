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

export function CartLine({ line, onNavigate, compact }: { line: Line; onNavigate?: () => void; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [qty, setQty] = useOptimistic(line.quantity);

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
        {line.image && <Image src={line.image} alt={line.name} fill sizes="112px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/p/${line.slug}`} onClick={onNavigate} className="line-clamp-2 text-[14.5px] font-medium leading-snug hover:text-accent">{line.name}</Link>
            <p className="mt-1 text-[13px] text-muted">{line.color} · Size {line.size}</p>
          </div>
          <div className="text-right">
            <p className="text-[14.5px] font-semibold">{formatPrice(line.unitPrice * qty)}</p>
            {line.compareAtPrice && line.compareAtPrice > line.unitPrice && <p className="text-[12.5px] text-muted line-through">{formatPrice(line.compareAtPrice * qty)}</p>}
          </div>
        </div>
        {!line.available && (
          <p className="mt-1.5 text-[13px] font-medium text-danger">{line.stock === 0 ? "Sold out — please remove" : `Only ${line.stock} left — reduce quantity`}</p>
        )}
        {line.available && line.stock <= 3 && <p className="mt-1.5 text-[12.5px] font-medium text-warn">Only {line.stock} left</p>}
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex h-9 items-center border border-line bg-white">
            <button onClick={() => change(qty - 1)} disabled={pending} className="flex h-full w-9 items-center justify-center hover:bg-cloud" aria-label="Decrease quantity"><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-8 text-center text-[14px] font-medium tabular-nums" aria-live="polite">{qty}</span>
            <button onClick={() => change(qty + 1)} disabled={pending || qty >= max} className="flex h-full w-9 items-center justify-center hover:bg-cloud disabled:opacity-30" aria-label="Increase quantity"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          <button onClick={() => change(0)} disabled={pending} className="flex items-center gap-1.5 text-[13px] text-muted hover:text-danger" aria-label={`Remove ${line.name}`}>
            <Trash2 className="h-3.5 w-3.5" /> Remove
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
  return (
    <div>
      <p className="text-[13.5px]">
        {left > 0 ? <>You&apos;re <span className="font-semibold">{formatPrice(left)}</span> away from free delivery anywhere in Nepal</> : <span className="font-medium text-success">✓ You&apos;ve unlocked free delivery</span>}
      </p>
      <div className="mt-2 h-1 w-full bg-line"><div className={cn("h-full transition-all duration-500", left > 0 ? "bg-ink" : "bg-success")} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
