import { expect, type Page } from "@playwright/test";
import { totpAt, totpStep } from "../../src/lib/two-factor-core";
import { E2E_TOTP } from "./two-factor-accounts";

/** Demo accounts from prisma/seed.ts (E2E database only). The owner and manager use two-step sign-in. */
export const ACCOUNTS = {
  owner: { email: "admin@asson.test", password: "Admin@12345" },
  manager: { email: "manager@asson.test", password: "Manager@12345" },
  cashier: { email: "cashier@asson.test", password: "Cashier@12345" },
};

// Sessions are reused per account within a worker: the login rate limit (8 per account per 15 min, as in
// production) would otherwise lock the owner out once the suite has more than 8 tests that sign in.
type Cookies = Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>;
const sessions = new Map<keyof typeof ACCOUNTS, Cookies>();
// "Trust this device" cookies, so a fresh sign-in after the first asks for the password only
const trusted = new Map<keyof typeof ACCOUNTS, Cookies>();

/**
 * The authenticator code an app would show now. A code works once, so after `last` this waits for the next
 * 30-second step (one step ahead is accepted, so usually no wait).
 */
export async function totpCode(secret: string, last: { step: number | null }) {
  let step = totpStep();
  if (last.step != null && step <= last.step) step = last.step + 1;
  const wait = (step - 1) * 30_000 - Date.now(); // the server accepts the step after the current one
  if (wait > 0) await new Promise((r) => setTimeout(r, wait + 500));
  last.step = step;
  return totpAt(secret, step);
}
const lastStep: Record<string, { step: number | null }> = {};

export async function signIn(page: Page, who: keyof typeof ACCOUNTS, next = "/admin") {
  const saved = sessions.get(who);
  if (saved) {
    await page.context().addCookies(saved);
    await page.goto(next);
    if (!/\/login/.test(page.url())) return; // still valid
    await page.context().clearCookies({ name: /^(?!asson_consent$)/ }); // keep the cookie-banner answer
  }
  const trust = trusted.get(who);
  if (trust) await page.context().addCookies(trust);
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.waitForLoadState("networkidle"); // the sign-in panel needs its JavaScript before typing
  // one-step sign-in: who you are, then your password
  await page.getByLabel("Mobile number or email").fill(ACCOUNTS[who].email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password", { exact: true }).fill(ACCOUNTS[who].password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(\?|$)/);
  // managers and owners: the code from their authenticator app (known secret in the E2E database only)
  if (/\/login\/two-factor/.test(page.url())) {
    const secret = E2E_TOTP[who as keyof typeof E2E_TOTP];
    if (!secret) throw new Error(`${who} has no known two-step secret`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Code", { exact: true }).fill(await totpCode(secret, (lastStep[who] ??= { step: null })));
    await page.getByRole("checkbox", { name: "Trust this device for 30 days" }).check();
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).not.toHaveURL(/\/login/);
    trusted.set(who, (await page.context().cookies()).filter((c) => c.name.startsWith("tl_trust_")));
  }
  // only the session cookie: a bag or language cookie from one test must not leak into the next
  sessions.set(who, (await page.context().cookies()).filter((c) => c.name === "tl_session"));
}
