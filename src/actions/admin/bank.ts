"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { importStatement, parseStatement, resolveLine, StatementError } from "@/lib/bank-statements";

const MAX = 900_000; // characters; server actions take up to 1 MB

/** Read the file and show what we found, before anything is saved. */
export async function previewStatement(text: string) {
  await requirePermission("finance");
  if (typeof text !== "string" || !text.trim()) return { ok: false as const, error: "Choose the statement file." };
  if (text.length > MAX) return { ok: false as const, error: "That file is too big: export one month at a time." };
  try {
    const p = parseStatement(text);
    const credits = p.lines.filter((l) => l.amount > 0);
    return { ok: true as const, columns: p.columns, lines: p.lines.length, credits: credits.length, creditTotal: credits.reduce((a, l) => a + l.amount, 0), from: p.lines.map((l) => l.date).sort()[0] ?? null, to: p.lines.map((l) => l.date).sort().pop() ?? null, skipped: p.skipped.length, sample: p.lines.slice(0, 5) };
  } catch (e) {
    if (e instanceof StatementError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export async function importStatementAction(account: string, text: string) {
  const me = await requirePermission("finance");
  if (typeof text !== "string" || text.length > MAX) return { ok: false as const, error: "That file is too big: export one month at a time." };
  try {
    const lines = parseStatement(text).lines;
    const r = await db.$transaction((tx) => importStatement(tx, me, String(account ?? ""), lines), { timeout: 60_000 });
    refresh();
    return { ok: true as const, ...r };
  } catch (e) {
    if (e instanceof StatementError) return { ok: false as const, error: e.message };
    void reportError("importStatement", e);
    return { ok: false as const, error: "Couldn't import that. Nothing was saved — please try again." };
  }
}

const resolveSchema = z.object({ lineId: z.string(), depositId: z.string().optional(), remittanceId: z.string().optional(), ignore: z.string().max(300).optional() });

export async function resolveLineAction(input: z.input<typeof resolveSchema>) {
  const me = await requirePermission("finance");
  const p = resolveSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Check the choice." };
  try {
    await db.$transaction((tx) => resolveLine(tx, me, p.data.lineId, p.data));
  } catch (e) {
    if (e instanceof StatementError) return { ok: false as const, error: e.message };
    void reportError("resolveLine", e);
    return { ok: false as const, error: "Couldn't save that. Nothing changed — please try again." };
  }
  refresh();
  return { ok: true as const };
}
