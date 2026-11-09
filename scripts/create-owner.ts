/**
 * Create (or reset the password of) the owner account: role ADMIN.
 * The password is typed at a hidden prompt and only its bcrypt hash is stored.
 *
 *   DATABASE_URL=... npx tsx scripts/create-owner.ts
 *
 * Against a server database, open an SSH tunnel first (deploy/README.md → "Create the owner login").
 */
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // print the prompt, then swallow echoed characters
      const out = rl as unknown as { _writeToOutput: (s: string) => void };
      out._writeToOutput = (s: string) => {
        if (s.includes(question)) process.stdout.write(question);
        else if (s.includes("\n") || s.includes("\r")) process.stdout.write("\n");
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
  const db = new PrismaClient();
  try {
    const email = (await ask("Owner email: ")).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That doesn't look like an email address.");
    const existing = await db.user.findUnique({ where: { email } });
    const name = existing?.name ?? ((await ask("Your name: ")) || "Owner");
    const password = await ask("New password (hidden, at least 12 characters): ", true);
    if (password.length < 12) throw new Error("Use at least 12 characters.");
    const again = await ask("Type it again: ", true);
    if (password !== again) throw new Error("The two passwords don't match.");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.upsert({
      where: { email },
      // tokenVersion bump signs out any existing sessions for this account
      update: { passwordHash, role: "ADMIN", tokenVersion: { increment: 1 } },
      create: { email, name, passwordHash, role: "ADMIN" },
    });
    console.log(`\n✔ ${existing ? "Updated" : "Created"} owner account ${user.email}. Sign in at /login.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(`\n✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
