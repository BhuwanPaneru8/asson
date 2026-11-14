import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("cashier clocks in and asks for leave; the manager sees them working and approves", async ({ browser }) => {
  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, "cashier", "/admin/time");
  await cashier.getByRole("button", { name: /Clock in/ }).click();
  await expect(cashier.getByText(/Clocked in at/).first()).toBeVisible();
  await cashier.getByLabel("Type").selectOption("SICK");
  // a Monday two weeks out (Nepal time): leave on a Saturday counts 0 days and is refused, so "today" failed on
  // Saturdays; and the roster tests use the next few days, so leave then blocked their cells on Sundays
  const monday = (() => { const d = new Date(Date.now() + 5.75 * 3_600_000); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7) + 14); return d.toISOString().slice(0, 10); })();
  await cashier.getByLabel("First day").fill(monday);
  await cashier.getByLabel("Last day").fill(monday);
  await cashier.getByLabel("Reason (optional)").fill("dentist");
  await cashier.getByRole("button", { name: "Send request" }).click();
  await expect(cashier.getByText(/LV-\d{5} · Sick leave/)).toBeVisible();

  const manager = await (await browser.newContext()).newPage();
  await signIn(manager, "manager", "/admin/people");
  await expect(manager.getByText("Ram Cashier").first()).toBeVisible(); // working now
  await expect(manager.getByText(/“dentist”/)).toBeVisible();
  await manager.getByRole("button", { name: "Approve" }).click();
  await expect(manager.getByText("Nothing to decide.")).toBeVisible();

  await cashier.reload();
  await expect(cashier.getByText("approved")).toBeVisible();
  await cashier.getByRole("button", { name: "Clock out" }).click();
  await expect(cashier.getByText("Not clocked in")).toBeVisible();
});
