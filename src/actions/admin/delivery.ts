"use server";

import { audit, diff } from "@/lib/audit";
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
  await db.$transaction(async (tx) => {
    const before = new Map((await tx.deliveryRate.findMany({ where: { district: { in: parsed.data.map((r) => r.district) } } })).map((r) => [r.district, r]));
    const changed: Record<string, unknown> = {};
    const lines: string[] = [];
    for (const r of parsed.data) {
      const b = before.get(r.district);
      await tx.deliveryRate.upsert({
        where: { district: r.district },
        update: { ...r, updatedById: owner.id },
        create: { ...r, province: provinceOf(r.district)!, zone: zoneOf(r.district), updatedById: owner.id },
      });
      const d = b ? diff(b, r, ["fee", "etaMinDays", "etaMaxDays", "expressAvailable", "codAvailable", "serviceable"]) : { changes: { fee: [null, r.fee] as [unknown, unknown] }, text: "added" };
      if (Object.keys(d.changes).length) { changed[r.district] = d.changes; lines.push(`${r.district}: ${d.text}`); }
    }
    if (lines.length) await audit(tx, owner, { action: "delivery.rates", entity: ["DeliveryRate"], summary: lines.length <= 3 ? lines.join(" · ") : `${lines.length} districts changed — ${lines.slice(0, 2).join(" · ")} …`, changes: changed });
  }, { timeout: 30_000 });
  revalidateTag("delivery", { expire: 0 });
  refresh();
  return { ok: true, saved: parsed.data.length };
}
