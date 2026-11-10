import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("owner pays the month: pay terms, confirmed tax bands, build, approve, paid; the cashier sees the payslip", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  owner.on("dialog", (d) => d.accept(d.type() === "prompt" ? "Bank transfer" : undefined));
  await signIn(owner, "owner", "/admin/payroll/staff");
  await owner.getByLabel("Ram Cashier basic salary").fill("26000");
  await owner.getByRole("row", { name: /Ram Cashier/ }).getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Ram Cashier saved")).toBeVisible();

  await owner.goto("/admin/payroll/tax");
  await owner.getByRole("button", { name: "Save", exact: true }).click();
  await expect(owner.getByText(/saved, not confirmed/)).toBeVisible();
  await owner.getByRole("button", { name: "Confirm for payroll" }).click();
  await expect(owner.getByText(/· confirmed/).first()).toBeVisible();

  await owner.goto("/admin/payroll");
  await owner.getByLabel("Payroll month").selectOption({ index: 1 }); // this month
  await owner.getByRole("button", { name: "Build payroll" }).click();
  await expect(owner.getByRole("heading", { name: /Payroll \d{4}-\d{2}/ })).toBeVisible();
  const row = owner.getByRole("row", { name: /Ram Cashier/ });
  await expect(row.getByText("Rs. 26,000").first()).toBeVisible();
  await owner.getByRole("button", { name: "Approve" }).click();
  await owner.getByRole("button", { name: "Mark salaries paid" }).click();
  await expect(owner.getByText(/paid \d/)).toBeVisible();

  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, "cashier", "/admin/time");
  await cashier.getByRole("link", { name: /net/ }).first().click();
  await expect(cashier.getByText("Net pay")).toBeVisible();
  await expect(cashier.getByText("Ram Cashier")).toBeVisible();
});
