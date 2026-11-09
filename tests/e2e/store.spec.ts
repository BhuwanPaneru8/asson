import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("cashier sells at the till and is kept out of the back office", async ({ page }) => {
  await signIn(page, "cashier");
  await expect(page).toHaveURL(/\/admin\/pos/);
  await page.getByLabel("Opening cash (Rs.)").fill("5000");
  await page.getByRole("button", { name: "Open shift" }).click();

  const scan = page.getByLabel("Scan or search");
  await scan.fill("AS-01104");
  await scan.press("Enter");
  await scan.fill("AS-01104");
  await scan.press("Enter");
  await expect(page.getByText("Oxford Button-Down Shirt")).toBeVisible();
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await page.getByLabel("Cash received").fill("5000");
  await expect(page.getByText(/give change Rs\. 202/)).toBeVisible();
  await page.getByRole("button", { name: /Complete sale/ }).click();
  await expect(page.getByText("Sale complete", { exact: false })).toBeVisible();
  await expect(page.getByText(/Give change: Rs\. 202/)).toBeVisible();

  for (const path of ["/admin/orders", "/admin/finance", "/admin/closing", "/admin/purchasing"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/pos/);
  }
});
