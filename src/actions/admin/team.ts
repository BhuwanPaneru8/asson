"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";

type R = { ok: true } | { ok: false; error: string };

const schema = z.object({ userId: z.string(), all: z.boolean(), storeIds: z.array(z.string()).max(500) });

/** Owner decides where each staff member works: everywhere (HQ) or chosen shops and warehouses. */
export async function setStaffLocations(input: z.input<typeof schema>): Promise<R> {
  const me = await requirePermission("team.manage");
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Choose the locations." };
  const d = p.data;
  const user = await db.user.findUnique({ where: { id: d.userId }, select: { id: true, name: true, role: true, allLocations: true, locations: { select: { store: { select: { id: true, name: true } } } } } });
  if (!user || user.role === "CUSTOMER") return { ok: false, error: "Only staff work at locations." };
  if (user.role === "ADMIN") return { ok: false, error: "The owner always has every location." };
  const stores = await db.store.findMany({ where: { id: { in: d.storeIds } }, select: { id: true, name: true } });
  if (stores.length !== new Set(d.storeIds).size) return { ok: false, error: "One of those locations no longer exists." };
  const describe = (all: boolean, names: string[]) => (all ? "all locations" : names.length ? names.join(", ") : "no locations");
  const before = describe(user.allLocations, user.locations.map((l) => l.store.name).sort());
  const after = describe(d.all, stores.map((s) => s.name).sort());
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { allLocations: d.all } });
    await tx.staffLocation.deleteMany({ where: { userId: user.id } });
    if (!d.all && stores.length) await tx.staffLocation.createMany({ data: stores.map((s) => ({ userId: user.id, storeId: s.id })) });
    if (before !== after) await audit(tx, me, { action: "team.locations", entity: ["User", user.id], summary: `${user.name} now works at ${after} (was ${before})`, changes: { locations: [before, after] } });
  });
  refresh();
  return { ok: true };
}
