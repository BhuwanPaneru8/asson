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
  await expect(page.getByRole("button", { name: "Email me a reset link" })).toBeVisible(); // a real email: a link by email
  await expect(page.getByRole("button", { name: "Ask us to reset it" })).toBeVisible(); // and customer care as a fallback
});

test("forgot password from the first screen: an email link sets a new one and signs in", async ({ page }) => {
  const email = `reset${Date.now()}@test.local`;
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Mobile number or email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Your name").fill("Reset Tester");
  await page.getByLabel("Password", { exact: true }).fill("Firstpass2026");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/account/);
  await page.context().clearCookies();

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Mobile number or email").fill(email);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByRole("button", { name: "Email me a reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const link = await page.getByRole("link", { name: /\/reset\// }).getAttribute("href");
  await page.goto(link!);
  await page.getByLabel("New password").fill("Secondpass2026");
  await page.getByLabel(/again/i).fill("Secondpass2026");
  await page.getByRole("button", { name: /save/i }).click();
  await expect(page).toHaveURL(/\/account/);
});

test("forgot password with no SMS or email: one tap asks customer care", async ({ page }) => {
  const phone = `97${String(Date.now()).slice(-8)}`;
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Mobile number or email").fill(phone);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Or sign up with a code by SMS" }).click();
  const code = await page.getByText(/Test mode .*: your code is \d{6}/).innerText();
  await page.getByLabel("6-digit code").fill(code.match(/(\d{6})/)![1]);
  await page.getByLabel("Your name").fill("Phone Only");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/account/);
  await page.context().clearCookies();

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Mobile number or email").fill(phone);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByRole("button", { name: "Ask us to reset it" }).click(); // under "Can't get to that phone?"
  await expect(page.getByRole("heading", { name: "We've got your request" })).toBeVisible();
  await expect(page.getByText(/request number is #\d+/)).toBeVisible();
});
