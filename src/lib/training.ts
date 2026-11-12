import "server-only";
import type { Prisma, SopArea } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import type { Scope } from "./scope";
import { STARTER_SOPS } from "./sop-starters";

// Training: standard operating procedures. HQ writes how things are done and which roles must sign each one.
// Staff read it and sign ("I've read this and will follow it") for its current version; a significant change
// raises the version, so everyone signs again, while a typo fix doesn't. Each person sees what's outstanding on
// Today; managers see who has signed what at their locations.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class TrainingError extends Error {}

export const AREA_LABEL: Record<SopArea, string> = { SALES: "Selling", CASH: "Cash", FULFILMENT: "Online orders", STOCK: "Stock", CUSTOMERS: "Customers", PEOPLE: "People" };
export const STAFF_ROLES = ["CASHIER", "STAFF", "MANAGER", "ADMIN"] as const;
export const ROLE_NAME: Record<(typeof STAFF_ROLES)[number], string> = { CASHIER: "Cashiers", STAFF: "Fulfilment staff", MANAGER: "Managers", ADMIN: "Owner" };

const slugOf = (title: string) => title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "sop";

/** Plain-text body → blocks for display: "## " headings, "- " points, "1. " steps, the rest paragraphs. */
export function blocks(body: string) {
  const out: ({ kind: "h"; text: string } | { kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] })[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const last = out.at(-1);
    if (line.startsWith("## ")) out.push({ kind: "h", text: line.slice(3).trim() });
    else if (/^[-*] /.test(line)) { if (last?.kind === "ul") last.items.push(line.slice(2).trim()); else out.push({ kind: "ul", items: [line.slice(2).trim()] }); }
    else if (/^\d+[.)] /.test(line)) { const t = line.replace(/^\d+[.)] /, "").trim(); if (last?.kind === "ol") last.items.push(t); else out.push({ kind: "ol", items: [t] }); }
    else out.push({ kind: "p", text: line });
  }
  return out;
}

export async function saveSop(tx: Tx, user: Actor, d: { id?: string; title: string; area: SopArea; roles: string[]; body: string; major: boolean; active?: boolean }) {
  const title = d.title.trim().slice(0, 100);
  if (title.length < 3) throw new TrainingError("Give it a title.");
  const roles = [...new Set(d.roles)].filter((r) => (STAFF_ROLES as readonly string[]).includes(r));
  if (!roles.length) throw new TrainingError("Choose who must sign it.");
  const body = d.body.trim().slice(0, 20_000);
  if (body.length < 20) throw new TrainingError("Write the steps.");
  if (!d.id) {
    let slug = slugOf(title);
    if (await tx.sop.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const s = await tx.sop.create({ data: { slug, title, area: d.area, roles, body, updatedById: user.id } });
    await audit(tx, user, { action: "sop.create", entity: ["Sop", s.id], summary: `SOP "${title}" written for ${roles.join(", ").toLowerCase()}` });
    return s;
  }
  const before = await tx.sop.findUnique({ where: { id: d.id } });
  if (!before) throw new TrainingError("Not found.");
  const s = await tx.sop.update({ where: { id: d.id }, data: { title, area: d.area, roles, body, active: d.active ?? before.active, updatedById: user.id, ...(d.major ? { version: { increment: 1 } } : {}) } });
  await audit(tx, user, { action: "sop.update", entity: ["Sop", s.id], summary: `SOP "${title}" ${d.major ? `changed: version ${s.version}, everyone signs again` : "corrected (same version)"}${d.active === false && before.active ? "; retired" : ""}` });
  return s;
}

export async function signOff(tx: Tx, user: Actor, sopId: string) {
  const s = await tx.sop.findUnique({ where: { id: sopId } });
  if (!s || !s.active) throw new TrainingError("This procedure isn't in use.");
  await tx.$executeRaw`INSERT INTO "SopSignoff" ("sopId", "userId", "version", "signedAt") VALUES (${sopId}, ${user.id}, ${s.version}, NOW())
    ON CONFLICT ("sopId", "userId") DO UPDATE SET "version" = EXCLUDED."version", "signedAt" = NOW()`;
  return { version: s.version };
}

/** The procedures this person must sign, with where they stand on each. */
export async function mySops(user: { id: string; role: string }) {
  const sops = await db.sop.findMany({ where: { active: true }, orderBy: [{ area: "asc" }, { title: "asc" }], include: { signoffs: { where: { userId: user.id } } } });
  return sops.map((s) => {
    const signed = s.signoffs[0];
    const required = s.roles.includes(user.role);
    const state = signed && signed.version >= s.version ? "signed" : signed ? "changed" : "todo";
    return { id: s.id, slug: s.slug, title: s.title, area: s.area, version: s.version, required, state, signedAt: signed?.signedAt ?? null };
  });
}

/** Who has signed what: staff at these locations (all for HQ) against what their role must sign. */
export async function trainingMatrix(scope: Scope) {
  const [sops, people] = await Promise.all([
    db.sop.findMany({ where: { active: true }, orderBy: [{ area: "asc" }, { title: "asc" }], include: { signoffs: true } }),
    db.user.findMany({ where: { role: { in: [...STAFF_ROLES] }, ...(scope.all ? {} : { locations: { some: { storeId: { in: scope.storeIds } } } }) }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true, locations: { select: { store: { select: { name: true } } } } } }),
  ]);
  const rows = people.map((p) => {
    const cells = sops.map((s) => {
      if (!s.roles.includes(p.role)) return { sopId: s.id, state: "n/a" as const };
      const sig = s.signoffs.find((x) => x.userId === p.id);
      return { sopId: s.id, state: (sig && sig.version >= s.version ? "signed" : sig ? "changed" : "todo") as "signed" | "changed" | "todo" };
    });
    const due = cells.filter((c) => c.state !== "n/a");
    return { id: p.id, name: p.name, role: p.role, where: p.locations.map((l) => l.store.name).join(", "), cells, done: due.filter((c) => c.state === "signed").length, of: due.length };
  });
  const totalDue = rows.reduce((s, r) => s + r.of, 0), totalDone = rows.reduce((s, r) => s + r.done, 0);
  return { sops: sops.map((s) => ({ id: s.id, slug: s.slug, title: s.title, area: s.area, version: s.version })), rows, pct: totalDue ? Math.round((totalDone / totalDue) * 100) : null };
}

/** The owner loads the starter procedures (only those not there yet, matched by title). */
export async function loadStarters(tx: Tx, user: Actor) {
  const have = new Set((await tx.sop.findMany({ select: { title: true } })).map((s) => s.title.toLowerCase()));
  let added = 0;
  for (const s of STARTER_SOPS) {
    if (have.has(s.title.toLowerCase())) continue;
    await saveSop(tx, user, { title: s.title, area: s.area, roles: s.roles, body: s.body, major: false });
    added++;
  }
  return { added };
}
