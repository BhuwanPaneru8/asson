import "server-only";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { rateLimit } from "./rate-limit";
import { effectivePermissions, type Permission, type Role } from "./permissions";
import { audit } from "./audit";

/**
 * Find the manager/owner whose approval PIN matches. PINs are unique per approver (enforced when set),
 * so the match tells us exactly who approved. Their job must include `need` (a buyer or an accountant can have a
 * manager's level without approving at the till). Rate-limited per requesting staff member.
 */
export async function findApproverByPin(requesterId: string, pin: string | undefined, need: Permission, roles: Role[] = ["MANAGER", "ADMIN"]) {
  if (!pin || !/^\d{4,6}$/.test(pin)) return { ok: false as const, error: "Enter a 4–6 digit approval PIN." };
  if (!rateLimit(`pin:${requesterId}`, 5, 10 * 60_000)) return { ok: false as const, error: "Too many PIN attempts. Wait 10 minutes." };
  const found = await db.user.findMany({ where: { role: { in: roles }, approvalPinHash: { not: null } }, select: { id: true, name: true, role: true, approvalPinHash: true, job: true, permAdd: true, permRemove: true } });
  const approvers = found.filter((a) => effectivePermissions(a.role, a.job, a.permAdd, a.permRemove).includes(need));
  for (const a of approvers) {
    if (await bcrypt.compare(pin, a.approvalPinHash!)) return { ok: true as const, approver: { id: a.id, name: a.name, role: a.role as Role } };
  }
  // a wrong PIN is a security signal (someone guessing a manager's PIN at the till)
  const who = await db.user.findUnique({ where: { id: requesterId }, select: { id: true, name: true, role: true } });
  await audit(db, who, { action: "auth.pin_failed", entity: ["User", requesterId], summary: `Wrong approval PIN entered by ${who?.name ?? "unknown"}` });
  return { ok: false as const, error: "That PIN isn't valid." };
}
