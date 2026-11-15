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
  await expect(page.getByRole("button", { name: /^Email c\*+@asson\.test$/ })).toBeVisible(); // a real email: a code by email
  await expect(page.getByRole("button", { name: "Ask us to reset it" })).toBeVisible(); // and customer care as a fallback
});

test("forgot password from the first screen: a code by email or WhatsApp sets a new one and signs in", async ({ page }) => {
  const email = `reset${Date.now()}@test.local`;
  const phone = `96${String(Date.now()).slice(-8)}`;
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Mobile number or email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Your name").fill("Reset Tester");
  await page.getByLabel("Mobile number (optional)").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill("Firstpass2026");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/account/);
  await page.context().clearCookies({ name: /^(?!asson_consent$)/ });

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Mobile number or email").fill(email);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  // every way the account can get a code, masked
  await expect(page.getByRole("button", { name: `WhatsApp ${phone.slice(0, 2)}******${phone.slice(-2)}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Text (SMS) ${phone.slice(0, 2)}******${phone.slice(-2)}` })).toBeVisible();
  await page.getByRole("button", { name: /^Email r\*+@test\.local$/ }).click();
  await expect(page.getByText(/We emailed a 6-digit code to r\*+@test\.local/)).toBeVisible();
  const shown = await page.getByText(/Test mode .*: your code is \d{6}/).innerText();
  await page.getByLabel("6-digit code").fill(shown.match(/(\d{6})/)![1]);
  await page.getByLabel("New password").fill("Secondpass2026");
  await page.getByRole("button", { name: "Save and sign in" }).click();
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

test("staff and shoppers have separate sign-in pages", async ({ page }) => {
  // the staff side sends anyone not signed in to its own sign-in page
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Forders/);
  await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
  // a shopper's account doesn't open it
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email or mobile number").fill("customer@asson.test");
  await page.getByLabel("Password", { exact: true }).fill("Customer@12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "don't match a staff account" })).toBeVisible();

  // the shop's sign-in sends staff to their own page
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Mobile number or email").fill("cashier@asson.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "This is a staff account" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Go to staff sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});
