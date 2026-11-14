import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// The site as a phone app: manifests, icons, the service worker and the offline page.
test.use({ serviceWorkers: "allow" });

test("the shop installs as an app and shows a friendly page when the phone goes offline", async ({ page, context, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/shop-apple-180.png");

  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Asson", start_url: "/", display: "standalone" });
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.headers()["content-type"]).toBe("image/png");
    expect((await res.body()).length).toBeGreaterThan(500);
  }
  expect((await request.get("/icons/nope.png")).status()).toBe(404);
  expect((await request.get("/sw.js")).headers()["cache-control"]).toContain("no-store");

  // the worker takes charge of the page once it has saved the offline page
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // no connection: any page shows the offline page, at the address the shopper asked for
  await context.setOffline(true);
  await page.goto("/p/oxford-button-down-shirt").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "You’re offline" })).toBeVisible();
  await expect(page).toHaveURL(/\/p\/oxford-button-down-shirt$/);
  // the page keeps its styling offline (its CSS was saved with it)
  expect(await page.getByRole("button", { name: /Try again/ }).evaluate((b) => getComputedStyle(b).backgroundColor)).toBe("rgb(20, 20, 20)");

  // back online: the page comes back by itself
  await context.setOffline(false);
  await expect(page.getByRole("heading", { name: "Oxford button-down shirt", exact: false })).toBeVisible({ timeout: 15_000 });
});

test("staff get their own app for the admin", async ({ page, request }) => {
  await signIn(page, "owner");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/admin.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/admin-apple-180.png");
  // fetched without cookies, as browsers do: must not bounce to the sign-in page
  const res = await request.get("/admin.webmanifest", { headers: { cookie: "" }, maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ name: "Asson Admin", scope: "/admin", start_url: "/admin" });
});
