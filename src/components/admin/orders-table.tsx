"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { toast } from "sonner";
import { bulkUpdateStatus } from "@/actions/admin/orders";
import { formatDateTime, formatOrderNumber, formatPrice } from "@/lib/utils";
import { StatusPill, Pill, Th, Td, AdminPager } from "./ui";

type Row = { id: string; number: number; name: string; email: string; city: string; status: OrderStatus; paymentMethod: string; paymentStatus: string; total: number; items: number; createdAt: string; risk?: { level: "high" | "medium" | "low"; reasons: string[] } | null };

const BULK: { to: OrderStatus; label: string }[] = [
  { to: "CONFIRMED", label: "Mark confirmed" },
  { to: "PACKED", label: "Mark packed" },
  { to: "DELIVERED", label: "Mark delivered" },
];

export function OrdersTable({ orders, page, pages, total }: { orders: Row[]; page: number; pages: number; total: number }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const pathname = usePathname();
  const params = useSearchParams();
  const all = orders.length > 0 && orders.every((o) => sel.has(o.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const bulk = (to: OrderStatus) => start(async () => {
    const r = await bulkUpdateStatus([...sel], to);
    if (r.ok) { toast.success(r.message); setSel(new Set()); } else toast.error(r.error);
  });

  const href = (p: number) => { const n = new URLSearchParams(params.toString()); n.set("page", String(p)); return `${pathname}?${n}`; };

  if (!orders.length) return <p className="p-10 text-center text-[14px] text-muted">No orders match these filters.</p>;
  return (
    <>
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-cloud/60 px-4 py-2.5 text-[13.5px]">
          <span className="font-medium">{sel.size} selected</span>
          {BULK.map((b) => <button key={b.to} disabled={pending} onClick={() => bulk(b.to)} className="rounded-md border border-line bg-white px-3 py-1.5 hover:border-ink disabled:opacity-50">{b.label}</button>)}
          <button onClick={() => setSel(new Set())} className="ml-auto text-muted underline">Clear</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead className="border-b border-line bg-cloud/40">
            <tr>
              <Th className="w-10"><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? new Set() : new Set(orders.map((o) => o.id)))} className="h-4 w-4 accent-ink" /></Th>
              <Th>Order</Th><Th>Customer</Th><Th>Date</Th><Th>Status</Th><Th>Payment</Th><Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className={sel.has(o.id) ? "bg-accent-soft/40" : "hover:bg-cloud/40"}>
                <Td><input type="checkbox" aria-label={`Select ${formatOrderNumber(o.number)}`} checked={sel.has(o.id)} onChange={() => toggle(o.id)} className="h-4 w-4 accent-ink" /></Td>
                <Td><Link href={`/admin/orders/${o.id}`} className="font-semibold hover:underline">{formatOrderNumber(o.number)}</Link><p className="text-[12.5px] text-muted">{o.items} item{o.items > 1 && "s"}</p>{o.risk && o.risk.level !== "low" && <span title={o.risk.reasons.join("; ")} className="mt-1 inline-block"><Pill tone={o.risk.level === "high" ? "danger" : "warn"}>{o.risk.level} COD risk</Pill></span>}</Td>
                <Td><p>{o.name || "—"}</p><p className="text-[12.5px] text-muted">{o.city || o.email}</p></Td>
                <Td className="whitespace-nowrap text-muted">{formatDateTime(o.createdAt)}</Td>
                <Td><StatusPill status={o.status} /></Td>
                <Td><Pill tone={o.paymentStatus === "PAID" ? "success" : o.paymentStatus === "REFUNDED" ? "warn" : "neutral"}>{o.paymentMethod === "COD" ? "COD" : o.paymentMethod === "IN_STORE" ? "Store" : "Prepaid"} · {o.paymentStatus.toLowerCase()}</Pill></Td>
                <Td className="text-right font-medium tabular-nums">{formatPrice(o.total)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminPager page={page} pages={pages} href={href} />
      <p className="sr-only">{total} orders</p>
    </>
  );
}
