"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { loadStarters, saveSop, signOff, TrainingError } from "@/lib/training";

async function run<T>(where: string, f: () => Promise<T>) {
  try { const r = await f(); refresh(); return { ok: true as const, result: r }; } catch (e) {
    if (e instanceof TrainingError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't do that. Nothing changed — please try again." };
  }
}

const sopSchema = z.object({ id: z.string().optional(), title: z.string().max(100), area: z.enum(["SALES", "CASH", "FULFILMENT", "STOCK", "CUSTOMERS", "PEOPLE"]), roles: z.array(z.string()).max(4), body: z.string().max(20_000), major: z.boolean(), active: z.boolean().optional() });
export async function saveSopAction(input: z.input<typeof sopSchema>) {
  const me = await requirePermission("ops.manage");
  const p = sopSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: "Check the procedure." };
  return run("saveSop", async () => (await db.$transaction((tx) => saveSop(tx, me, p.data))).slug);
}
export async function signOffAction(sopId: string) {
  const me = await requirePermission("self.time");
  return run("signOff", () => db.$transaction((tx) => signOff(tx, me, String(sopId))));
}
export async function loadStartersAction() {
  const me = await requirePermission("ops.manage");
  return run("loadStarters", () => db.$transaction((tx) => loadStarters(tx, me)));
}
