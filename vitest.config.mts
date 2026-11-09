import { defineConfig } from "vitest/config";
import path from "node:path";
import os from "node:os";

// keep in sync with tests/support/test-db-url.ts (config files can't import TS modules without extensions)
const testDatabaseUrl = () => process.env.TEST_DATABASE_URL ?? `postgresql://${os.userInfo().username}@localhost:5432/asson_test?schema=public`;

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // Next's "server-only" guard throws outside the Next bundler — stub it in tests
  "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts"),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // a dedicated database — never the dev or production one
          env: { DATABASE_URL: testDatabaseUrl(), AUTH_SECRET: "test-secret-test-secret-test-secret-123" },
          globalSetup: ["tests/support/global-setup.ts"],
          setupFiles: ["tests/support/next-mocks.ts"],
          fileParallelism: false, // tests share one database
          testTimeout: 30_000,
        },
      },
    ],
  },
});
