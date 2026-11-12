import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a missed shift: the manager books it as sick leave, takes it back, then records it unpaid; the cashier sees each outcome", async ({ browser }) => {
  const manager = await (await browser.newContext()).newPage();
  await signIn(manager, "manager", "/admin/people");
  await manager.getByRole("link", { name: /missed shift(s)? to decide/ }).first().click();
  await expect(manager.getByRole("heading", { name: "Missed shifts" })).toBeVisible();
  const row = manager.locator("li").filter({ hasText: "Ram Cashier" }).filter({ hasText: "rostered, never clocked in" });
  await expect(row).toContainText("Asson Flagship");

  // booked as sick leave
  await row.getByRole("button", { name: "Take as leave" }).click();
  await row.getByLabel("Kind of leave").selectOption("SICK");
  await row.getByLabel("Note (optional)").fill("phoned in sick");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(manager.getByText("Nothing to decide.")).toBeVisible();
  const decided = manager.locator("li").filter({ hasText: "Ram Cashier" }).filter({ hasText: "Taken as leave" });
  await expect(decided).toContainText(/Sick leave · LV-\d{5}/);

  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, "cashier", "/admin/time");
  await expect(cashier.getByText("taken as leave")).toBeVisible();

  // taken back, then recorded as unpaid (with a confirmation)
  manager.once("dialog", (d) => d.accept("wrong day on the doctor's note"));
  await decided.getByRole("button", { name: "Take back" }).click();
  await expect(manager.getByText("rostered, never clocked in")).toBeVisible();
  manager.once("dialog", (d) => d.accept());
  await manager.locator("li").filter({ hasText: "rostered, never clocked in" }).getByRole("button", { name: "Unpaid" }).click();
  await expect(manager.getByText("Nothing to decide.")).toBeVisible();
  await expect(manager.locator("li").filter({ hasText: "Ram Cashier" }).filter({ hasText: "Unpaid" })).toBeVisible();

  await cashier.reload();
  await expect(cashier.getByText("unpaid", { exact: true })).toBeVisible();
});
