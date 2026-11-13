"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { addTeamMember, reinvite, removeFromTeam, setAccess, TeamError } from "@/lib/team";
import type { JobKey } from "@/lib/permissions";

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

// ---------- jobs, access, invites (lib/team.ts) ----------

const failure = (e: unknown): { ok: false; error: string } => {
  if (e instanceof TeamError) return { ok: false, error: e.message };
  throw e;
};
const inviteUrl = (token: string) => `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/invite/${token}`;

const addSchema = z.object({
  name: z.string().trim().min(2, "Enter their name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().regex(/^(9[678]\d{8})?$/, "Mobile numbers are 10 digits starting 96, 97 or 98").optional(),
  job: z.string(),
  all: z.boolean(),
  storeIds: z.array(z.string()).max(500),
});

/** Owner adds a person; the result is the one-time link to send them. */
export async function addMember(input: z.input<typeof addSchema>): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const me = await requirePermission("team.manage");
  const p = addSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the details." };
  try {
    const r = await db.$transaction((tx) => addTeamMember(tx, me, { ...p.data, job: p.data.job as JobKey }));
    refresh();
    return { ok: true, link: inviteUrl(r.token) };
  } catch (e) { return failure(e); }
}

const accessSchema = z.object({ userId: z.string(), job: z.string(), add: z.array(z.string()).max(40), remove: z.array(z.string()).max(40) });

export async function changeAccess(input: z.input<typeof accessSchema>): Promise<R> {
  const me = await requirePermission("team.manage");
  const p = accessSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Choose a job." };
  try {
    await db.$transaction((tx) => setAccess(tx, me, p.data.userId, { job: p.data.job as JobKey, add: p.data.add, remove: p.data.remove }));
  } catch (e) { return failure(e); }
  refresh();
  return { ok: true };
}

export async function removeMember(userId: string, reason: string): Promise<R> {
  const me = await requirePermission("team.manage");
  try {
    await db.$transaction((tx) => removeFromTeam(tx, me, userId, reason));
  } catch (e) { return failure(e); }
  refresh();
  return { ok: true };
}

export async function newSignInLink(userId: string): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const me = await requirePermission("team.manage");
  try {
    const token = await db.$transaction((tx) => reinvite(tx, me, userId));
    refresh();
    return { ok: true, link: inviteUrl(token) };
  } catch (e) { return failure(e); }
}
