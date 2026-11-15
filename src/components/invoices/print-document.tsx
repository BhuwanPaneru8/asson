"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { printDocument } from "@/actions/admin/invoices";
import type { DocView } from "@/lib/invoices";
import { TaxDocument } from "./tax-document";

export const copyLabel = (copy: number) => (copy > 0 ? `Copy of original (${copy})` : null);

/**
 * Prints a tax document and counts it: the first print is the original, every later one says "Copy of original
 * (n)" (Electronic Billing Procedure 2074 §6). The page's own print (Ctrl+P) shows a note instead of the document,
 * so every paper copy goes through here and is numbered and audited.
 */
export function PrintDocument({ doc, size, note }: { doc: DocView; size: "thermal" | "a4"; note?: React.ReactNode }) {
  const [copy, setCopy] = useState(doc.nextCopy);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  async function print() {
    setBusy(true);
    const r = await printDocument({ kind: doc.kind, id: doc.id });
    setBusy(false);
    if (!r.ok) { toast.error(r.error); return; }
    flushSync(() => { setCopy(r.copy); setArmed(true); });
    window.print();
    // the next print is the next copy
    flushSync(() => { setCopy(r.copy + 1); setArmed(false); });
  }
  return (
    <>
      <div className={armed ? "" : "print:hidden"}><TaxDocument doc={doc} size={size} copy={copyLabel(copy)} note={note} /></div>
      {!armed && <p className="hidden p-6 text-[14px] print:block">Print this document with its Print button, so the copy is numbered.</p>}
      <div className="mt-4 flex justify-center print:hidden">
        <button type="button" onClick={print} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-[14px] text-white disabled:opacity-60">
          <Printer className="h-4 w-4" aria-hidden /> {copy > 0 ? `Print copy (${copy})` : "Print"}
        </button>
      </div>
    </>
  );
}
