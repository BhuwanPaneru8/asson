"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { ScopeError } from "@/lib/scope";
import { assignBin, BinError, createBins, importAssignments } from "@/lib/bins";

async function run<T>(where: string, f: () => Promise<T>, opts: { refresh?: boolean } = {}) {
  try {
    const r = await f();
    if (opts.refresh !== false) refresh();
    return { ok: true as const, result: r };
  } catch (e) {
    if (e instanceof BinError || e instanceof ScopeError) return { ok: false as const, error: e.message };
    void reportError(where, e);
    return { ok: false as const, error: "Couldn't save that. Nothing changed — please try again." };
  }
}

export async function assignBinAction(storeId: string, sku: string, code: string) {
  const me = await requirePermission("stock.count");
  return run("assignBin", () => db.$transaction((tx) => assignBin(tx, me, { storeId: String(storeId), sku: String(sku ?? "").slice(0, 60), code: String(code ?? "").slice(0, 40) })), { refresh: false });
}

export async function createBinsAction(storeId: string, text: string) {
  const me = await requirePermission("stock.count");
  return run("createBins", () => db.$transaction((tx) => createBins(tx, me, String(storeId), String(text ?? "").slice(0, 200_000).split(/\r?\n/))));
}

export async function importBinsAction(storeId: string, text: string) {
  const me = await requirePermission("stock.count");
  return run("importBins", () => db.$transaction((tx) => importAssignments(tx, me, String(storeId), String(text ?? "").slice(0, 900_000)), { timeout: 60_000 }));
}
