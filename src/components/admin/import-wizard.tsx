"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Download, FileSpreadsheet, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { previewImport, runImport, type ImportPreview } from "@/actions/admin/import";
import { formatPrice } from "@/lib/utils";

type Done = { created: number; updated: number; products: { id: string; slug: string; action: string }[] };

export function ImportWizard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  const [over, setOver] = useState(false);

  async function choose(f: File | undefined) {
    if (!f) return;
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") {
      toast.error(/\.xlsx?$/i.test(f.name) ? "Save the spreadsheet as CSV first (File → Save As / Download → CSV)" : "Choose a .csv file");
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, text });
    setDone(null);
    start(async () => setPreview(await previewImport(text)));
  }

  const confirm = () => start(async () => {
    if (!file) return;
    const r = await runImport(file.text);
    if (r.ok) {
      setDone({ created: r.created ?? 0, updated: r.updated ?? 0, products: r.products ?? [] });
      setPreview(null);
      toast.success("Import finished");
    } else toast.error(r.error ?? "Import failed");
  });

  const reset = () => { setFile(null); setPreview(null); setDone(null); };

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-white p-5">
        <h2 className="mb-3 text-[15px] font-semibold">1. Get the spreadsheet</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/admin/products/import/template.csv" className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 text-[14px] hover:border-ink"><Download className="h-4 w-4" /> Blank template</a>
          <a href="/admin/products/export.csv" className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 text-[14px] hover:border-ink"><Download className="h-4 w-4" /> Current catalogue (to edit)</a>
        </div>
        <p className="mt-3 text-[13px] text-muted">Open it in Excel, Google Sheets or Numbers. When done, save or download it as <b>CSV</b>.</p>
      </section>

      <section className="rounded-md border border-line bg-white p-5">
        <h2 className="mb-3 text-[15px] font-semibold">2. Upload and check</h2>
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void choose(e.dataTransfer.files[0]); }}
          className={`flex flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center ${over ? "border-ink bg-cloud" : "border-line"}`}
        >
          <FileSpreadsheet className="h-6 w-6 text-muted" aria-hidden />
          <p className="text-[14px]">{file ? <b className="break-all">{file.name}</b> : "Drag the CSV file here or"}{" "}
            <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="font-medium underline">{file ? "choose another" : "choose a file"}</button>
          </p>
          <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
          {pending && !preview && <p className="text-[13px] text-muted">Checking every row…</p>}
        </div>
      </section>

      {preview && <PreviewView p={preview} pending={pending} onConfirm={confirm} onReset={reset} />}

      {done && (
        <section className="rounded-md border border-success/40 bg-[#edf5ef] p-5">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-success"><CheckCircle2 className="h-5 w-5" /> Imported: {done.created} new, {done.updated} updated</p>
          <p className="mt-2 text-[13.5px] text-ink-soft">New products are drafts unless your file said active. Add photos and publish them from the product page.</p>
          <ul className="mt-3 max-h-64 space-y-1 overflow-auto text-[13.5px]">
            {done.products.map((p) => <li key={p.id}><Link className="underline" href={`/admin/products/${p.id}`}>{p.slug}</Link> <span className="text-muted">— {p.action === "create" ? "new" : "updated"}</span></li>)}
          </ul>
          <button type="button" onClick={reset} className="mt-4 text-[13.5px] underline">Import another file</button>
        </section>
      )}
    </div>
  );
}

function PreviewView({ p, pending, onConfirm, onReset }: { p: ImportPreview; pending: boolean; onConfirm: () => void; onReset: () => void }) {
  const blocked = !p.ok;
  return (
    <section className="rounded-md border border-line bg-white">
      <div className="border-b border-line p-5">
        <h2 className="text-[15px] font-semibold">3. Preview</h2>
        <p className="mt-1 text-[14px]">
          {p.summary.create} new product{p.summary.create === 1 ? "" : "s"} · {p.summary.update} to update · {p.summary.newVariants} new colour/size variants · {p.summary.units.toLocaleString("en-IN")} units of stock
        </p>
        {p.error && <p className="mt-2 text-[13.5px] text-danger">{p.error}</p>}
        {p.unknownColumns.length > 0 && <p className="mt-2 text-[13px] text-warn">Ignored columns: {p.unknownColumns.join(", ")}</p>}
      </div>

      {p.errors.length > 0 && (
        <div className="border-b border-line bg-[#fbe9e7] p-5">
          <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-danger"><AlertCircle className="h-4 w-4" /> Fix {p.errors.length} problem{p.errors.length > 1 ? "s" : ""} in the spreadsheet, then upload it again</p>
          <ul className="max-h-72 space-y-1 overflow-auto text-[13.5px]">{p.errors.map((e, i) => <li key={i}><b>Row {e.row}:</b> {e.message}</li>)}</ul>
        </div>
      )}
      {p.warnings.length > 0 && (
        <div className="border-b border-line bg-[#fbf1df] p-5">
          <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-warn"><AlertTriangle className="h-4 w-4" /> Worth a look ({p.warnings.length})</p>
          <ul className="max-h-48 space-y-1 overflow-auto text-[13.5px]">{p.warnings.map((e, i) => <li key={i}><b>Row {e.row}:</b> {e.message}</li>)}</ul>
        </div>
      )}

      {p.products.length > 0 && (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-[13.5px]">
            <thead className="sticky top-0 bg-white text-left text-[12px] uppercase tracking-wider text-muted shadow-[0_1px_0_var(--color-line)]">
              <tr><th className="px-5 py-2">Product</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Category</th><th className="px-2 py-2 text-right">Price</th><th className="px-2 py-2 text-right">New variants</th><th className="px-5 py-2 text-right">Units</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {p.products.map((x) => (
                <tr key={x.handle}>
                  <td className="px-5 py-2"><p className="font-medium">{x.name}</p><p className="text-[12px] text-muted">{x.handle}{x.images ? ` · ${x.images} photo${x.images > 1 ? "s" : ""}` : ""}</p></td>
                  <td className="px-2 py-2">{x.action === "create" ? "New" : <span title={x.changes.join(", ")}>Update{x.changes.length ? ` (${x.changes.length} field${x.changes.length > 1 ? "s" : ""})` : ""}</span>}</td>
                  <td className="px-2 py-2">{x.category ?? "—"}</td>
                  <td className="px-2 py-2 text-right">{x.price != null ? formatPrice(x.price) : "—"}</td>
                  <td className="px-2 py-2 text-right">{x.newVariants}</td>
                  <td className="px-5 py-2 text-right">{x.units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line p-5">
        <button type="button" disabled={blocked || pending} onClick={onConfirm} className="inline-flex h-10 items-center rounded-md bg-ink px-5 text-[14px] text-white disabled:opacity-40">
          {pending ? "Importing…" : `Import ${p.products.length} product${p.products.length === 1 ? "" : "s"}`}
        </button>
        <button type="button" onClick={onReset} className="text-[13.5px] underline">Start over</button>
        {blocked && p.errors.length > 0 && <span className="text-[13px] text-muted">Nothing is imported while there are problems.</span>}
      </div>
    </section>
  );
}
