import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a damaged unit is taken off sale, shows in the damaged register, and goes back on sale once repaired", async ({ page }) => {
  await signIn(page, "owner", "/admin/inventory?q=Silk%20Blend%20Nehru%20Jacket");
  // a size with stock at the location the adjustment applies to (the first location column)
  const rows = page.getByRole("row").filter({ hasText: "Silk Blend Nehru Jacket" });
  await expect(rows.first()).toBeVisible();
  let row = rows.first();
  for (const r of await rows.all()) if (Number((await r.locator("td").nth(3).innerText()).trim()) > 0) { row = r; break; }
  const sku = (await row.locator("td").first().innerText()).trim();
  await row.getByLabel(`Quantity for ${sku}`).fill("1");
  await row.getByLabel("Reason").selectOption("DAMAGED");
  await row.getByRole("button", { name: "Remove stock" }).click();
  await expect(page.getByText(new RegExp(`^${sku}: \\d+ at `))).toBeVisible();

  await page.goto("/admin/damaged");
  const held = page.getByRole("row").filter({ hasText: sku });
  await expect(held).toContainText("Silk Blend Nehru Jacket");
  await held.getByRole("button", { name: "Deal with it" }).click();
  await held.getByLabel("What happened").selectOption("REPAIRED");
  await held.getByLabel("How many").fill("1");
  await held.getByLabel("Damage note").fill("seam re-stitched");
  await held.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Done", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Repaired: back on sale" }).first()).toContainText("seam re-stitched");
});
