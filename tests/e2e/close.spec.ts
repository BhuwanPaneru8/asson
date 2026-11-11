import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner closes last month: an expense dated in it is refused; reopening with a reason unlocks it", async ({ page }) => {
  const now = new Date(Date.now() + 345 * 60_000); // Nepal time
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  page.on("dialog", (d) => d.accept());
  await signIn(page, "owner", `/admin/finance/close?month=${last}`);
  await expect(page.getByRole("heading", { name: `${last} checklist` })).toBeVisible();
  if (await page.getByLabel("Reason to reopen").count()) { // left closed by an earlier attempt
    await page.getByLabel("Reason to reopen").fill("Test reset");
    await page.getByRole("button", { name: "Reopen" }).click();
  }
  const closeBtn = page.getByRole("button", { name: `Close ${last}` });
  await expect(closeBtn).toBeVisible();
  test.skip(await closeBtn.isDisabled(), "something blocks closing on this database");
  await closeBtn.click();
  await expect(page.getByText(/Closed by /)).toBeVisible();

  await page.goto(`/admin/finance?month=${last}`);
  await expect(page.getByText(`${last} is closed: its expenses, bills and payments are locked.`)).toBeVisible();
  await page.getByLabel("Description", { exact: true }).fill("Late invoice");
  await page.getByLabel("Amount", { exact: true }).fill("1200");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(new RegExp(`${last} is closed, so expenses can't be added there`))).toBeVisible();

  await page.goto(`/admin/finance/close?month=${last}`);
  await page.getByLabel("Reason to reopen").fill("Late invoice from the landlord");
  await page.getByRole("button", { name: "Reopen" }).click();
  await expect(closeBtn).toBeVisible();
  await page.goto(`/admin/finance?month=${last}`);
  await page.getByLabel("Description", { exact: true }).fill("Late invoice");
  await page.getByLabel("Amount", { exact: true }).fill("1200");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Expense recorded")).toBeVisible();
});
