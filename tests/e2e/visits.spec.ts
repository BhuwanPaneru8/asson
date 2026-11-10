import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("an area visit: HQ walks the Flagship, a critical fail becomes a fix; the shop acknowledges and fixes it; HQ verifies", async ({ browser }, info) => {
  const tag = `${Date.now() % 100000}-${info.retry}`;
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", "/admin/visits");
  await owner.getByLabel("Checklist name").last().fill(`Monthly visit ${tag}`);
  await owner.getByRole("button", { name: "Add checklist" }).click();
  await expect(owner.getByLabel("Visit checklist")).toContainText(`Monthly visit ${tag}`);

  // a draft left by an earlier failed attempt would block a new one: delete it first
  const draft = owner.getByRole("row", { name: /Asson Flagship/ }).getByRole("link", { name: "visit in progress" });
  if (await draft.count()) { await draft.click(); owner.once("dialog", (d) => d.accept()); await owner.getByRole("button", { name: "Delete draft" }).click(); await expect(owner).toHaveURL(/\/admin\/visits$/); }

  await owner.getByLabel("Visit checklist").selectOption({ label: `Monthly visit ${tag}` });
  await owner.getByLabel("Shop to visit").selectOption({ label: "Asson Flagship" });
  await owner.getByRole("button", { name: "Start visit" }).click();
  await expect(owner).toHaveURL(/\/admin\/visits\/\d+$/);
  const url = owner.url();

  const groups = owner.getByRole("radiogroup");
  const n = await groups.count();
  expect(n).toBe(12);
  for (let i = 0; i < n; i++) await groups.nth(i).getByRole("radio", { name: "Pass" }).click();
  await owner.getByRole("radiogroup", { name: "Fire extinguisher in date and reachable" }).getByRole("radio", { name: "Fail" }).click();
  await expect(owner.getByRole("button", { name: "Submit visit" })).toBeEnabled();
  await owner.getByRole("button", { name: "Submit visit" }).click();
  await expect(owner.getByText(/Say what's wrong for 1 failed item/)).toBeVisible();
  await owner.getByLabel("Note: Fire extinguisher in date and reachable").fill("Expired in August");
  await owner.getByLabel("Visit summary").click(); // blur saves the note
  await owner.getByLabel("Visit summary").fill("Floor looks great. Replace the extinguisher today.");
  await owner.getByRole("button", { name: "Submit visit" }).click();
  await expect(owner.getByText("92%")).toBeVisible(); // 11 of 12 passed
  await expect(owner.getByText("1 critical").first()).toBeVisible();

  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, "cashier", "/admin/today");
  const flagship = cashier.getByRole("link", { name: "Asson Flagship", exact: true });
  if (await flagship.count()) await flagship.click();
  await expect(cashier.getByText("Safety: Fire extinguisher in date and reachable").first()).toBeVisible();
  await cashier.goto(url);
  await cashier.getByRole("button", { name: "I've read this visit" }).click();
  await expect(cashier.getByText(/Acknowledged by Ram Cashier/)).toBeVisible();
  await cashier.getByRole("button", { name: "Mark fixed" }).click();
  await cashier.getByLabel("What was done").fill("New extinguisher fitted by the door");
  await cashier.getByRole("button", { name: "Save" }).click();
  await expect(cashier.getByText(/Fixed by Ram Cashier/)).toBeVisible();

  await owner.reload();
  await owner.getByRole("button", { name: "Verify fix" }).click();
  await expect(owner.getByText(/Fixed and verified/)).toBeVisible();
  await expect(owner.getByText("Nothing to fix").or(owner.getByText("To fix · 0 open"))).toBeVisible();
});
