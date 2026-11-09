"use server";

import { after } from "next/server";
import { refresh, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit, diff } from "@/lib/audit";
import { fieldErrors } from "@/lib/validators";
import { dispatchNotifications } from "@/lib/notifications";
import { lookupVariants } from "@/lib/pos";
import { StockError, stockByLocation } from "@/lib/stock";
import { markPicked } from "@/lib/picking";
import { cancelTransfer, createTransfer, receiveTransfer, sendTransfer, TransferError } from "@/lib/transfers";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

// ---------- Locations (owner) ----------

const locationSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,16}$/, "2–16 letters, numbers or -"),
  name: z.string().trim().min(2, "Enter a name").max(80),
  kind: z.enum(["SHOP", "WAREHOUSE"]),
  address: z.string().trim().min(2, "Enter the address").max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  hours: z.string().trim().max(80).optional().or(z.literal("")),
  priority: z.coerce.number().int().min(0).max(999),
  pickup: z.boolean(),
  active: z.boolean(),
});
export type LocationInput = z.input<typeof locationSchema>;

export async function saveLocation(input: LocationInput, id?: string): Promise<R> {
  const me = await requirePermission("locations");
  const p = locationSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(p.error) };
  const d = { ...p.data, phone: p.data.phone || null, hours: p.data.hours || null, pickup: p.data.kind === "SHOP" && p.data.pickup };
  const clash = await db.store.findFirst({ where: { code: d.code, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { ok: false, fieldErrors: { code: "Another location uses this code" }, error: "Please fix the highlighted fields." };

  if (id && !d.active) {
    // a location can only be switched off once it's empty and nothing is in flight
    const [units, shifts, transfers, picks] = await Promise.all([
      db.storeStock.aggregate({ where: { storeId: id }, _sum: { quantity: true } }),
      db.shift.count({ where: { storeId: id, status: "OPEN" } }),
      db.stockTransfer.count({ where: { OR: [{ fromId: id }, { toId: id }], status: { in: ["DRAFT", "SENT"] } } }),
      db.orderAllocation.count({ where: { storeId: id, pickedAt: null, order: { status: { in: ["PENDING", "CONFIRMED"] } } } }),
    ]);
    const why = [
      units._sum.quantity && `${units._sum.quantity} units are still there (transfer them out first)`,
      shifts && `${shifts} till shift is open`,
      transfers && `${transfers} transfer is open`,
      picks && `${picks} order line is waiting to be picked there`,
    ].filter(Boolean);
    if (why.length) return { ok: false, error: `Can't switch this location off: ${why.join("; ")}.` };
    const others = await db.store.count({ where: { active: true, NOT: { id } } });
    if (!others) return { ok: false, error: "Keep at least one active location." };
  }

  await db.$transaction(async (tx) => {
    const before = id ? await tx.store.findUniqueOrThrow({ where: { id }, select: { code: true, name: true, kind: true, address: true, phone: true, hours: true, priority: true, pickup: true, active: true } }) : null;
    const s = id ? await tx.store.update({ where: { id }, data: d }) : await tx.store.create({ data: d });
    if (!before) await audit(tx, me, { action: "location.create", entity: ["Store", s.id], summary: `Added ${d.kind === "SHOP" ? "shop" : "warehouse"} ${d.name} (${d.code})` });
    else {
      const { changes, text } = diff(before, d, ["code", "name", "kind", "address", "phone", "hours", "priority", "pickup", "active"]);
      if (Object.keys(changes).length) await audit(tx, me, { action: "location.update", entity: ["Store", s.id], summary: `${d.name}: ${text}`, changes });
    }
  });
  revalidateTag("catalog", { expire: 0 }); // pickup points shown at checkout
  if (!id) redirect("/admin/locations");
  refresh();
  return { ok: true };
}

// ---------- Transfers ----------

/** SKU / name search for the transfer form, with units at the source location. */
export async function transferLookup(query: string, fromId: string) {
  await requirePermission("transfers");
  const hits = await lookupVariants(query);
  const at = await stockByLocation(hits.map((h) => h.variantId));
  return hits.map((h) => ({ variantId: h.variantId, sku: h.sku, name: h.name, color: h.color, size: h.size, image: h.image, available: at.get(h.variantId)?.get(fromId) ?? 0 }));
}

const newTransferSchema = z.object({
  fromId: z.string().min(1, "Pick where it comes from"),
  toId: z.string().min(1, "Pick where it goes"),
  note: z.string().trim().max(500).optional(),
  items: z.array(z.object({ variantId: z.string(), quantity: z.number().int().min(1).max(10_000) })).min(1, "Add at least one item").max(300),
  sendNow: z.boolean().default(false),
});

function failure(e: unknown, where: string): { ok: false; error: string } {
  if (e instanceof TransferError || e instanceof StockError) return { ok: false, error: e.message };
  console.error(where, e);
  return { ok: false, error: "Couldn't update the transfer. Nothing was moved — please try again." };
}

export async function newTransfer(input: z.input<typeof newTransferSchema>): Promise<R<{ id: string }>> {
  const me = await requirePermission("transfers");
  const p = newTransferSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the transfer." };
  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      const t = await createTransfer(tx, me, p.data);
      if (p.data.sendNow) await sendTransfer(tx, me, t.id);
      return t.id;
    });
  } catch (e) {
    return failure(e, "newTransfer");
  }
  revalidateTag("products", { expire: 60 });
  redirect(`/admin/transfers/${id}`);
}

export async function sendStockTransfer(id: string): Promise<R> {
  const me = await requirePermission("transfers");
  try {
    await db.$transaction((tx) => sendTransfer(tx, me, id));
  } catch (e) {
    return failure(e, "sendStockTransfer");
  }
  revalidateTag("products", { expire: 60 });
  refresh();
  return { ok: true };
}

const receiveSchema = z.object({ id: z.string(), counts: z.record(z.string(), z.number().int().min(0).max(10_000)), note: z.string().trim().max(300).optional() });

export async function receiveStockTransfer(input: z.input<typeof receiveSchema>): Promise<R<{ short: number }>> {
  const me = await requirePermission("transfers");
  const p = receiveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Enter the counted quantities." };
  try {
    const r = await db.$transaction((tx) => receiveTransfer(tx, me, p.data.id, p.data.counts, p.data.note));
    revalidateTag("products", { expire: 60 });
    after(() => dispatchNotifications().catch((e) => console.error("dispatchNotifications", e)));
    refresh();
    return { ok: true, short: r.short };
  } catch (e) {
    return failure(e, "receiveStockTransfer");
  }
}

export async function cancelStockTransfer(id: string, reason: string): Promise<R> {
  const me = await requirePermission("transfers");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) return { ok: false, error: "Say why the transfer is cancelled." };
  try {
    await db.$transaction((tx) => cancelTransfer(tx, me, id, why));
  } catch (e) {
    return failure(e, "cancelStockTransfer");
  }
  revalidateTag("products", { expire: 60 });
  refresh();
  return { ok: true };
}

// ---------- Picking ----------

export async function pickOrder(orderId: string, storeId: string): Promise<R<{ remaining: number }>> {
  const me = await requirePermission("orders");
  const r = await db.$transaction((tx) => markPicked(tx, me, orderId, storeId));
  if (r.ok) refresh();
  return r;
}
