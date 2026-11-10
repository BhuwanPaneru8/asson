"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { ScopeError } from "@/lib/scope";
import { acknowledge, answer, checkAction, completeAction, discardDraft, saveTemplate, startVisit, submitVisit, VisitError } from "@/lib/visits";

type R = { ok: true; number?: number } | { ok: false; error: string };

async function run(where: string, f: () => Promise<number | void>, opts: { refresh?: boolean } = {}): Promise<R> {
  let n: number | void;
  try { n = await f(); } catch (e) {
    if (e instanceof VisitError || e instanceof ScopeError) return { ok: false, error: e.message };
    void reportError(where, e);
    return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
  }
  if (opts.refresh !== false) refresh();
  return n ? { ok: true, number: n } : { ok: true };
}

const tplSchema = z.object({ id: z.string().optional(), name: z.string().trim().min(2).max(80), active: z.boolean(), sections: z.array(z.object({ name: z.string().max(80), items: z.array(z.object({ text: z.string().max(200), critical: z.boolean().optional() })).max(60) })).max(20) });

export async function saveVisitTemplate(input: z.input<typeof tplSchema>): Promise<R> {
  const me = await requirePermission("ops.manage");
  const p = tplSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Give the checklist a name and some items." };
  return run("saveVisitTemplate", async () => { await db.$transaction((tx) => saveTemplate(tx, me, p.data)); });
}

export async function startVisitAction(templateId: string, storeId: string): Promise<R> {
  const me = await requirePermission("ops.manage");
  return run("startVisit", async () => (await db.$transaction((tx) => startVisit(tx, me, { templateId: String(templateId), storeId: String(storeId) }))).number);
}

const answerSchema = z.object({ result: z.enum(["PASS", "FAIL", "NA"]).nullable(), note: z.string().max(1000).optional(), photos: z.array(z.string().max(200)).max(4).optional() });

/** Saved per item during the walk-through; no page refresh (the form shows it already). */
export async function answerItem(id: string, index: number, input: z.input<typeof answerSchema>): Promise<R> {
  const me = await requirePermission("ops.manage");
  const p = answerSchema.safeParse(input);
  if (!p.success || !Number.isInteger(index)) return { ok: false, error: "Check the answer." };
  return run("answerItem", async () => { await db.$transaction((tx) => answer(tx, me, String(id), index, p.data)); }, { refresh: false });
}

export async function submitVisitAction(id: string, summary: string): Promise<R> {
  const me = await requirePermission("ops.manage");
  return run("submitVisit", async () => { await db.$transaction((tx) => submitVisit(tx, me, String(id), String(summary ?? ""))); });
}

export async function discardVisit(id: string): Promise<R> {
  const me = await requirePermission("ops.manage");
  return run("discardVisit", async () => { await db.$transaction((tx) => discardDraft(tx, me, String(id))); });
}

export async function acknowledgeVisit(id: string, note: string): Promise<R> {
  const me = await requirePermission("self.time");
  return run("acknowledgeVisit", async () => { await db.$transaction((tx) => acknowledge(tx, me, String(id), String(note ?? ""))); });
}

export async function completeVisitAction(actionId: string, note: string, photos: string[]): Promise<R> {
  const me = await requirePermission("self.time");
  const p = z.array(z.string().max(200)).max(4).safeParse(photos);
  if (!p.success) return { ok: false, error: "Up to 4 photos." };
  return run("completeVisitAction", async () => { await db.$transaction((tx) => completeAction(tx, me, String(actionId), { note: String(note ?? ""), photos: p.data })); });
}

export async function checkVisitAction(actionId: string, ok: boolean): Promise<R> {
  const me = await requirePermission("ops.manage");
  return run("checkVisitAction", async () => { await db.$transaction((tx) => checkAction(tx, me, String(actionId), !!ok)); });
}
