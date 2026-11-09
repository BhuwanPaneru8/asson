import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./test-db-url";

/** Bring the isolated test database up to the latest schema before any integration test runs. */
export default function setup() {
  const url = testDatabaseUrl();
  if (!/test/.test(url)) throw new Error(`Refusing to run integration tests against a non-test database: ${url}`);
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
