"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeAddressAction, reduceItemAction, swapSizeAction } from "@/actions/admin/orders";
import { DISTRICTS } from "@/lib/config";
import { cn } from "@/lib/utils";
import { Card } from "./ui";

const input = "h-9 rounded-md border border-line bg-white px-2 text-[13.5px] outline-none focus:border-ink";
const btn = "h-9 rounded-md bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-40";
type Item = { id: string; name: string; color: string; size: string; quantity: number; sizes: { variantId: string; label: string }[] };
type Addr = { fullName: string; phone: string; line1: string; line2?: string | null; city: string; district: string; postalCode?: string | null };
const done = (r: { ok: boolean; error?: string }, msg: string) => { if (r.ok) toast.success(msg); else toast.error(r.error, { duration: 10_000 }); return r.ok; };

function ItemRow({ orderId, item, paid, canReduce }: { orderId: string; item: Item; paid: boolean; canReduce: boolean }) {
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(String(item.quantity));
  const [pending, start] = useTransition();
  return (
    <li className="space-y-1.5 py-2.5">
      <p className="text-[13.5px] font-medium">{item.name} · {item.color} {item.size} × {item.quantity}</p>
      <div className="flex flex-wrap items-center gap-2">
        {item.sizes.length > 0 && <>
          <select className={input} value={size} onChange={(e) => setSize(e.target.value)} aria-label={`New size for ${item.name} ${item.size}`}><option value="">Swap size…</option>{item.sizes.map((s) => <option key={s.variantId} value={s.variantId}>{s.label}</option>)}</select>
          {size && <button className={btn} disabled={pending} onClick={() => start(async () => { if (done(await swapSizeAction(orderId, item.id, size, item.quantity > 1 ? Number(qty) || item.quantity : undefined), "Size swapped: the new one is reserved")) setSize(""); })}>Swap{item.quantity > 1 ? ` ${Number(qty) || item.quantity}` : ""}</button>}
        </>}
        {!paid && canReduce && <>
          <select className={input} value={qty} onChange={(e) => setQty(e.target.value)} aria-label={`Quantity of ${item.name} ${item.size}`}>{Array.from({ length: item.quantity + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? "Remove" : `× ${n}`}</option>)}</select>
          {Number(qty) !== item.quantity && !size && <button className={cn(btn, Number(qty) === 0 && "bg-danger")} disabled={pending} onClick={() => start(async () => { done(await reduceItemAction(orderId, item.id, Number(qty)), Number(qty) === 0 ? "Item taken off" : "Quantity changed"); })}>{Number(qty) === 0 ? "Take off" : "Save"}</button>}
        </>}
      </div>
    </li>
  );
}

function AddressForm({ orderId, addr }: { orderId: string; addr: Addr }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ fullName: addr.fullName, phone: addr.phone, line1: addr.line1, line2: addr.line2 ?? "", city: addr.city, district: addr.district, postalCode: addr.postalCode ?? "" });
  const [pending, start] = useTransition();
  if (!open) return <button className="text-[13px] underline underline-offset-4" onClick={() => setOpen(true)}>Change the delivery address or phone</button>;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="grid gap-2">
      <input className={input} value={f.fullName} onChange={set("fullName")} aria-label="Recipient name" placeholder="Name" />
      <input className={input} value={f.phone} onChange={set("phone")} aria-label="Recipient phone" placeholder="Phone" inputMode="numeric" />
      <select className={input} value={f.district} onChange={set("district")} aria-label="District">{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select>
      <input className={input} value={f.city} onChange={set("city")} aria-label="City" placeholder="City / municipality" />
      <input className={input} value={f.line1} onChange={set("line1")} aria-label="Street" placeholder="Tole / street, house no." />
      <span className="flex gap-2">
        <button className={btn} disabled={pending} onClick={() => start(async () => { if (done(await changeAddressAction(orderId, f), "Address changed")) setOpen(false); })}>Save address</button>
        <button className="h-9 rounded-md border border-line px-3 text-[13px]" onClick={() => setOpen(false)}>Close</button>
      </span>
    </div>
  );
}

/** Before packing: swap sizes, take items off (unpaid orders), change the address. */
export function OrderEdit({ orderId, items, addr, paid }: { orderId: string; items: Item[]; addr: Addr | null; paid: boolean }) {
  return (
    <Card title="Change this order">
      <div className="px-5 py-3">
        <ul className="divide-y divide-line">{items.map((i) => <ItemRow key={i.id} orderId={orderId} item={i} paid={paid} canReduce={items.reduce((s, x) => s + x.quantity, 0) > 1} />)}</ul>
        {addr && <div className="border-t border-line pt-3"><AddressForm orderId={orderId} addr={addr} /></div>}
        <p className="mt-3 text-[12px] text-muted">{paid ? "Paid: sizes and the address can change; taking items off needs a refund, so cancel and re-order instead." : "Totals and the delivery fee are worked out again; the customer gets an SMS with the new total."}</p>
      </div>
    </Card>
  );
}
