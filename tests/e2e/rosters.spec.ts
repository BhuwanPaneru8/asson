import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a manager plans next week, a bad shift is caught, publishing shows the cashier their shift on Today", async ({ page }) => {
  await signIn(page, "owner", "/admin/rosters");
  await page.getByRole("link", { name: "Asson Flagship", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Rosters · Asson Flagship" })).toBeVisible();
  const week = (await page.getByText(/^Week of \d{4}-\d{2}-\d{2}$/).innerText()).slice(8); // next week by default
  const sunday = page.getByLabel(`Ram Cashier ${week}`);
  await expect(sunday).toBeVisible();

  // an impossible shift time can't be saved
  await sunday.fill("25-30");
  await expect(page.getByRole("button", { name: /^Save 1 change$/ })).toBeDisabled();
  await sunday.fill("10-18");
  const save = page.getByRole("button", { name: /^Save 1 change$/ });
  if (await save.isVisible()) { // already 10-18 when a retry runs against the same database
    await save.click();
    await expect(page.getByText(/^Saved: 1 set, 0 removed$/)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.getByRole("button", { name: "Publish to staff" }).click();
  await expect(page.getByText(/^Published: staff can see their \d+ shifts$/)).toBeVisible();
  await expect(page.getByText(/^published /)).toBeVisible();

  // the cashier sees it among the next 7 days
  await page.context().clearCookies();
  await signIn(page, "cashier", "/admin/today");
  const mine = page.locator("li").filter({ hasText: week.slice(5) }).filter({ hasText: "Asson Flagship" });
  await expect(mine).toContainText("10–18");
});
