"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { addNote, CareError, openCase, replyToCustomer, updateCase } from "@/lib/care";
import { reportError } from "@/lib/errors";
import { dispatchNotifications } from "@/lib/notifications";
import { ScopeError } from "@/lib/scope";
import { parseOrderNumber } from "@/lib/utils";

type R = { ok: true; number?: number } | { ok: false; error: string };

async function run(where: string, f: () => Promise<number | void>): Promise<R> {
  let n: number | void;
  try { n = await f(); } catch (e) {
    if (e instanceof CareError || e instanceof ScopeError) return { ok: false, error: e.message };
    void reportError(where, e);
    return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
  }
  refresh();
  return n ? { ok: true, number: n } : { ok: true };
}

const category = z.enum(["ORDER", "DELIVERY", "PAYMENT", "QUALITY", "EXCHANGE", "SERVICE", "OTHER"]);
const priority = z.enum(["LOW", "NORMAL", "URGENT"]);

const logSchema = z.object({
  channel: z.enum(["PHONE", "WHATSAPP", "SHOP", "EMAIL", "SOCIAL"]),
  category, priority,
  name: z.string().trim().min(2, "Customer's name").max(80),
  phone: z.string().trim().max(20).default(""),
  email: z.string().trim().max(120).default(""),
  order: z.string().trim().max(20).default(""),
  storeId: z.string().default(""),
  subject: z.string().trim().min(3, "Say what it's about").max(120),
  message: z.string().trim().min(3, "Write what the customer said").max(4000),
});

/** Log a complaint that came by phone, WhatsApp, a shop counter, email or social media. */
export async function logCase(input: z.input<typeof logSchema>): Promise<R> {
  const me = await requirePermission("care");
  const p = logSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the case." };
  const d = p.data;
  return run("logCase", async () => {
    let orderId: string | null = null, userId: string | null = null;
    if (d.order) {
      const n = parseOrderNumber(d.order);
      const o = n ? await db.order.findUnique({ where: { number: n }, select: { id: true, userId: true } }) : null;
      if (!o) throw new CareError("No order with that number.");
      orderId = o.id; userId = o.userId;
    }
    const c = await db.$transaction((tx) => openCase(tx, { channel: d.channel, category: d.category, priority: d.priority, subject: d.subject, message: d.message, name: d.name, phone: d.phone || null, email: d.email || null, orderId, userId, storeId: d.storeId || null }, me));
    return c.number;
  });
}

export async function replyCase(id: string, body: string, resolve: boolean): Promise<R> {
  const me = await requirePermission("care");
  const r = await run("replyCase", () => db.$transaction((tx) => replyToCustomer(tx, me, id, String(body ?? "").slice(0, 4000), { resolve: !!resolve })));
  if (r.ok) after(() => dispatchNotifications(10).catch((e) => reportError("care.sms", e)));
  return r;
}

export async function noteCase(id: string, body: string): Promise<R> {
  const me = await requirePermission("care");
  return run("noteCase", () => db.$transaction((tx) => addNote(tx, me, id, String(body ?? "").slice(0, 4000))));
}

const updateSchema = z.object({
  status: z.enum(["OPEN", "WAITING", "RESOLVED"]).optional(),
  assigneeId: z.string().nullable().optional(),
  priority: priority.optional(), category: category.optional(),
  storeId: z.string().nullable().optional(),
  order: z.string().max(20).nullable().optional(),
});

export async function updateCaseAction(id: string, input: z.input<typeof updateSchema>): Promise<R> {
  const me = await requirePermission("care");
  const p = updateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the change." };
  const { order, ...rest } = p.data;
  const orderNumber = order === undefined ? undefined : order ? parseOrderNumber(order) : null;
  if (order && !orderNumber) return { ok: false, error: "That isn't an order number." };
  return run("updateCase", () => db.$transaction((tx) => updateCase(tx, me, id, { ...rest, orderNumber })));
}
