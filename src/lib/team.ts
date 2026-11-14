import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, type AuditActor } from "./audit";
import { hashPassword } from "./auth";
import { effectivePermissions, jobOf, OWNER_ONLY, PERMISSION_INFO, PERMISSIONS, type JobKey, type Permission } from "./permissions";

// The team and their access (owner only: permission `team.manage`). A person's JOB decides what they see; the
// owner can add or remove single permissions for one person. New people get a one-time invite link to set
// their own password, so the owner never knows it and never shares their own. Removing someone's access signs
// them out everywhere at once. Every change goes to the audit trail.

type Tx = Prisma.TransactionClient;
type Actor = NonNullable<AuditActor>;
export class TeamError extends Error {}

const INVITE_DAYS = 7;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const list = (ps: readonly string[]) => (ps.length ? ps.map((p) => PERMISSION_INFO[p as Permission]?.label ?? p).join("; ") : "nothing");

async function newInvite(tx: Tx, owner: Actor, userId: string, now = new Date()) {
  const token = randomBytes(24).toString("base64url");
  // a fresh link replaces any unused older one
  await tx.staffInvite.updateMany({ where: { userId, usedAt: null, purpose: "INVITE" }, data: { expiresAt: now } });
  await tx.staffInvite.create({ data: { userId, purpose: "INVITE", tokenHash: sha(token), expiresAt: new Date(now.getTime() + INVITE_DAYS * 86_400_000), createdById: owner.id } });
  return token;
}

/** A new team member: their job, where they work, and a link to set their own password. */
export async function addTeamMember(tx: Tx, owner: Actor, d: { name: string; email: string; phone?: string | null; job: JobKey; storeIds: string[]; all: boolean }) {
  const job = jobOf(d.job);
  if (!job) throw new TeamError("Choose a job.");
  if (job.key === "owner") throw new TeamError("Add owners one at a time from an existing person, so it's deliberate.");
  const email = d.email.trim().toLowerCase();
  const exists = await tx.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (exists && exists.role !== "CUSTOMER") throw new TeamError("That email already belongs to a team member.");
  if (!d.all && !d.storeIds.length) throw new TeamError("Choose where they work (or all locations).");
  // an unusable password until they set their own from the invite link
  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
  const data = { name: d.name.trim(), phone: d.phone?.trim() || null, role: job.role, job: job.key, permAdd: [], permRemove: [], allLocations: d.all };
  // a customer account with the same email becomes staff (keeps their orders and password); otherwise a new account
  const user = exists
    ? await tx.user.update({ where: { id: exists.id }, data: { ...data, tokenVersion: { increment: 1 } } }) // keeps their own password
    : await tx.user.create({ data: { ...data, email, passwordHash } });
  await tx.staffLocation.deleteMany({ where: { userId: user.id } });
  if (!d.all) await tx.staffLocation.createMany({ data: d.storeIds.map((storeId) => ({ userId: user.id, storeId })) });
  const token = await newInvite(tx, owner, user.id);
  await audit(tx, owner, { action: "team.add", entity: ["User", user.id], summary: `${user.name} joined as ${job.label}${d.all ? ", all locations" : ""}` });
  return { userId: user.id, token };
}

