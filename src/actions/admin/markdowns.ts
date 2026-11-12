"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { addItems, cancelEvent, createEvent, endEvent, MarkdownError, removeItem, scheduleEvent, setItemPrice } from "@/lib/markdowns";

async function run<T>(where: string, f: () => Promise<T>) {
  try { const r = await f(); refresh(); return { ok: true as const, result: r }; } catch (e) {
    if (e instanceof MarkdownError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
}
/** "2026-12-01T10:00" typed in Nepal time → a Date. */
const ktm = (s: string) => new Date(`${s}:00+05:45`);

const createSchema = z.object({ name: z.string().max(80), startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).or(z.literal("")) });
export async function createEventAction(input: z.input<typeof createSchema>) {
  const me = await requirePermission("catalog.edit");
  const p = createSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Choose when the sale starts." };
  return run("createEvent", async () => (await db.$transaction((tx) => createEvent(tx, me, { name: p.data.name, startsAt: ktm(p.data.startsAt), endsAt: p.data.endsAt ? ktm(p.data.endsAt) : null }))).id);
}

const addSchema = z.object({ eventId: z.string(), percentOff: z.number().nullable().optional(), price: z.number().int().nullable().optional(), productIds: z.array(z.string()).max(2000).optional(), categoryId: z.string().optional(), query: z.string().max(80).optional() });
export async function addItemsAction(input: z.input<typeof addSchema>) {
  const me = await requirePermission("catalog.edit");
  const p = addSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Check the products and the markdown." };
  return run("addItems", async () => {
    let ids = p.data.productIds ?? [];
    if (!ids.length && (p.data.categoryId || p.data.query?.trim())) {
      const q = p.data.query?.trim();
      ids = (await db.product.findMany({ where: { status: "ACTIVE", ...(p.data.categoryId ? { categoryId: p.data.categoryId } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { variants: { some: { sku: { equals: q, mode: "insensitive" } } } }] } : {}) }, select: { id: true }, take: 2000 })).map((x) => x.id);
      if (!ids.length) throw new MarkdownError("No active products match.");
    }
    return db.$transaction((tx) => addItems(tx, me, p.data.eventId, { productIds: ids, percentOff: p.data.percentOff ?? null, price: p.data.price ?? null }), { timeout: 60_000 });
  });
}
export async function setItemPriceAction(eventId: string, productId: string, price: number) {
  await requirePermission("catalog.edit");
  return run("setItemPrice", () => db.$transaction((tx) => setItemPrice(tx, String(eventId), String(productId), Number(price))));
}
export async function removeItemAction(eventId: string, productId: string) {
  await requirePermission("catalog.edit");
  return run("removeItem", () => db.$transaction((tx) => removeItem(tx, String(eventId), String(productId))));
}
export async function scheduleEventAction(eventId: string, allowBelowMargin: boolean) {
  const me = await requirePermission("catalog.edit");
  return run("scheduleEvent", () => db.$transaction((tx) => scheduleEvent(tx, me, String(eventId), { allowBelowMargin: !!allowBelowMargin }), { timeout: 60_000 }));
}
export async function endEventAction(eventId: string) {
  const me = await requirePermission("catalog.edit");
  return run("endEvent", () => db.$transaction((tx) => endEvent(tx, String(eventId), me), { timeout: 60_000 }));
}
export async function cancelEventAction(eventId: string) {
  const me = await requirePermission("catalog.edit");
  return run("cancelEvent", () => db.$transaction((tx) => cancelEvent(tx, me, String(eventId))));
}
