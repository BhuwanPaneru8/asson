"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { startStockCount } from "@/actions/admin/counts";

const sel = "h-10 w-full rounded-md border border-line bg-white px-2.5 text-[14px] outline-none focus:border-ink";

export function StartCount({ locations, categories }: { locations: { id: string; name: string }[]; categories: { id: string; name: string }[] }) {
  const [storeId, setStore] = useState(locations[0]?.id ?? "");
  const [categoryId, setCategory] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await startStockCount({ storeId, categoryId: categoryId || undefined }); if (r && !r.ok) toast.error(r.error); }); }}>
      <label className="text-[13px] font-medium text-ink-soft">Location<select className={`${sel} mt-1`} value={storeId} onChange={(e) => setStore(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label className="text-[13px] font-medium text-ink-soft">What to count<select className={`${sel} mt-1`} value={categoryId} onChange={(e) => setCategory(e.target.value)}><option value="">Everything (full stocktake)</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name} only (cycle count)</option>)}</select></label>
      <button disabled={pending || !storeId} className="h-10 self-end rounded-md bg-ink px-5 text-[14px] font-medium text-white disabled:opacity-40">{pending ? "Starting…" : "Start count"}</button>
    </form>
  );
}
