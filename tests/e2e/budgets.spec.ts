import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner sets this month's target for the Flagship; the shop sees its progress on Today", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", "/admin/finance");
  await owner.getByRole("link", { name: "Budgets" }).click();
  await expect(owner.getByRole("heading", { name: /Budgets ·/ })).toBeVisible();
  await owner.getByLabel("Asson Flagship sales target").fill("500000");
  await owner.getByLabel("Asson Flagship margin target").fill("55");
  await owner.getByLabel("Asson Flagship cost budget").fill("150000");
  await owner.getByRole("button", { name: "Save budgets" }).click();
  await expect(owner.getByText(/Saved \d+ plan\(s\)/)).toBeVisible();
  await owner.reload();
  const row = owner.getByRole("row", { name: /Asson Flagship/ }).first();
  await expect(row).toContainText("Rs. 5,00,000");
  await expect(row).toContainText("target 55%");

  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, "cashier", "/admin/today");
  const flagship = cashier.getByRole("link", { name: "Asson Flagship", exact: true });
  if (await flagship.count()) await flagship.click();
  await expect(cashier.getByRole("heading", { name: "This month's sales target" })).toBeVisible();
  await expect(cashier.getByText(/of Rs\. 5,00,000/)).toBeVisible();
  await expect(cashier.getByText(/heading for Rs\./)).toBeVisible();
  await expect(cashier.getByText("Cost budget")).toHaveCount(0); // staff never see costs
});
