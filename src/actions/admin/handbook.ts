"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { HandbookError, markRead, submitQuiz } from "@/lib/handbook";

async function run<T>(where: string, f: () => Promise<T>) {
  try { const r = await f(); refresh(); return { ok: true as const, result: r }; } catch (e) {
    if (e instanceof HandbookError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't save that. Please try again." };
  }
}

export async function markReadAction(slug: string) {
  const me = await requirePermission("self.time");
  return run("handbook.markRead", () => db.$transaction((tx) => markRead(tx, me, String(slug).slice(0, 80))));
}

const quizSchema = z.object({ slug: z.string().max(80), answers: z.array(z.number().int().min(0).max(9)).max(20) });
export async function submitQuizAction(input: z.input<typeof quizSchema>) {
  const me = await requirePermission("self.time");
  const p = quizSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Answer every question." };
  return run("handbook.quiz", () => db.$transaction((tx) => submitQuiz(tx, me, p.data.slug, p.data.answers)));
}
