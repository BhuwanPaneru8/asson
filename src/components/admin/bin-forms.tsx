"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignBinAction, createBinsAction, importBinsAction } from "@/actions/admin/bins";

const input = "h-10 rounded-md border border-line bg-white px-3 text-[15px] outline-none focus:border-ink";
const btn = "h-10 rounded-md bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-40";

/** Scan (or type) a bin once, then scan sizes one after another: each goes into that bin. */
export function ScanAssign({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [bin, setBin] = useState("");
  const [sku, setSku] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const skuRef = useRef<HTMLInputElement>(null);
  const go = () => start(async () => {
    const r = await assignBinAction(storeId, sku, bin);
    if (r.ok) { setLog((l) => [`${r.result.sku} → ${r.result.code}${r.result.previous && r.result.previous !== r.result.code ? ` (was ${r.result.previous})` : ""}`, ...l].slice(0, 8)); setSku(""); skuRef.current?.focus(); router.refresh(); }
    else toast.error(r.error);
  });
  return (
    <div className="space-y-3 p-4">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (bin && sku) go(); }}>
        <input className={`${input} w-44 font-mono uppercase placeholder:font-sans placeholder:normal-case`} placeholder="Bin, e.g. A-03-2" value={bin} onChange={(e) => setBin(e.target.value)} aria-label="Bin" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); skuRef.current?.focus(); } }} />
        <input ref={skuRef} className={`${input} min-w-48 flex-1 font-mono placeholder:font-sans`} placeholder="Scan or type the SKU" value={sku} onChange={(e) => setSku(e.target.value)} aria-label="SKU" />
        <button className={btn} disabled={pending || !bin || !sku}>{pending ? "…" : "Put in bin"}</button>
      </form>
      {log.length > 0 && <ul className="space-y-0.5 font-mono text-[13px] text-ink-soft">{log.map((l, i) => <li key={i}>✓ {l}</li>)}</ul>}
      <p className="text-[12px] text-muted">The bin stays filled in, so you can scan a whole shelf: one size after another.</p>
    </div>
  );
}

export function BulkBins({ storeId }: { storeId: string }) {
  const [mode, setMode] = useState<"import" | "create">("import");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 p-4">
      <div className="flex gap-1.5 text-[13px]">
        {(["import", "create"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full border px-3 py-1 ${mode === m ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>{m === "import" ? "Import SKU, BIN" : "Add empty bins"}</button>)}
      </div>
      <textarea className={`${input} h-40 w-full py-2 font-mono text-[13px]`} value={text} onChange={(e) => setText(e.target.value)} aria-label={mode === "import" ? "SKU and bin lines" : "Bin codes"} placeholder={mode === "import" ? "SKU,BIN\nKRT-BLU-M,A-03-2\nKRT-BLU-L,A-03-2" : "A-01-1\nA-01-2\nA-02-1"} />
      <button className={btn} disabled={pending || !text.trim()} onClick={() => start(async () => {
        if (mode === "import") { const r = await importBinsAction(storeId, text); if (r.ok) { toast.success(`${r.result.assigned} size(s) given a bin (${r.result.bins} bins)`); setText(""); } else toast.error(r.error); }
        else { const r = await createBinsAction(storeId, text); if (r.ok) { toast.success(`${r.result.added} bin(s) added${r.result.existing ? `, ${r.result.existing} already there` : ""}`); setText(""); } else toast.error(r.error); }
      })}>{pending ? "Saving…" : mode === "import" ? "Import" : "Add bins"}</button>
      <p className="text-[12px] text-muted">{mode === "import" ? "Paste from a spreadsheet: one SKU and bin per line (commas or tabs). Nothing is saved if any line is wrong; new bin codes are created." : "One code per line: letters, numbers and dashes (A-03-2 = zone A, aisle 3, shelf 2)."}</p>
    </div>
  );
}
