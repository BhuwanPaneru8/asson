/**
 * Last-resort recovery: turn off two-step sign-in for one staff account (usually the owner who lost their phone
 * AND their backup codes, with no other owner to reset it from Team & access). Needs direct database access, so
 * only someone with the server can run it. Signs the person out everywhere and records it in the audit trail;
 * they set two-step sign-in up again at their next sign-in.
 *
 *   DATABASE_URL=... npx tsx scripts/reset-two-factor.ts owner@example.com
 *
 * Against a server database, open an SSH tunnel first (deploy/README.md → "Create the owner login").
 */
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

const ask = (q: string) => new Promise<string>((resolve) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, (a) => { rl.close(); resolve(a.trim()); });
});

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) throw new Error("Usage: npx tsx scripts/reset-two-factor.ts <staff email>");
  const db = new PrismaClient();
  try {
    const u = await db.user.findUnique({ where: { email }, select: { id: true, name: true, role: true, totpEnabledAt: true } });
    if (!u || u.role === "CUSTOMER") throw new Error("No staff account with that email.");
    if (!u.totpEnabledAt) throw new Error(`${u.name} doesn't have two-step sign-in on.`);
    const why = await ask(`Reset two-step sign-in for ${u.name} (${u.role.toLowerCase()})? Say why, for the record: `);
    if (why.length < 3) throw new Error("Say why, for the record.");
    await db.$transaction([
      db.twoFactorBackupCode.deleteMany({ where: { userId: u.id } }),
      db.user.update({ where: { id: u.id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpPendingSecret: null, tokenVersion: { increment: 1 } } }),
      db.auditLog.create({ data: { actorName: "server script", actorRole: "SYSTEM", action: "team.2fa_reset", entityType: "User", entityId: u.id, summary: `Two-step sign-in reset for ${u.name} from the server (scripts/reset-two-factor.ts): ${why.slice(0, 200)}` } }),
    ]);
    console.log(`\n✔ Two-step sign-in is off for ${email}. They set it up again at their next sign-in.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(`\n✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
