// Run before the E2E server starts: bring the isolated E2E database to the latest schema
// (non-destructive `migrate deploy`), then load demo data (the seed replaces its own data).
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
if (!/asson_e2e/.test(url)) throw new Error(`Refusing to prepare a non-E2E database: ${url}`);
execSync("npx prisma migrate deploy", { stdio: "inherit" });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
