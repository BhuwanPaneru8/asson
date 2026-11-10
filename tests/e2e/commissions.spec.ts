import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("owner sets 1% commission; the cashier sells at the till and sees what they've earned", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", "/admin/payroll/commissions");
  await owner.getByLabel("Every shop rate").fill("1");
  await owner.getByRole("row", { name: /Every shop/ }).getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Every shop saved")).toBeVisible();

  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, "cashier");
  await cashier.getByLabel("Opening cash (Rs.)").fill("5000");
  await cashier.getByRole("button", { name: "Open shift" }).click();
  const scan = cashier.getByLabel("Scan or search");
  await scan.fill("AS-01104");
  await scan.press("Enter");
  await expect(cashier.getByText("Oxford Button-Down Shirt")).toBeVisible();
  await cashier.getByRole("button", { name: "Cash", exact: true }).click();
  await cashier.getByLabel("Cash received").fill("3000");
  await cashier.getByRole("button", { name: /Complete sale/ }).click();
  await expect(cashier.getByText("Sale complete", { exact: false })).toBeVisible();

  // leave the till as we found it (other tests open their own shift)
  await cashier.getByRole("button", { name: "New sale" }).click();
  await cashier.getByRole("button", { name: "Close shift" }).click();
  await cashier.getByLabel("Cash counted (Rs.)").fill("7399");
  await cashier.getByRole("button", { name: "Close shift" }).last().click();
  await expect(cashier.getByText("Shift closed")).toBeVisible();

  await cashier.goto("/admin/time");
  await expect(cashier.getByText(/1 sale · Rs\. 2,123 excl\. VAT/)).toBeVisible(); // Rs 2,399 less 13% VAT
  await expect(cashier.getByText("commission so far")).toBeVisible();
  await expect(cashier.getByText("Rs. 21", { exact: true })).toBeVisible(); // 1%
});
