"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { comment, IssueError, reopenIssue, reportIssue, updateIssue } from "@/lib/issues";
import { ScopeError } from "@/lib/scope";

type R = { ok: true; number?: number } | { ok: false; error: string };

async function run(where: string, f: () => Promise<number | void>): Promise<R> {
  let number: number | void;
  try { number = await f(); } catch (e) {
    if (e instanceof IssueError || e instanceof ScopeError) return { ok: false, error: e.message };
    void reportError(where, e);
    return { ok: false, error: "Couldn't save that. Nothing changed — please try again." };
  }
  refresh();
  return number ? { ok: true, number } : { ok: true };
}

const photos = z.array(z.string().max(200)).max(6).default([]);
const reportSchema = z.object({
  storeId: z.string().min(1, "Pick the location"),
  category: z.enum(["EQUIPMENT", "BUILDING", "IT", "SAFETY", "STOCK", "OTHER"]),
  priority: z.enum(["LOW", "NORMAL", "URGENT"]),
  title: z.string().trim().min(3, "Say what's wrong in a few words").max(120),
  description: z.string().trim().max(4000).default(""),
  photos,
});

export async function reportIssueAction(input: z.input<typeof reportSchema>): Promise<R> {
  const me = await requirePermission("self.time");
  const p = reportSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the report." };
  return run("reportIssue", async () => (await db.$transaction((tx) => reportIssue(tx, me, p.data))).number);
}

const commentSchema = z.object({ message: z.string().max(4000).default(""), photos });

export async function commentIssue(id: string, input: z.input<typeof commentSchema>): Promise<R> {
  const me = await requirePermission("self.time");
  const p = commentSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the note." };
  return run("commentIssue", () => db.$transaction((tx) => comment(tx, me, id, p.data)));
}

const updateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED"]).optional(),
  assigneeId: z.string().nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "URGENT"]).optional(),
  cost: z.number().min(0).max(100_000_000).optional(), // rupees in, paisa stored
  note: z.string().max(2000).optional(),
});

export async function updateIssueAction(id: string, input: z.input<typeof updateSchema>): Promise<R> {
  const me = await requirePermission("self.time");
  const p = updateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the change." };
  const { cost, ...rest } = p.data;
  return run("updateIssue", () => db.$transaction((tx) => updateIssue(tx, me, id, { ...rest, ...(cost === undefined ? {} : { cost: Math.round(cost * 100) }) })));
}

export async function reopenIssueAction(id: string, why: string): Promise<R> {
  const me = await requirePermission("self.time");
  return run("reopenIssue", () => db.$transaction((tx) => reopenIssue(tx, me, id, String(why ?? "").slice(0, 1000))));
}
