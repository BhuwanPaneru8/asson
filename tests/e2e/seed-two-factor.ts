// E2E database only (prepare-db.ts): the seeded owner and manager get two-step sign-in with a known secret
// (two-factor-accounts.ts), encrypted with the same key the E2E server uses (its AUTH_SECRET / TWO_FACTOR_KEY).
import { PrismaClient } from "@prisma/client";
import { encryptSecret } from "../../src/lib/two-factor-core";
import { E2E_TOTP } from "./two-factor-accounts";

const url = process.env.DATABASE_URL ?? "";
if (!/asson_e2e/.test(url)) throw new Error(`Refusing to give known two-step secrets to a non-E2E database: ${url}`);

async function main() {
  const db = new PrismaClient();
  const accounts = { owner: "admin@asson.test", manager: "manager@asson.test" } as const;
  for (const [who, email] of Object.entries(accounts) as [keyof typeof accounts, string][]) {
    await db.user.update({ where: { email }, data: { totpSecret: encryptSecret(E2E_TOTP[who]), totpEnabledAt: new Date(), totpLastStep: null } });
  }
  await db.$disconnect();
  console.log("E2E: seeded owner and manager have two-step sign-in with known test secrets");
}

main().catch((e) => { console.error(e); process.exit(1); });
