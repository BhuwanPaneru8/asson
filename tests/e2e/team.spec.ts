import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner adds a cashier with a one-time link; the cashier sets their password and sees only the till's sections", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", "/admin/team");
  await expect(owner.getByRole("heading", { name: "Team & access" })).toBeVisible();
  await owner.waitForLoadState("networkidle"); // typing before the form is ready would be lost
  const email = `e2e.cashier.${Date.now()}@asson.test`;
  await owner.getByLabel("Full name").fill("Gita Thapa");
  await owner.getByLabel("Email (their sign-in)").fill(email);
  await owner.getByLabel("Job", { exact: true }).selectOption("cashier");
  const addForm = owner.locator("form").filter({ has: owner.getByRole("button", { name: "Add and get their link" }) });
  await addForm.getByRole("checkbox", { name: "Asson Flagship" }).check();
  await owner.getByRole("button", { name: "Add and get their link" }).click();
  const link = (await owner.locator("p.font-mono").innerText()).trim();
  expect(link).toMatch(/\/invite\/[\w-]{20,}$/);

  // the new person, in their own browser
  const gita = await (await browser.newContext()).newPage();
  await gita.goto(new URL(link).pathname);
  await expect(gita.getByRole("heading", { name: "Welcome, Gita" })).toBeVisible();
  await gita.waitForLoadState("networkidle");
  await gita.getByLabel("New password").fill("Gita2026pass");
  await gita.getByLabel("The same password again").fill("Gita2026pass");
  await gita.getByRole("button", { name: "Set password and sign in" }).click();
  await expect(gita).toHaveURL(/\/admin\/pos/);
  const menu = gita.getByRole("navigation", { name: "Staff menu" }).first();
  await expect(menu.getByRole("link", { name: "Point of sale" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Finance" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Team & access" })).toHaveCount(0);
  await gita.goto("/admin/finance");
  await expect(gita).toHaveURL(/\/admin\/pos/); // sent back to the till

  // the link worked once
  const again = await (await browser.newContext()).newPage();
  await again.goto(new URL(link).pathname);
  await expect(again.getByRole("heading", { name: "This link has expired" })).toBeVisible();

  // the owner's menu is in sections
  await expect(owner.getByRole("navigation", { name: "Staff menu" }).first().getByText("Settings", { exact: true })).toBeVisible();
});
