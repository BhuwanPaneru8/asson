import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner sees payroll TDS and SSF dues, records a deposit and downloads the year's TDS by employee", async ({ page }) => {
  await signIn(page, "owner", "/admin/payroll");
  await page.getByRole("link", { name: "TDS and SSF deposits" }).click();
  await expect(page.getByRole("heading", { name: "TDS and SSF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Salary TDS by employee · FY \d{4}\/\d{2}/ })).toBeVisible();
  // the CSV for the e-TDS filing
  const href = await page.getByRole("link", { name: "Download CSV" }).getAttribute("href");
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(await res.text()).toMatch(/^\uFEFF?Fiscal year,Employee,PAN,Months paid,Gross salary,SSF employee 11%,TDS withheld/);
  // if a paid payroll left something to deposit (the payroll test pays one), record it
  const button = page.getByRole("button", { name: "Deposited" }).first();
  if (await button.count()) {
    const row = page.getByRole("listitem").filter({ has: button }).first();
    await row.getByLabel(/voucher$/).fill("CH-E2E-1");
    await button.click();
    await expect(page.getByText(/· CH-E2E-1/).first()).toBeVisible();
  }
});
