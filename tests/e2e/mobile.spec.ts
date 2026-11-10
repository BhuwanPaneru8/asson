import { expect, test } from "@playwright/test";

const PAGES = ["/", "/c/women", "/p/floral-midi-wrap-dress", "/cart", "/help", "/login", "/size-guide", "/lookbook"];

for (const lang of ["en", "ne"]) {
  for (const path of PAGES) {
    test(`no horizontal scroll on ${path}${lang === "ne" ? " (नेपाली)" : ""}`, async ({ page, context, baseURL }) => {
      // Nepali words run longer than English; the layout must still fit a phone
      if (lang === "ne") await context.addCookies([{ name: "asson_lang", value: "ne", url: baseURL! }]);
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("the phone menu opens full height (not trapped inside the sticky header)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("link", { name: "Track an order" })).toBeVisible();
  expect((await panel.boundingBox())!.height).toBeGreaterThan(500);
});