/** Change what someone does: their job, and any single permissions added or removed for them. */
export async function setAccess(tx: Tx, owner: Actor, userId: string, d: { job: JobKey; add: string[]; remove: string[] }) {
  if (userId === owner.id) throw new TeamError("Someone else has to change your own access.");
  const u = await tx.user.findUnique({ where: { id: userId }, select: { name: true, role: true, job: true, permAdd: true, permRemove: true } });
  if (!u || u.role === "CUSTOMER") throw new TeamError("Not a team member.");
  const job = jobOf(d.job);
  if (!job) throw new TeamError("Choose a job.");
  const valid = (ps: string[]) => [...new Set(ps)].filter((p) => (PERMISSIONS as string[]).includes(p) && !OWNER_ONLY.includes(p as Permission));
  // keep only real changes: an addition the job already has, or a removal it doesn't, means nothing
  const add = valid(d.add).filter((p) => !job.permissions.includes(p as Permission));
  const remove = valid(d.remove).filter((p) => job.permissions.includes(p as Permission) && p !== "self.time");
  if (job.role === "ADMIN" && u.role !== "ADMIN") {
    const owners = await tx.user.count({ where: { role: "ADMIN" } });
    if (owners >= 3) throw new TeamError("There are already 3 owners. Each owner can see and change everything.");
  }
  if (u.role === "ADMIN" && job.role !== "ADMIN" && (await tx.user.count({ where: { role: "ADMIN" } })) <= 1) throw new TeamError("Keep at least one owner.");
  const before = effectivePermissions(u.role, u.job, u.permAdd, u.permRemove);
  await tx.user.update({ where: { id: userId }, data: { role: job.role, job: job.key, permAdd: add, permRemove: remove } });
  const after = effectivePermissions(job.role, job.key, add, remove);
  const gained = after.filter((p) => !before.includes(p)), lost = before.filter((p) => !after.includes(p));
  if (u.job !== job.key || gained.length || lost.length) {
    await audit(tx, owner, {
      action: "team.access", entity: ["User", userId],
      summary: `${u.name}: ${job.label}${add.length ? `, plus ${list(add)}` : ""}${remove.length ? `, without ${list(remove)}` : ""}${gained.length ? ` (now can: ${list(gained)})` : ""}${lost.length ? ` (no longer: ${list(lost)})` : ""}`,
      changes: { job: [u.job, job.key], permissions: [before, after] },
    });
  }
  return { gained, lost };
}

/** Someone leaves: no more access, signed out on every device, approval PIN and shops removed. Their history stays. */
export async function removeFromTeam(tx: Tx, owner: Actor, userId: string, reason: string) {
  if (userId === owner.id) throw new TeamError("You can't remove yourself.");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new TeamError("Say why, for the record.");
  const u = await tx.user.findUnique({ where: { id: userId }, select: { name: true, role: true, job: true } });
  if (!u || u.role === "CUSTOMER") throw new TeamError("Not a team member.");
  if (u.role === "ADMIN" && (await tx.user.count({ where: { role: "ADMIN" } })) <= 1) throw new TeamError("Keep at least one owner.");
  const open = await tx.attendance.count({ where: { userId, clockOut: null } });
  if (open) throw new TeamError(`${u.name} is clocked in. Clock them out first (People page).`);
  await tx.user.update({ where: { id: userId }, data: { role: "CUSTOMER", job: null, permAdd: [], permRemove: [], allLocations: false, approvalPinHash: null, tokenVersion: { increment: 1 }, totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpPendingSecret: null, twoFactorRequired: false } });
  await tx.staffLocation.deleteMany({ where: { userId } });
  await tx.twoFactorBackupCode.deleteMany({ where: { userId } });
  await tx.staffInvite.updateMany({ where: { userId, usedAt: null }, data: { expiresAt: new Date() } });
  await audit(tx, owner, { action: "team.remove", entity: ["User", userId], summary: `${u.name} removed from the team (was ${jobOf(u.job)?.label ?? u.role}): ${why}` });
}

/** A new invite link for someone who lost theirs or forgot their password. */
export async function reinvite(tx: Tx, owner: Actor, userId: string) {
  const u = await tx.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
  if (!u || u.role === "CUSTOMER") throw new TeamError("Not a team member.");
  if (userId === owner.id) throw new TeamError("Change your own password from your account.");
  const token = await newInvite(tx, owner, userId);
  await audit(tx, owner, { action: "team.invite", entity: ["User", userId], summary: `New sign-in link for ${u.name}` });
  return token;
}

/** The invite link's page: who it's for, if it still works. */
export async function inviteFor(token: string, now = new Date()) {
  const inv = await db.staffInvite.findUnique({ where: { tokenHash: sha(token) }, include: { user: { select: { name: true, email: true, role: true, job: true } } } });
  if (!inv || inv.purpose !== "INVITE" || inv.usedAt || inv.expiresAt <= now || inv.user.role === "CUSTOMER") return null;
  return { name: inv.user.name, email: inv.user.email, job: jobOf(inv.user.job)?.label ?? null };
}

