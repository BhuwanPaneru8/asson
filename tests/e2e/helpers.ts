import { expect, type Page } from "@playwright/test";

/** Demo accounts from prisma/seed.ts (E2E database only). */
export const ACCOUNTS = {
  owner: { email: "admin@asson.test", password: "Admin@12345" },
  manager: { email: "manager@asson.test", password: "Manager@12345" },
  cashier: { email: "cashier@asson.test", password: "Cashier@12345" },
};

export async function signIn(page: Page, who: keyof typeof ACCOUNTS, next = "/admin") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(ACCOUNTS[who].email);
  await page.getByLabel("Password", { exact: true }).fill(ACCOUNTS[who].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
