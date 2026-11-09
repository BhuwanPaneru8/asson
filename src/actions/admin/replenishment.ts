"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { replenishmentPlan } from "@/lib/replenishment";
import { scopeFor, ScopeError } from "@/lib/scope";
import { createTransfer, TransferError, transferNo } from "@/lib/transfers";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Turn suggested routes into transfer drafts (re-planned on the server; the sender's staff send them). */
export async function draftReplenishment(routes: { fromId: string; toId: string }[]): Promise<R<{ drafted: string[] }>> {
  const me = await requirePermission("transfers");
  if (!routes.length || routes.length > 200) return { ok: false, error: "Choose the routes to draft." };
  const scope = await scopeFor(me);
  const plan = await replenishmentPlan();
  const drafted: string[] = [];
  try {
    for (const want of routes) {
      const r = plan.find((p) => p.fromId === want.fromId && p.toId === want.toId);
      if (!r) continue; // already drafted, or no longer needed
      if (!scope.all && !scope.storeIds.includes(r.fromId)) continue; // only the sending location drafts
      const t = await db.$transaction((tx) => createTransfer(tx, me, { fromId: r.fromId, toId: r.toId, note: "Suggested by replenishment", items: r.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }));
      drafted.push(transferNo(t.number));
    }
  } catch (e) {
    if (e instanceof TransferError || e instanceof ScopeError) return { ok: false, error: e.message };
    void reportError("draftReplenishment", e);
    return { ok: false, error: "Couldn't draft the transfers. Nothing was moved — please try again." };
  }
  refresh();
  return drafted.length ? { ok: true, drafted } : { ok: false, error: "Nothing to draft: those routes are already on their way or no longer needed." };
}
