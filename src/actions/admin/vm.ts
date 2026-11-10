"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { ScopeError } from "@/lib/scope";
import { closeBrief, createBrief, review, submit, VmError } from "@/lib/vm";

type R = { ok: true; number?: number } | { ok: false; error: string };

async function run(where: string, f: () => Promise<number | void>): Promise<R> {
  let n: number | void;
  try { n = await f(); } catch (e) {
    if (e instanceof VmError || e instanceof ScopeError) return { ok: false, error: e.message };
    void reportError(where, e);
    return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
  }
  refresh();
  return n ? { ok: true, number: n } : { ok: true };
}

const url = z.string().max(200);
const briefSchema = z.object({
  title: z.string().trim().min(3, "Give the brief a title").max(120),
  instructions: z.string().trim().max(4000).default(""),
  refPhotos: z.array(url).max(6),
  areas: z.array(z.object({ name: z.string().max(60), hint: z.string().max(200).optional() })).max(12),
  criteria: z.array(z.object({ text: z.string().max(200) })).max(15),
  storeIds: z.array(z.string()).max(500),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date"),
});

export async function createBriefAction(input: z.input<typeof briefSchema>): Promise<R> {
  const me = await requirePermission("ops.manage");
  const p = briefSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the brief." };
  const { due, ...d } = p.data;
  // due at the end of that day in Nepal
  return run("createBrief", async () => (await db.$transaction((tx) => createBrief(tx, me, { ...d, dueAt: new Date(`${due}T23:59:59+05:45`) }))).number);
}

export async function closeBriefAction(id: string): Promise<R> {
  const me = await requirePermission("ops.manage");
  return run("closeBrief", () => db.$transaction((tx) => closeBrief(tx, me, id)));
}

const submitSchema = z.object({ briefId: z.string(), storeId: z.string(), photos: z.array(z.object({ area: z.string().max(60), url })).max(48), note: z.string().max(1000).default("") });

export async function submitDisplay(input: z.input<typeof submitSchema>): Promise<R> {
  const me = await requirePermission("self.time");
  const p = submitSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the photos." };
  return run("submitDisplay", async () => { await db.$transaction((tx) => submit(tx, me, p.data)); });
}

const reviewSchema = z.object({ submissionId: z.string(), round: z.number().int().min(1), approve: z.boolean(), scores: z.array(z.number().int()).max(15).optional(), feedback: z.string().max(2000).optional() });

export async function reviewDisplay(input: z.input<typeof reviewSchema>): Promise<R> {
  const me = await requirePermission("ops.manage");
  const p = reviewSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the review." };
  return run("reviewDisplay", async () => { await db.$transaction((tx) => review(tx, me, p.data)); });
}
