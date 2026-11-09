"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordCodRemittance } from "@/actions/admin/orders";
import { cn, formatPrice } from "@/lib/utils";
import { Card } from "./ui";

type O = { id: string; number: string; total: number; tracking: string | null; deliveredOn: string; name: string; ageDays: number };

export function CodRemitForm({ carrier, orders }: { carrier: string; orders: O[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ref, setRef] = useState("");
  const [received, setReceived] = useState("");
  const [pending, start] = useTransition();
  const expected = orders.filter((o) => sel.has(o.id)).reduce((s, o) => s + o.total, 0);
  const diff = received === "" ? null : Math.round(Number(received) * 100) - expected;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = () => start(async () => {
    const r = await recordCodRemittance({ carrier, reference: ref, received: Math.round(Number(received) * 100), orderIds: [...sel] });
    if (r.ok) { toast.success("Remittance recorded"); setSel(new Set()); setRef(""); setReceived(""); } else toast.error(r.error);
  });
  const total = orders.reduce((s, o) => s + o.total, 0);
  return (
    <Card title={`${carrier} · ${orders.length} orders · ${formatPrice(total)} owed`}>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-[13.5px]">
          <thead className="sticky top-0 bg-white"><tr className="text-left text-[11.5px] uppercase tracking-wider text-muted"><th className="w-10 px-4 py-2"><input type="checkbox" aria-label="Select all" className="accent-ink" checked={sel.size === orders.length} onChange={() => setSel(sel.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)))} /></th><th>Order</th><th>Customer</th><th>AWB</th><th>Delivered</th><th className="px-4 text-right">COD</th></tr></thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className={sel.has(o.id) ? "bg-accent-soft/40" : ""}>
                <td className="px-4 py-2"><input type="checkbox" aria-label={`Select ${o.number}`} className="accent-ink" checked={sel.has(o.id)} onChange={() => toggle(o.id)} /></td>
                <td className="font-medium">{o.number}</td><td>{o.name}</td><td className="font-mono text-[12px] text-muted">{o.tracking ?? "—"}</td>
                <td className={cn("text-muted", o.ageDays > 14 && "font-medium text-danger")}>{o.deliveredOn}{o.ageDays > 14 ? ` (${o.ageDays}d)` : ""}</td>
                <td className="px-4 text-right tabular-nums">{formatPrice(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line p-4 text-[13.5px]">
        <span className="font-medium">{sel.size} selected · expected {formatPrice(expected)}</span>
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Bank / statement reference" aria-label="Remittance reference" className="h-9 w-56 rounded-md border border-line px-3" />
        <input value={received} onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Amount received (Rs)" inputMode="decimal" aria-label="Amount received" className="h-9 w-44 rounded-md border border-line px-3 text-right" />
        {diff !== null && sel.size > 0 && <span className={diff === 0 ? "text-success" : "font-medium text-danger"}>{diff === 0 ? "✓ Matches" : `${diff < 0 ? "Short" : "Over"} by ${formatPrice(Math.abs(diff))}`}</span>}
        <button onClick={save} disabled={pending || !sel.size || !ref.trim() || received === ""} className="ml-auto h-9 rounded-md bg-ink px-4 text-white disabled:opacity-40">Record remittance</button>
      </div>
    </Card>
  );
}
