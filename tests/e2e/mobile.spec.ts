import { expect, test } from "@playwright/test";

for (const path of ["/", "/c/women", "/p/floral-midi-wrap-dress", "/cart", "/help"]) {
  test(`no horizontal scroll on ${path}`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
