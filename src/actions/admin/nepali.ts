"use server";

import { refresh, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit, diff } from "@/lib/audit";

const schema = z.object({
  kind: z.enum(["category", "collection"]),
  id: z.string().min(1),
  nameNe: z.string().trim().max(120),
  descriptionNe: z.string().trim().max(2000),
});

/** Nepali name and description of a category or collection (blank = shoppers reading Nepali see the English). */
export async function saveNepaliNames(input: z.input<typeof schema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requirePermission("catalog.edit");
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Names can be up to 120 characters, descriptions up to 2,000." };
  const { kind, id } = p.data;
  const next = { nameNe: p.data.nameNe || null, descriptionNe: p.data.descriptionNe || null };
  const done = await db.$transaction(async (tx) => {
    const row = kind === "category"
      ? await tx.category.findUnique({ where: { id }, select: { name: true, nameNe: true, descriptionNe: true } })
      : await tx.collection.findUnique({ where: { id }, select: { name: true, nameNe: true, descriptionNe: true } });
    if (!row) return false;
    if (kind === "category") await tx.category.update({ where: { id }, data: next });
    else await tx.collection.update({ where: { id }, data: next });
    const { changes, text } = diff({ nameNe: row.nameNe, descriptionNe: row.descriptionNe }, next, ["nameNe", "descriptionNe"]);
    await audit(tx, me, { action: `${kind}.nepali`, entity: [kind === "category" ? "Category" : "Collection", id], summary: `Nepali text for ${kind} “${row.name}”${text ? `: ${text}` : " (no change)"}`, changes });
    return true;
  });
  if (!done) return { ok: false, error: `That ${kind} no longer exists.` };
  revalidateTag("catalog", { expire: 0 });
  refresh();
  return { ok: true };
}
