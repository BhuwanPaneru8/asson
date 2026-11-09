"use server";

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { DISTRICTS } from "@/lib/config";
import { reportError } from "@/lib/errors";
import { openingAssortment, openShop, type OpeningPlan } from "@/lib/rollout";
import { StockError } from "@/lib/stock";
import { TransferError } from "@/lib/transfers";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const plan = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("copy"), fromStoreId: z.string().min(1, "Choose the shop to copy"), percent: z.coerce.number().int().min(10).max(200) }),
  z.object({ mode: z.literal("bestsellers"), products: z.coerce.number().int().min(1).max(300), perSize: z.coerce.number().int().min(1).max(10) }),
]);

/** How much opening stock a template would send (for the form, before committing). */
export async function previewOpening(warehouseId: string, input: z.input<typeof plan>): Promise<R<{ sizes: number; units: number }>> {
  await requirePermission("locations");
  const p = plan.safeParse(input);
  if (!p.success || !warehouseId) return { ok: false, error: "Choose a warehouse and a template." };
  const lines = await db.$transaction((tx) => openingAssortment(tx, warehouseId, p.data as OpeningPlan));
  return { ok: true, sizes: lines.length, units: lines.reduce((s, l) => s + l.quantity, 0) };
}

const schema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,16}$/, "Short code: 2–16 letters, numbers or -"),
  name: z.string().trim().min(2, "Name the shop").max(80),
  district: z.string().refine((d) => DISTRICTS.includes(d), "Choose the district"),
  address: z.string().trim().min(2, "Enter the address").max(200),
  phone: z.string().trim().max(30).optional(),
  hours: z.string().trim().max(80).optional(),
  pickup: z.boolean(),
  shipsOnline: z.boolean(),
  priority: z.coerce.number().int().min(0).max(999).default(100),
  staffIds: z.array(z.string()).max(50),
  warehouseId: z.string().min(1, "Choose the warehouse that sends the opening stock"),
  plan,
});

export async function openNewShop(input: z.input<typeof schema>): Promise<R> {
  const me = await requirePermission("locations");
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the details." };
  if (await db.store.findUnique({ where: { code: p.data.code }, select: { id: true } })) return { ok: false, error: `Code ${p.data.code} is already used by another location.` };
  let result: Awaited<ReturnType<typeof openShop>>;
  try {
    result = await db.$transaction((tx) => openShop(tx, me, { ...p.data, plan: p.data.plan as OpeningPlan }), { timeout: 60_000 });
  } catch (e) {
    if (e instanceof TransferError || e instanceof StockError || (e instanceof Error && e.message.startsWith("Choose"))) return { ok: false, error: e.message };
    void reportError("openNewShop", e);
    return { ok: false, error: "Couldn't open the shop. Nothing was created — please try again." };
  }
  revalidateTag("catalog", { expire: 0 });
  redirect(result.transferId ? `/admin/transfers/${result.transferId}` : "/admin/locations");
}
