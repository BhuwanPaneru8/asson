import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a customer calls before packing: staff swap the size, and the timeline says so", async ({ page }) => {
  await page.goto("/p/oxford-button-down-shirt");
  await page.getByRole("button", { name: /^Size M/ }).click();
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await expect(page.getByRole("dialog", { name: /Your bag/ })).toBeVisible();
  await page.goto("/checkout");
  await page.getByLabel("Email", { exact: true }).fill("e2e.edit@example.com");
  await page.getByLabel("Mobile number").fill("9841234569");
  await page.getByLabel("Full name").fill("E2E Editor");
  await page.getByLabel("Phone", { exact: true }).fill("9841234569");
  await page.getByLabel("District").selectOption("Lalitpur");
  await page.getByLabel("City / municipality").fill("Lalitpur");
  await page.getByLabel("Tole / street, house no.").fill("Pulchowk-3");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: /Thank you/ })).toBeVisible();
  const orderNumber = (await page.locator("b", { hasText: /^AS\d{6}$/ }).first().textContent())!;

  await signIn(page, "owner", `/admin/orders?q=${orderNumber}`);
  await page.getByRole("link", { name: orderNumber }).click();
  await expect(page.getByRole("heading", { name: "Change this order" })).toBeVisible();
  const pick = page.getByLabel(/^New size for Oxford Button-Down Shirt M$/);
  const label = (await pick.locator("option").allTextContents()).find((t) => / L \(| S \(|XL \(/.test(t)) ?? (await pick.locator("option").nth(1).innerText());
  await pick.selectOption({ label });
  await page.getByRole("button", { name: /^Swap/ }).click();
  await expect(page.getByText("Size swapped: the new one is reserved")).toBeVisible();
  await expect(page.getByText(/^Changed: Oxford Button-Down Shirt: 1 × .* M → /)).toBeVisible();
});
