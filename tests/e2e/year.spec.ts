import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner sets up a past fiscal year, sees what blocks closing and downloads its registers", async ({ page }) => {
  // a distinct past year each run (years can't overlap): BS 2020/21 … 2059/60
  const bs = 2020 + (Math.floor(Date.now() / 1000) % 40);
  const ad = bs - 57;
  const label = `${bs}/${String((bs + 1) % 100).padStart(2, "0")}`;
  await signIn(page, "owner", "/admin/finance");
  await page.getByRole("link", { name: "Fiscal year" }).click();
  // the button enables only once the page is live (React state), so typing can't be lost to hydration
  await page.getByLabel("First day of the year").fill(`${ad}-07-16`);
  await page.getByLabel("Last day of the year").fill(`${ad + 1}-07-15`);
  await expect(page.getByRole("button", { name: "Set up" })).toBeEnabled();
  await page.getByLabel("Fiscal year", { exact: true }).fill(label);
  await expect(page.getByLabel("Fiscal year", { exact: true })).toHaveValue(label);
  await page.getByRole("button", { name: "Set up" }).click();
  await expect(page.getByText(`FY ${label} set up`)).toBeVisible(); // saved before we navigate away
  await page.goto(`/admin/finance/year?fy=${encodeURIComponent(label)}`);
  await expect(page.getByRole("heading", { name: `Fiscal year ${label}` })).toBeVisible();
  await expect(page.getByText("Months in the year not closed")).toBeVisible();
  await expect(page.getByText("blocks closing").first()).toBeVisible();
  await expect(page.getByRole("button", { name: `Close FY ${label}` })).toBeDisabled();
  await expect(page.getByRole("cell", { name: `${ad}-07 (16–31)` })).toBeVisible();
  const href = await page.getByRole("link", { name: /Sales register/ }).getAttribute("href");
  expect(href).toBe(`/admin/finance/export/sales?from=${ad}-07-16&to=${ad + 1}-07-15`);
  expect((await page.request.get(href!)).status()).toBe(200);
});
