import { defineConfig } from "vitest/config";
import path from "node:path";
import os from "node:os";

// National-scale performance check: `npm run bench:scale` (after `npx tsx tests/scale/load.ts`).
const url = process.env.SCALE_DATABASE_URL ?? `postgresql://${os.userInfo().username}@localhost:5432/asson_scale?schema=public`;

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts") } },
  test: {
    include: ["tests/scale/**/*.bench.test.ts"],
    environment: "node",
    env: { DATABASE_URL: url, AUTH_SECRET: "scale-secret-scale-secret-scale-secret-1" },
    setupFiles: ["tests/support/next-mocks.ts"],
    testTimeout: 600_000,
  },
});
