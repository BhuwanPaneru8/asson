import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner records a supplier credit note: it shows on the supplier's statement as credit", async ({ page }) => {
  await signIn(page, "owner", "/admin/payables");
  const supplier = page.getByLabel("Credit note supplier");
  const name = (await supplier.locator("option").nth(1).innerText()).trim();
  const supplierId = (await supplier.locator("option").nth(1).getAttribute("value"))!;
  await supplier.selectOption({ label: name });
  const ref = `E2E-CN-${Date.now()}`;
  await page.getByLabel("Credit note number").fill(ref);
  await page.getByLabel("Credit total").fill("1130");
  await page.getByLabel("Credit VAT").fill("130");
  await page.getByLabel("Credit reason").fill("price correction");
  await page.getByRole("button", { name: "Record credit note" }).click();
  await expect(page.getByText(/^CN-\d{5} recorded/)).toBeVisible();

  await page.goto(`/admin/payables/${supplierId}`);
  await expect(page.getByRole("row").filter({ hasText: ref })).toContainText("Rs. 1,130");
});
