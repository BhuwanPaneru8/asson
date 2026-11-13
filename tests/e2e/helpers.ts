import { expect, type Page } from "@playwright/test";

/** Demo accounts from prisma/seed.ts (E2E database only). */
export const ACCOUNTS = {
  owner: { email: "admin@asson.test", password: "Admin@12345" },
  manager: { email: "manager@asson.test", password: "Manager@12345" },
  cashier: { email: "cashier@asson.test", password: "Cashier@12345" },
};

// Sessions are reused per account within a worker: the login rate limit (8 per account per 15 min, as in
// production) would otherwise lock the owner out once the suite has more than 8 tests that sign in.
type Cookies = Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>;
const sessions = new Map<keyof typeof ACCOUNTS, Cookies>();

export async function signIn(page: Page, who: keyof typeof ACCOUNTS, next = "/admin") {
  const saved = sessions.get(who);
  if (saved) {
    await page.context().addCookies(saved);
    await page.goto(next);
    if (!/\/login/.test(page.url())) return; // still valid
    await page.context().clearCookies();
  }
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.waitForLoadState("networkidle"); // the sign-in panel needs its JavaScript before typing
  // one-step sign-in: who you are, then your password
  await page.getByLabel("Mobile number or email").fill(ACCOUNTS[who].email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password", { exact: true }).fill(ACCOUNTS[who].password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  // only the session cookie: a bag or language cookie from one test must not leak into the next
  sessions.set(who, (await page.context().cookies()).filter((c) => c.name === "tl_session"));
}
