import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("at the till, a cashier orders a size from the warehouse for the customer to collect here, paying on collection", async ({ page }) => {
  await signIn(page, "cashier", "/admin/pos");
  const opening = page.getByLabel("Opening cash (Rs.)");
  await expect(opening.or(page.getByRole("button", { name: "Order for a customer" }))).toBeVisible();
  if (await opening.isVisible()) {
    await opening.fill("5000");
    await page.getByRole("button", { name: "Open shift" }).click();
  }
  await page.getByRole("button", { name: "Order for a customer" }).click();
  await page.getByLabel("Search item to order").fill("Oxford Button-Down Shirt");
  await page.getByRole("button", { name: "Find" }).click();
  const orderable = page.getByRole("button", { name: /^Order Oxford Button-Down Shirt/ }).and(page.locator(":not([disabled])")).first();
  await expect(orderable).toBeVisible();
  await orderable.click();
  await page.getByLabel("Customer name").fill("E2E Walk-in");
  await page.getByLabel("Customer mobile").fill("9841000111");
  await page.getByRole("button", { name: "Pay when collecting" }).click();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Ordered", { exact: true })).toBeVisible();
  await expect(page.getByText(/^AS\d{6}$/)).toBeVisible();
  await expect(page.getByText(/to pay when they collect/)).toBeVisible();
});
