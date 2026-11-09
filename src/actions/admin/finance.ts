"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(["RENT", "SALARIES", "UTILITIES", "MARKETING", "PACKAGING", "DELIVERY", "EQUIPMENT", "FEES", "OTHER"]),
  // negative amounts are allowed — they correct a previous entry (expenses are never deleted)
  amount: z.number().refine((n) => n !== 0 && Math.abs(n) <= 100_000_000, "Enter an amount"),
  description: z.string().trim().min(2, "Describe the expense").max(200),
  paidVia: z.string().trim().max(40).optional(),
});

export async function addExpense(input: z.input<typeof schema>): Promise<{ ok: boolean; error?: string }> {
  const me = await requirePermission("finance");
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  await db.expense.create({ data: { ...p.data, amount: Math.round(p.data.amount), paidVia: p.data.paidVia || null, createdById: me.id } });
  refresh();
  return { ok: true };
}
