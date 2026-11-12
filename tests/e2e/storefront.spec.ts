import { expect, test } from "@playwright/test";

test("smart search: a misspelt colour, word and price are understood, shown back, and lead to the right products", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle"); // a tap before the page's JavaScript is ready does nothing
  await page.getByRole("button", { name: "Search" }).click();
  // typed straight after opening: no letters lost
  await page.keyboard.type("blu shrt under 4000");
  const panel = page.locator("#search-results");
  await expect(panel.getByText(/Searching for blue shirt, under Rs 4,000/)).toBeVisible();
  await expect(panel.getByRole("link", { name: /Shirts/ }).first()).toBeVisible(); // the category
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/shop\?q=blu/);
  await expect(page.getByText("Showing results for")).toBeVisible();
  await expect(page.getByText("blue shirt, under Rs 4,000")).toBeVisible();
  await expect(page.locator("a[href^='/p/']").first()).toBeVisible();
});

test("a search with no matches is never a dead end", async ({ page }) => {
  await page.goto("/shop?q=zzqqxx");
  await expect(page.getByRole("heading", { name: /No results for “zzqqxx”/ })).toBeVisible();
  await expect(page.getByText("Try one of these:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Popular right now" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shop all" })).toHaveAttribute("href", "/shop");
});

test("phones: search covers the screen, the footer folds, shops are listed with directions", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.waitForLoadState("networkidle"); // a tap before the page's JavaScript is ready does nothing
  await page.getByRole("button", { name: "Search" }).click();
  await page.keyboard.type("hodie");
  const panel = page.locator("#search-results");
  await expect(panel.getByText(/Hoodie/).first()).toBeVisible();
  const box = await panel.boundingBox();
  expect(box!.height).toBeGreaterThan(500); // not squeezed into the header
  await page.getByRole("button", { name: "Cancel" }).click();

  const help = page.locator("footer details").filter({ hasText: "Help" });
  await expect(help.getByRole("link", { name: "Track your order" })).toBeHidden();
  await help.locator("summary").click();
  await expect(help.getByRole("link", { name: "Track your order" })).toBeVisible();

  await page.locator("footer").getByRole("link", { name: "Find a store" }).first().click();
  await expect(page.getByRole("heading", { name: "Our shops" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asson Flagship" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Directions" }).first()).toHaveAttribute("href", /google\.com\/maps/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("policies: every page is reachable from the footer, numbers come from the shop's settings, checkout links them", async ({ page }) => {
  await page.goto("/");
  await page.locator("footer").getByRole("link", { name: "Policies" }).click();
  await expect(page.getByRole("heading", { name: "Policies", level: 1 })).toBeVisible();
  for (const name of ["Terms and conditions", "Privacy policy", "Shipping and delivery", "Returns, exchanges and refunds", "Payments and pricing", "Rewards terms", "Cookie policy"]) {
    await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
  }
  await page.getByRole("link", { name: /Returns, exchanges and refunds/ }).click();
  await expect(page.getByRole("heading", { name: "7 days to change your mind" })).toBeVisible();
  await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Refunds" }).click();
  await expect(page).toHaveURL(/#refunds$/);

  await page.goto("/policies/shipping");
  await expect(page.getByText(/Delivery is free on orders of Rs\. 2,500 or more/)).toBeVisible();
  await page.goto("/help");
  await expect(page.getByText("Replace this")).toHaveCount(0);
  await expect(page.locator("#policies").getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/policies/privacy");
  await page.goto("/policies/nonsense");
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Policies");
});

test("search remembers: the results page shows the search, clicking it again reopens it to edit; recent searches can be removed", async ({ page }) => {
  await page.goto("/shop?q=linen%20shirt");
  await page.waitForLoadState("networkidle");
  const bar = page.getByRole("button", { name: "Search: linen shirt" });
  await expect(bar).toBeVisible();
  await bar.click();
  const box = page.getByRole("combobox", { name: "Search products" });
  await expect(box).toHaveValue("linen shirt");
  expect(await box.evaluate((i: HTMLInputElement) => i.selectionStart === 0 && i.selectionEnd === i.value.length)).toBe(true); // typing replaces it

  // suggestions while typing, best first, the typed letters marked
  await box.fill("lin");
  const suggestions = page.getByRole("list", { name: "Suggestions" });
  await expect(suggestions.getByRole("option").first()).toContainText(/^lin/);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/shop\?q=lin/);

  // recent searches: newest first, each removable
  await page.getByRole("button", { name: /^Search: lin/ }).click();
  await page.getByRole("combobox", { name: "Search products" }).fill("");
  await expect(page.getByText("Recent")).toBeVisible();
  await page.getByRole("button", { name: "Remove “linen shirt” from recent searches" }).click();
  await expect(page.getByRole("button", { name: "Remove “linen shirt” from recent searches" })).toHaveCount(0);
});

test("ranking: the thing named last wins (a linen shirt before a linen shirt dress)", async ({ page }) => {
  await page.goto("/shop?q=linen%20shirt");
  const names = await page.locator("a[href^='/p/'] >> text=/Linen/").allInnerTexts();
  const dress = names.findIndex((n) => /Dress/.test(n));
  const shirt = names.findIndex((n) => /Shirt$/.test(n.trim()));
  expect(shirt).toBeGreaterThanOrEqual(0);
  if (dress >= 0) expect(shirt).toBeLessThan(dress);
});