/** The new team member sets their password; the link stops working. Returns who to sign in. */
export async function acceptInvite(tx: Tx, token: string, password: string, now = new Date()) {
  const inv = await tx.staffInvite.findUnique({ where: { tokenHash: sha(token) }, include: { user: { select: { id: true, name: true, role: true } } } });
  if (!inv || inv.purpose !== "INVITE" || inv.usedAt || inv.expiresAt <= now || inv.user.role === "CUSTOMER") throw new TeamError("This link has expired or was already used. Ask the owner for a new one.");
  const used = await tx.staffInvite.updateMany({ where: { id: inv.id, usedAt: null }, data: { usedAt: now } });
  if (!used.count) throw new TeamError("This link was just used.");
  const user = await tx.user.update({ where: { id: inv.userId }, data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } }, select: { id: true, name: true, email: true, role: true, tokenVersion: true, twoFactorRequired: true, totpEnabledAt: true } });
  await audit(tx, { id: inv.userId, name: inv.user.name, role: inv.user.role }, { action: "team.password", entity: ["User", inv.userId], summary: `${inv.user.name} set their password from an invite link` });
  return user;
}

/** The team screen: everyone with access, their job, what they can do, where they work, and pending invites. */
export async function teamList(now = new Date()) {
  const users = await db.user.findMany({
    where: { role: { not: "CUSTOMER" } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, phone: true, role: true, job: true, permAdd: true, permRemove: true, allLocations: true, approvalPinHash: true, totpEnabledAt: true, twoFactorRequired: true, locations: { select: { storeId: true } }, invites: { where: { usedAt: null, purpose: "INVITE", expiresAt: { gt: now } }, select: { id: true }, take: 1 } },
  });
  return users.map((u) => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
    job: (jobOf(u.job)?.key ?? null) as JobKey | null, add: u.permAdd, remove: u.permRemove,
    permissions: effectivePermissions(u.role, u.job, u.permAdd, u.permRemove),
    all: u.allLocations, storeIds: u.locations.map((l) => l.storeId), hasPin: !!u.approvalPinHash, invitePending: u.invites.length > 0,
    twoFactorOn: !!u.totpEnabledAt, twoFactorRequired: u.twoFactorRequired,
  }));
}

// ---------- password reset links (customer care, for customers who can't get a code by SMS) ----------

/** A one-time link to set a new password, for a customer care has checked is who they say (by phone or WhatsApp). */
export async function resetLinkFor(tx: Tx, staff: Actor, userId: string, now = new Date()) {
  const u = await tx.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
  if (!u) throw new TeamError("Customer not found.");
  if (u.role !== "CUSTOMER") throw new TeamError("Staff get a new sign-in link from Team & access.");
  const token = randomBytes(24).toString("base64url");
  await tx.staffInvite.updateMany({ where: { userId, usedAt: null, purpose: "RESET" }, data: { expiresAt: now } });
  await tx.staffInvite.create({ data: { userId, purpose: "RESET", tokenHash: sha(token), expiresAt: new Date(now.getTime() + 24 * 3_600_000), createdById: staff.id } });
  await audit(tx, staff, { action: "customer.reset_link", entity: ["User", userId], summary: `Password reset link for ${u.name} (valid 24 hours)` });
  return token;
}

/** The reset link's page: whose it is, if it still works. */
export async function resetFor(token: string, now = new Date()) {
  const r = await db.staffInvite.findUnique({ where: { tokenHash: sha(token) }, include: { user: { select: { name: true, email: true } } } });
  if (!r || r.purpose !== "RESET" || r.usedAt || r.expiresAt <= now) return null;
  return { name: r.user.name, email: r.user.email };
}

/** Sets the new password from a reset link (once) and signs out every other device. */
export async function redeemResetLink(tx: Tx, token: string, password: string, now = new Date()) {
  const r = await tx.staffInvite.findUnique({ where: { tokenHash: sha(token) } });
  if (!r || r.purpose !== "RESET" || r.usedAt || r.expiresAt <= now) throw new TeamError("This link has expired or was already used. Contact us for a new one.");
  const used = await tx.staffInvite.updateMany({ where: { id: r.id, usedAt: null }, data: { usedAt: now } });
  if (!used.count) throw new TeamError("This link was just used.");
  return tx.user.update({ where: { id: r.userId }, data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } }, select: { id: true, role: true, tokenVersion: true, name: true } });
}
