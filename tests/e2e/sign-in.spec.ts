import { expect, test } from "@playwright/test";

test("sign in from the side panel without leaving the product page", async ({ page }) => {
  await page.goto("/p/oxford-button-down-shirt");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Sign in / Create account" }).click();
  const panel = page.getByRole("dialog");
  await panel.getByLabel("Mobile number or email").fill("customer@asson.test");
  await panel.getByRole("button", { name: "Continue" }).click();
  await expect(panel.getByRole("heading", { name: "Welcome back, Aarav" })).toBeVisible();
  await panel.getByLabel("Password", { exact: true }).fill("Customer@12345");
  await panel.getByRole("button", { name: "Show password" }).click();
  await expect(panel.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await panel.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/p\/oxford-button-down-shirt/); // back where they were
  await expect(page.getByRole("link", { name: "Account" })).toBeVisible();
});

test("a new shopper signs up with just their mobile and a one-time code", async ({ page }) => {
  const phone = `98${String(Date.now()).slice(-8)}`;
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Mobile number or email").fill(phone);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByRole("button", { name: "Or sign up with a code by SMS" }).click();
  const test = await page.getByText(/Test mode .*: your code is \d{6}/).innerText();
  await page.getByLabel("6-digit code").fill(test.match(/(\d{6})/)![1]);
  await page.getByLabel("Your name").fill("Maya Gurung");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/account/);
});

test("a wrong password says so, and forgotten passwords have a way back", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Mobile number or email").fill("customer@asson.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password", { exact: true }).fill("wrong-password1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "isn't right" })).toBeVisible();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByText(/send you a link to set a new password/)).toBeVisible(); // email accounts: customer care's link
});
