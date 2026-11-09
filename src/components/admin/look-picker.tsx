"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { Search, X, Shirt } from "lucide-react";
import { toast } from "sonner";
import { searchProductsForLook, setLook, type PickerProduct } from "@/actions/admin/looks";
import { Card } from "./ui";

export function LookPicker({ productId, initial, readOnly }: { productId: string; initial: PickerProduct[]; readOnly?: boolean }) {
  const [picked, setPicked] = useState(initial);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickerProduct[]>([]);
  const [saving, start] = useTransition();
  const dirty = picked.map((p) => p.id).join() !== initial.map((p) => p.id).join();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => searchProductsForLook(q, productId).then(setResults), 200);
    return () => clearTimeout(t);
  }, [q, productId]);

  return (
    <Card title="Complete the look" action={!readOnly && dirty ? (
      <button type="button" disabled={saving} onClick={() => start(async () => { const r = await setLook(productId, picked.map((p) => p.id)); if (r.ok) toast.success("Look saved"); else toast.error(r.error); })} className="h-8 rounded-md bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save look"}</button>
    ) : undefined}>
      <div className="space-y-3 p-4">
        <p className="text-[13px] text-muted">Products shown with this one on the product page (&ldquo;Complete the look&rdquo;). Pairing works both ways. Up to 8.</p>
        <ul className="flex flex-wrap gap-2">
          {picked.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-md border border-line bg-white py-1 pl-1 pr-2 text-[13px]">
              <span className="relative h-9 w-7 overflow-hidden rounded bg-cloud">{p.image ? <Image src={p.image} alt="" fill sizes="28px" className="object-cover" /> : <Shirt className="m-1.5 h-4 w-4 text-muted" />}</span>
              <span className="max-w-48 truncate">{p.name}</span>
              {!readOnly && <button type="button" onClick={() => setPicked(picked.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.name}`}><X className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
          {!picked.length && <li className="text-[13px] text-muted">Nothing paired yet.</li>}
        </ul>
        {!readOnly && picked.length < 8 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) setResults([]); }} placeholder="Search products to pair by name or SKU" aria-label="Search products to pair" className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-[14px] outline-none focus:border-ink" />
            {results.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-line bg-white shadow-lg">
                {results.filter((r) => !picked.some((p) => p.id === r.id)).map((r) => (
                  <li key={r.id}><button type="button" onClick={() => { setPicked([...picked, r]); setQ(""); setResults([]); }} className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13.5px] hover:bg-cloud">
                    <span className="relative h-9 w-7 shrink-0 overflow-hidden rounded bg-cloud">{r.image && <Image src={r.image} alt="" fill sizes="28px" className="object-cover" />}</span>
                    <span className="truncate">{r.name}</span>{r.status !== "ACTIVE" && <span className="ml-auto text-[11px] uppercase text-muted">{r.status.toLowerCase()}</span>}
                  </button></li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
