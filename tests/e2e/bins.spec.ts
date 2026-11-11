import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("warehouse staff scan a size into a bin; the bin list and pick list show it", async ({ page }) => {
  await signIn(page, "owner", "/admin/bins");
  await page.getByRole("link", { name: "Main warehouse", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bins · Main warehouse" })).toBeVisible();
  // take a size that's in stock here with no bin yet
  const first = page.getByRole("heading", { name: /^In stock, no bin yet/ }).locator("xpath=../..").locator("li .font-mono").first();
  test.skip(!(await first.count()), "every size here already has a bin");
  const sku = (await first.innerText()).trim();
  const bin = `Z-${Date.now() % 90 + 10}-1`;
  await page.getByLabel("Bin", { exact: true }).fill(bin.toLowerCase().replace(/-/g, " "));
  await page.getByLabel("SKU", { exact: true }).fill(sku);
  await page.getByRole("button", { name: "Put in bin" }).click();
  await expect(page.getByText(`✓ ${sku} → ${bin}`)).toBeVisible();
  await expect(page.getByLabel("SKU", { exact: true })).toBeFocused(); // ready for the next scan
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: bin }).first()).toContainText("1 size");
  await page.goto("/admin/picking");
  await expect(page.getByRole("columnheader", { name: "Bin" }).or(page.getByText("Nothing to pick here"))).toBeVisible();
});
