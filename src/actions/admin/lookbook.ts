"use server";

import { refresh, revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fieldErrors } from "@/lib/validators";
import { isMediaUrl } from "@/lib/media-url";
import { slugify } from "@/lib/utils";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Products to add to a look (on sale only: a look must be shoppable). */
export async function lookProductSearch(q: string) {
  await requirePermission("catalog.edit");
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const rows = await db.product.findMany({
    where: { status: "ACTIVE", OR: [{ name: { contains: term, mode: "insensitive" } }, { tags: { has: term.toLowerCase() } }, { variants: { some: { sku: { equals: term, mode: "insensitive" } } } }] },
    select: { id: true, name: true, price: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } },
    orderBy: { soldCount: "desc" },
    take: 20,
  });
  return rows.map((p) => ({ id: p.id, name: p.name, price: p.price, image: p.images[0]?.url ?? null }));
}

const lookSchema = z.object({
  title: z.string().trim().min(3, "Give the look a title").max(80),
  slug: z.string().trim().max(80).optional(),
  subtitle: z.string().trim().max(140).optional(),
  story: z.string().trim().max(1200).optional(),
  heroImage: z.string().trim().refine((u) => !u || isMediaUrl(u) || /^https:\/\/[^\s]+$/.test(u), "Upload a photo or use an https:// image link").optional(),
  published: z.boolean(),
  position: z.coerce.number().int().min(0).max(999).default(0),
  items: z.array(z.object({ productId: z.string(), note: z.string().trim().max(120).optional() })).max(12, "Keep a look to 12 pieces or fewer"),
});
export type LookInput = z.input<typeof lookSchema>;

export async function saveLook(input: LookInput, id?: string): Promise<R<{ id: string }>> {
  const me = await requirePermission("catalog.edit");
  const p = lookSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the look.", fieldErrors: fieldErrors(p.error) };
  const d = p.data;
  const slug = slugify(d.slug || d.title);
  if (!slug) return { ok: false, error: "Give the look a title.", fieldErrors: { title: "Required" } };
  if (await db.look.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } })) return { ok: false, error: "Another look uses this web address.", fieldErrors: { slug: "Already used" } };
  const ids = [...new Set(d.items.map((i) => i.productId))];
  const live = await db.product.count({ where: { id: { in: ids }, status: "ACTIVE" } });
  if (d.published && live < 2) return { ok: false, error: "A published look needs at least two pieces that are on sale." };

  const saved = await db.$transaction(async (tx) => {
    const data = { title: d.title, slug, subtitle: d.subtitle || null, story: d.story || null, heroImage: d.heroImage || null, published: d.published, position: d.position };
    const before = id ? await tx.look.findUnique({ where: { id }, select: { published: true, title: true } }) : null;
    const look = id ? await tx.look.update({ where: { id }, data }) : await tx.look.create({ data });
    await tx.lookItem.deleteMany({ where: { lookId: look.id } });
    const seen = new Set<string>();
    await tx.lookItem.createMany({ data: d.items.filter((i) => !seen.has(i.productId) && seen.add(i.productId)).map((i, n) => ({ lookId: look.id, productId: i.productId, position: n, note: i.note || null })) });
    const state = d.published ? (before?.published ? "updated" : "published") : before?.published ? "unpublished" : "saved as draft";
    await audit(tx, me, { action: before ? "look.update" : "look.create", entity: ["Look", look.id], summary: `Lookbook “${d.title}” ${state} (${ids.length} piece${ids.length === 1 ? "" : "s"})` });
    return look;
  });
  revalidateTag("looks", { expire: 0 });
  revalidatePath("/lookbook");
  if (!id) redirect(`/admin/lookbook/${saved.id}`);
  refresh();
  return { ok: true, id: saved.id };
}

export async function deleteLook(id: string): Promise<R> {
  const me = await requirePermission("catalog.edit");
  const look = await db.look.findUnique({ where: { id }, select: { title: true } });
  if (!look) return { ok: false, error: "Already deleted." };
  await db.$transaction(async (tx) => {
    await tx.look.delete({ where: { id } });
    await audit(tx, me, { action: "look.delete", entity: ["Look", id], summary: `Lookbook “${look.title}” deleted` });
  });
  revalidateTag("looks", { expire: 0 });
  redirect("/admin/lookbook");
}
