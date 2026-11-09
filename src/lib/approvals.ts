import "server-only";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { rateLimit } from "./rate-limit";
import type { Role } from "./permissions";

/**
 * Find the manager/owner whose approval PIN matches. PINs are unique per approver (enforced when set),
 * so the match tells us exactly who approved. Rate-limited per requesting staff member.
 */
export async function findApproverByPin(requesterId: string, pin: string | undefined, roles: Role[] = ["MANAGER", "ADMIN"]) {
  if (!pin || !/^\d{4,6}$/.test(pin)) return { ok: false as const, error: "Enter a 4–6 digit approval PIN." };
  if (!rateLimit(`pin:${requesterId}`, 5, 10 * 60_000)) return { ok: false as const, error: "Too many PIN attempts. Wait 10 minutes." };
  const approvers = await db.user.findMany({ where: { role: { in: roles }, approvalPinHash: { not: null } }, select: { id: true, name: true, role: true, approvalPinHash: true } });
  for (const a of approvers) {
    if (await bcrypt.compare(pin, a.approvalPinHash!)) return { ok: true as const, approver: { id: a.id, name: a.name, role: a.role as Role } };
  }
  return { ok: false as const, error: "That PIN isn't valid." };
}
