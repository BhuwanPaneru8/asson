import { defineConfig, devices } from "@playwright/test";
import os from "node:os";

/**
 * End-to-end tests run a production build on :3100 against an isolated, freshly seeded database
 * (asson_e2e) — they never touch development data. Uses the locally installed Google Chrome.
 */
export const E2E_DB = process.env.E2E_DATABASE_URL ?? `postgresql://${os.userInfo().username}@localhost:5432/asson_e2e?schema=public`;
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // ad trackers are switched on below (fake IDs) so the cookie banner is tested; every other test has
    // already answered it with "Only necessary", so the banner never covers what they click
    // the service worker would sit between page.route() and the page; only the app test turns it on
    serviceWorkers: "block",
    storageState: { cookies: [{ name: "asson_consent", value: "essential", domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    // The data cache (unstable_cache) lives on disk under distDir/cache and survives restarts.
    // Each run re-seeds the database with new IDs, so start from an empty cache.
    command: `npx tsx tests/e2e/prepare-db.ts && npx next build && rm -rf .next-e2e/cache && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false, // always start from a freshly seeded database
    env: { DATABASE_URL: E2E_DB, NEXT_DIST_DIR: ".next-e2e", AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0001", NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`, CRON_SECRET: "e2e-cron-secret", AUTH_CODES_TEST: "1" /* one-time codes shown on screen, as on staging */, MEDIA_DIR: ".next-e2e/media", META_PIXEL_ID: "1234567890123456", TIKTOK_PIXEL_ID: "CTEST0000000000000", GA4_MEASUREMENT_ID: "G-TEST000000" },
  },
});
