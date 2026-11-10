import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner adds monthly rent for a shop and sees it in profit by shop, adding up to the company P&L", async ({ page }, info) => {
  const tag = `${Date.now() % 100000}-${info.retry}`;
  const digits = (t: string) => t.replace(/[^\d]/g, "");
  const rentAtFlagship = async () => Number(digits((await page.getByRole("row", { name: /Asson Flagship/ }).locator("td").nth(4).innerText()).split("\n")[0]) || 0);
  await signIn(page, "owner", "/admin/finance/shops");
  const before = await rentAtFlagship();
  await page.goto("/admin/finance");
  await page.getByLabel("Recurring location").selectOption({ label: "Asson Flagship" });
  await page.getByLabel("Recurring category").selectOption("RENT");
  await page.getByLabel("Recurring description").fill(`Flagship rent ${tag}`);
  await page.getByLabel("Monthly amount").fill("45000");
  await page.getByRole("button", { name: "Add monthly cost" }).click();
  await expect(page.getByText(`Flagship rent ${tag} (monthly)`)).toBeVisible(); // this month's is posted at once
  await expect(page.getByRole("row", { name: new RegExp(`Flagship rent ${tag}`) }).getByText("Asson Flagship")).toBeVisible();

  await page.getByRole("link", { name: "Profit by shop" }).click();
  await expect(page.getByRole("heading", { name: /Profit by shop/ })).toBeVisible();
  expect(await rentAtFlagship()).toBe(before + 45_000); // shown in rupees
  await expect(page.getByRole("row", { name: /^Company/ })).toBeVisible();
  // the company line here equals the Finance page's net profit (same figure, digit for digit)
  const company = digits((await page.getByRole("row", { name: /^Company/ }).locator("td").nth(4).innerText()).split("\n")[0]);
  await page.getByRole("link", { name: "Company P&L" }).click();
  const net = page.locator("div.flex.justify-between", { hasText: /^Net profit/ });
  expect(digits(await net.innerText())).toBe(company);
});
