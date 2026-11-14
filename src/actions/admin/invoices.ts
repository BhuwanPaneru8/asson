"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { InvoiceError, recordPrint } from "@/lib/invoices";
import { reportError } from "@/lib/errors";

const schema = z.object({ kind: z.enum(["invoice", "credit"]), id: z.string().min(1).max(40) });

/** Count a print before the browser prints it: returns the copy number to show (0 = the original). */
export async function printDocument(input: z.input<typeof schema>): Promise<{ ok: true; copy: number } | { ok: false; error: string }> {
  const me = await requireStaff();
  if (!(["pos.sell", "orders", "finance"] as const).some((p) => can(me, p))) return { ok: false, error: "You can't print invoices." };
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Document not found." };
  try {
    const copy = await db.$transaction((tx) => recordPrint(tx, me, p.data.kind === "invoice" ? { invoiceId: p.data.id } : { creditNoteId: p.data.id }));
    return { ok: true, copy };
  } catch (e) {
    if (e instanceof InvoiceError) return { ok: false, error: e.message };
    void reportError("printDocument", e);
    return { ok: false, error: "Couldn't record the print. Try again." };
  }
}
