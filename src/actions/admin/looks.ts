"use server";

import { audit } from "@/lib/audit";
import { refresh, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
export type PickerProduct = { id: string; name: string; image: string; status: string };

export async function searchProductsForLook(q: string, excludeId: string): Promise<PickerProduct[]> {
  await requirePermission("catalog.edit");
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const rows = await db.product.findMany({
    where: { id: { not: excludeId }, status: { not: "ARCHIVED" }, OR: [{ name: { contains: term, mode: "insensitive" } }, { variants: { some: { sku: { startsWith: term.toUpperCase() } } } }] },
    select: { id: true, name: true, status: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } },
    take: 8,
  });
  return rows.map((r) => ({ id: r.id, name: r.name, status: r.status, image: r.images[0]?.url ?? "" }));
}

/** Pairing is symmetric: if the shirt goes with the chinos, the chinos go with the shirt. */
export async function setLook(productId: string, pairIds: string[]): Promise<R> {
  const staff = await requirePermission("catalog.edit");
  const ids = z.array(z.string().min(1).max(40)).max(8).safeParse([...new Set(pairIds)].filter((i) => i !== productId));
  if (!ids.success) return { ok: false, error: "Pick up to 8 products." };
  await db.$transaction(async (tx) => {
    const current = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { pairsWith: { select: { id: true } }, pairedBy: { select: { id: true } } } });
    const old = [...new Set([...current.pairsWith, ...current.pairedBy].map((p) => p.id))];
    const p = await tx.product.update({ where: { id: productId }, data: { pairsWith: { set: ids.data.map((id) => ({ id })) }, pairedBy: { disconnect: old.filter((id) => !ids.data.includes(id)).map((id) => ({ id })) } }, select: { name: true } });
    await audit(tx, staff, { action: "product.look", entity: ["Product", productId], summary: `${p.name}: "Complete the look" set to ${ids.data.length} product${ids.data.length === 1 ? "" : "s"}`, changes: { pairs: [old, ids.data] } });
  });
  revalidateTag("products", { expire: 0 });
  refresh();
  return { ok: true };
}
