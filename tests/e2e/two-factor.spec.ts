import { expect, test, type Page } from "@playwright/test";
import { signIn, totpCode } from "./helpers";

async function passwordSignIn(page: Page, email: string, password: string) {
  await page.goto("/login?next=/admin");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Mobile number or email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/$/);
}

test("a new manager sets up an authenticator app, signs in with a code, and a trusted device skips it; the owner can reset it", async ({ browser }) => {
  test.setTimeout(150_000); // codes work once: some steps wait for the app's next 30-second code
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", "/admin/team");
  await owner.waitForLoadState("networkidle");
  const email = `e2e.manager.${Date.now()}@asson.test`;
  await owner.getByLabel("Full name").fill("Ram Karki");
  await owner.getByLabel("Email (their sign-in)").fill(email);
  await owner.getByLabel("Job", { exact: true }).selectOption("shop-manager");
  const addForm = owner.locator("form").filter({ has: owner.getByRole("button", { name: "Add and get their link" }) });
  await addForm.getByRole("checkbox", { name: "Asson Flagship" }).check();
  await owner.getByRole("button", { name: "Add and get their link" }).click();
  const link = (await owner.locator("p.font-mono").innerText()).trim();
  const row = owner.locator("li").filter({ hasText: email });
  await expect(row.getByText("Two-step required, not set up")).toBeVisible();

  // Ram, on his own phone: password from the invite, then set-up before any staff page
  const ram = await (await browser.newContext()).newPage();
  await ram.goto(new URL(link).pathname);
  await ram.waitForLoadState("networkidle");
  await ram.getByLabel("New password").fill("Ram2026pass");
  await ram.getByLabel("The same password again").fill("Ram2026pass");
  await ram.getByRole("button", { name: "Set password and sign in" }).click();
  await expect(ram).toHaveURL(/\/login\/two-factor/);
  await expect(ram.getByRole("heading", { name: "Set up two-step sign-in" })).toBeVisible();
  await ram.goto("/admin"); // no way round it
  await expect(ram).toHaveURL(/\/login/);
  await ram.goto("/login/two-factor");
  await ram.waitForLoadState("networkidle");
  await ram.getByRole("button", { name: "Set up authenticator app" }).click();
  await expect(ram.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  await ram.getByText("Can't scan it? Enter this key instead").click();
  const secret = (await ram.getByTestId("totp-secret").innerText()).replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  const last = { step: null as number | null };
  await ram.getByLabel("Code from the app").fill(await totpCode(secret, last));
  await ram.getByRole("button", { name: "Turn on two-step sign-in" }).click();
  await expect(ram.getByText("Two-step sign-in is on")).toBeVisible();
  const codes = ram.getByRole("list", { name: "Backup codes" }).getByRole("listitem");
  await expect(codes).toHaveCount(10);
  await expect(ram.getByRole("button", { name: "Continue" })).toBeDisabled(); // not until they say they've kept them
  await ram.getByRole("checkbox", { name: "I've saved my backup codes" }).check();
  await ram.getByRole("button", { name: "Continue" }).click();
  await expect(ram).toHaveURL(/\/admin/);
  await expect(ram.getByRole("navigation", { name: "Staff menu" }).first()).toBeVisible();
  await ram.goto("/admin/me");
  await expect(ram.getByText("Two-step sign-in is on (authenticator app)")).toBeVisible();
  await expect(ram.getByText("10 of 10 backup codes left", { exact: false })).toBeVisible();
  await expect(ram.getByRole("button", { name: "Turn off" })).toHaveCount(0); // managers always use it

  // sign out, sign in: the password, then a code
  await signOut(ram);
  await passwordSignIn(ram, email, "Ram2026pass");
  await expect(ram).toHaveURL(/\/login\/two-factor/);
  await expect(ram.getByRole("heading", { name: "Two-step sign-in" })).toBeVisible();
  await ram.waitForLoadState("networkidle");
  await ram.getByLabel("Code", { exact: true }).fill("000000");
  await ram.getByRole("button", { name: "Verify" }).click();
  await expect(ram.getByText("That code isn't right", { exact: false })).toBeVisible();
  await ram.getByLabel("Code", { exact: true }).fill(await totpCode(secret, last));
  await ram.getByRole("checkbox", { name: "Trust this device for 30 days" }).check();
  await ram.getByRole("button", { name: "Verify" }).click();
  await expect(ram).toHaveURL(/\/admin/);

  // this device is trusted: next time the password is enough
  await signOut(ram);
  await passwordSignIn(ram, email, "Ram2026pass");
  await expect(ram).toHaveURL(/\/admin/);
  await expect(ram).not.toHaveURL(/\/login/);

  // the owner sees it on, and resets it (lost phone): Ram is signed out and sets it up again, trusted device or not
  await owner.reload();
  await expect(row.getByText("Two-step on")).toBeVisible();
  await row.getByRole("button", { name: "Reset two-step sign-in" }).click();
  await row.getByLabel("Why (kept in the record)").last().fill("Lost phone, checked by call");
  await row.getByRole("button", { name: "Reset for Ram" }).click();
  await expect(owner.getByText("Ram is signed out and sets up two-step sign-in again at next sign-in")).toBeVisible();
  await ram.goto("/admin/me");
  await expect(ram).toHaveURL(/\/login/);
  await passwordSignIn(ram, email, "Ram2026pass");
  await expect(ram.getByRole("heading", { name: "Set up two-step sign-in" })).toBeVisible();

  await owner.goto("/admin/activity");
  await expect(owner.getByText(/Two-step sign-in reset for Ram Karki/).first()).toBeVisible();
});
