import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner loads the starter procedures; a cashier reads one from Today and signs it", async ({ page }) => {
  await signIn(page, "owner", "/admin/training");
  const load = page.getByRole("button", { name: "Load the starter procedures" });
  await expect(load.or(page.getByRole("link", { name: /Selling at the till/ }))).toBeVisible();
  if (await load.isVisible()) {
    await load.click();
    await expect(page.getByText(/procedure\(s\) added/)).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /Selling at the till/ })).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, "cashier", "/admin/today");
  const card = page.getByRole("link", { name: /Selling at the till/ });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole("heading", { name: "Selling at the till" })).toBeVisible();
  await expect(page.getByText(/cashiers can give up to 5% on their own/i)).toBeVisible();
  await page.getByRole("button", { name: /I've read this and will follow it|read the new version/ }).click();
  await expect(page.getByText("You've signed this version.")).toBeVisible();
});
