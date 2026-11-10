"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { acknowledge, OpsError, publishAnnouncement, saveTemplate, tick } from "@/lib/ops";
import { ScopeError } from "@/lib/scope";

type R = { ok: true } | { ok: false; error: string };

async function run(where: string, f: () => Promise<unknown>): Promise<R> {
  try { await f(); } catch (e) {
    if (e instanceof OpsError || e instanceof ScopeError) return { ok: false, error: e.message };
    void reportError(where, e);
    return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
  }
  refresh();
  return { ok: true };
}

const annSchema = z.object({ title: z.string().trim().min(3, "Give it a title").max(120), body: z.string().trim().min(3, "Write the message").max(4000), storeIds: z.array(z.string()).max(200), requiresAck: z.boolean(), expiresInDays: z.coerce.number().int().min(0).max(365).default(0) });

export async function sendAnnouncement(input: z.input<typeof annSchema>): Promise<R> {
  const me = await requirePermission("ops.manage");
  const p = annSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the message." };
  const { expiresInDays, ...d } = p.data;
  return run("sendAnnouncement", () => db.$transaction((tx) => publishAnnouncement(tx, me, { ...d, expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null })));
}

export async function markRead(id: string): Promise<R> {
  const me = await requirePermission("self.time");
  return run("markRead", () => db.$transaction((tx) => acknowledge(tx, me, id)));
}

const tplSchema = z.object({ id: z.string().optional(), name: z.string().trim().min(2).max(60), items: z.array(z.string().max(200)).max(40), kind: z.enum(["SHOP", "WAREHOUSE"]).nullable(), dueBy: z.string().optional(), active: z.boolean() });

export async function saveChecklist(input: z.input<typeof tplSchema>): Promise<R> {
  const me = await requirePermission("ops.manage");
  const p = tplSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Give the checklist a name and some items." };
  return run("saveChecklist", () => db.$transaction((tx) => saveTemplate(tx, me, { ...p.data, dueBy: p.data.dueBy || null })));
}

export async function tickItem(templateId: string, storeId: string, index: number, done: boolean): Promise<R> {
  const me = await requirePermission("self.time");
  return run("tickItem", () => db.$transaction((tx) => tick(tx, me, { templateId, storeId, index, done })));
}
