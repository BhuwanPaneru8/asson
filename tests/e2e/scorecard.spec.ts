import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("HQ compares shops on the scorecard and opens one shop's detail", async ({ page }) => {
  await signIn(page, "owner", "/admin/scorecard");
  await expect(page.getByRole("heading", { name: "Shop scorecard" })).toBeVisible();
  const row = page.getByRole("row", { name: /Asson Flagship/ });
  await expect(row).toBeVisible();
  await expect(page.getByRole("row", { name: /warehouse/i })).toHaveCount(0); // shops only
  await page.getByRole("link", { name: "Needs attention" }).click();
  await expect(page).toHaveURL(/sort=flags/);
  await page.getByRole("link", { name: "90 days" }).click();
  await expect(page).toHaveURL(/days=90/);
  await page.getByRole("row", { name: /Asson Flagship/ }).getByRole("link", { name: "Asson Flagship" }).click();
  await expect(page.getByRole("heading", { name: "Asson Flagship" })).toBeVisible();
  await expect(page.getByText("Operations score", { exact: true })).toBeVisible();
  for (const card of ["Checklists · last 14 days", "Store visits", "Display audits", "Customer care about this shop"]) await expect(page.getByRole("heading", { name: card, exact: true })).toBeVisible();
});
