"use server";

import { refresh, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { DISTRICTS, provinceOf, zoneOf } from "@/lib/config";

const rowSchema = z.object({
  district: z.string().refine((d) => DISTRICTS.includes(d), "Unknown district"),
  fee: z.number().int().min(0).max(500000), // paisa, up to Rs 5,000
  etaMinDays: z.number().int().min(0).max(30),
  etaMaxDays: z.number().int().min(0).max(45),
  expressAvailable: z.boolean(),
  codAvailable: z.boolean(),
  serviceable: z.boolean(),
}).refine((r) => r.etaMaxDays >= r.etaMinDays, { message: "Max days must be ≥ min days", path: ["etaMaxDays"] });

export async function saveDeliveryRates(rows: unknown): Promise<{ ok: boolean; error?: string; saved?: number }> {
  const owner = await requireAdmin();
  const parsed = z.array(rowSchema).max(DISTRICTS.length).safeParse(rows);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: `Row ${Number(i.path[0]) + 1}: ${i.message}` };
  }
  await db.$transaction(
    parsed.data.map((r) =>
      db.deliveryRate.upsert({
        where: { district: r.district },
        update: { ...r, updatedById: owner.id },
        create: { ...r, province: provinceOf(r.district)!, zone: zoneOf(r.district), updatedById: owner.id },
      }),
    ),
  );
  revalidateTag("delivery", { expire: 0 });
  refresh();
  return { ok: true, saved: parsed.data.length };
}
