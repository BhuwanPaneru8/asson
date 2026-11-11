"use server";

import { audit } from "@/lib/audit";
import { formatPrice } from "@/lib/utils";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { CostError, postRecurring, saveRecurringCost } from "@/lib/shop-pl";
import { isMonthClosed } from "@/lib/month-close";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(["RENT", "SALARIES", "UTILITIES", "MARKETING", "PACKAGING", "DELIVERY", "EQUIPMENT", "FEES", "OTHER"]),
  // negative amounts are allowed — they correct a previous entry (expenses are never deleted)
  amount: z.number().refine((n) => n !== 0 && Math.abs(n) <= 100_000_000, "Enter an amount"),
  description: z.string().trim().min(2, "Describe the expense").max(200),
  paidVia: z.string().trim().max(40).optional(),
  storeId: z.string().max(40).optional(), // empty = HQ
});

export async function addExpense(input: z.input<typeof schema>): Promise<{ ok: boolean; error?: string }> {
  const me = await requirePermission("finance");
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  if (await isMonthClosed(p.data.date.slice(0, 7))) return { ok: false, error: `${p.data.date.slice(0, 7)} is closed, so expenses can't be added there. Reopen the month first (Finance → Month-end close).` };
  await db.$transaction(async (tx) => {
    if (p.data.storeId && !(await tx.store.findUnique({ where: { id: p.data.storeId }, select: { id: true } }))) throw new Error("Location not found");
    const e = await tx.expense.create({ data: { ...p.data, amount: Math.round(p.data.amount), paidVia: p.data.paidVia || null, storeId: p.data.storeId || null, createdById: me.id } });
    await audit(tx, me, { action: "expense.add", entity: ["Expense", e.id], summary: `${e.amount < 0 ? "Correction" : "Expense"} ${formatPrice(e.amount)} · ${e.category.toLowerCase()} · ${e.description}`, changes: { amount: e.amount, category: e.category, date: p.data.date } });
  });
  refresh();
  return { ok: true };
}

const recurringSchema = z.object({
  id: z.string().optional(),
  storeId: z.string().max(40).optional(),
  category: schema.shape.category,
  amount: z.number().int().min(1, "Enter the monthly amount").max(100_000_000),
  description: z.string().trim().min(2, "Describe the cost").max(200),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/, "Pick the first month"),
  endMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().or(z.literal("")),
  active: z.boolean(),
});

/** A monthly cost (rent, internet…) that posts itself to Expenses; this month's is posted at once. */
export async function saveRecurring(input: z.input<typeof recurringSchema>): Promise<{ ok: boolean; error?: string }> {
  const me = await requirePermission("finance");
  const p = recurringSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  try {
    await db.$transaction((tx) => saveRecurringCost(tx, me, { ...p.data, storeId: p.data.storeId || null, endMonth: p.data.endMonth || null }));
    await postRecurring();
  } catch (e) {
    if (e instanceof CostError) return { ok: false, error: e.message };
    void reportError("saveRecurring", e);
    return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
  }
  refresh();
  return { ok: true };
}
