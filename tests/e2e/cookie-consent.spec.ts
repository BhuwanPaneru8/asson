import { expect, test, type Page } from "@playwright/test";

// The E2E server runs with fake Meta, TikTok and Google IDs (playwright.config.ts). This test starts with
// no answer to the cookie banner; every other test has already chosen "Only necessary".
test.use({ storageState: { cookies: [], origins: [] } });

const TRACKERS = /connect\.facebook\.net|analytics\.tiktok\.com|googletagmanager\.com/;

/** Block the real tracker scripts (no network in tests) and remember which were asked for. */
async function watchTrackers(page: Page) {
  const asked: string[] = [];
  await page.route(TRACKERS, (route) => { asked.push(new URL(route.request().url()).hostname); return route.abort(); });
  return asked;
}

/** Calls queued on the Meta pixel stub (the real script is blocked, so they stay queued). */
const metaCalls = (page: Page) => page.evaluate(() => {
  const q = (window as unknown as { fbq?: { queue?: ArrayLike<unknown>[] } }).fbq?.queue ?? [];
  return Array.from(q).map((a) => Array.from(a).slice(0, 2).join(":"));
});

test("nothing tracks until the shopper accepts; the choice is remembered and can be changed", async ({ page }) => {
  const asked = await watchTrackers(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const banner = page.getByRole("region", { name: "Cookie choices" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Meta, TikTok, Google");
  expect(asked).toEqual([]);
  expect(await page.evaluate(() => typeof (window as unknown as { fbq?: unknown }).fbq)).toBe("undefined");

  // "Only necessary": banner gone, still nothing loaded, and it stays that way on the next visit
  await banner.getByRole("button", { name: "Only necessary" }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(banner).toBeHidden();
  expect(asked).toEqual([]);
  expect((await page.context().cookies()).find((c) => c.name === "asson_consent")?.value).toBe("essential");

  // change of mind from the footer: accept, and the three trackers load with a page view
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await banner.getByRole("button", { name: "Accept all" }).click();
  await expect(banner).toBeHidden();
  await expect.poll(() => [...new Set(asked)].sort()).toEqual(["analytics.tiktok.com", "connect.facebook.net", "www.googletagmanager.com"]);
  await expect.poll(() => metaCalls(page)).toEqual(["init:1234567890123456", "track:PageView"]);
  const gaPageViews = await page.evaluate(() => ((window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer).filter((a) => a[0] === "event" && a[1] === "page_view").length);
  expect(gaPageViews).toBe(1);

  // shopping events: product view, then add to bag (from the bag itself, so every add button counts)
  await page.goto("/p/oxford-button-down-shirt");
  await page.waitForLoadState("networkidle");
  await expect.poll(() => metaCalls(page)).toContain("track:ViewContent");
  await page.getByRole("button", { name: /^Size M/ }).click();
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await expect(page.getByRole("dialog", { name: /Your bag/ })).toBeVisible();
  await expect.poll(() => metaCalls(page)).toContain("track:AddToCart");
  await page.goto("/checkout");
  await page.waitForLoadState("networkidle");
  await expect.poll(() => metaCalls(page)).toContain("track:InitiateCheckout");

  // the cookie policy names the partners now that they're switched on
  await page.goto("/policies/cookies");
  await expect(page.getByRole("heading", { name: "Advertising and analytics (only with your permission)" })).toBeVisible();
  await expect(page.getByText("Google Analytics: _ga, _ga_*")).toBeVisible();
});
