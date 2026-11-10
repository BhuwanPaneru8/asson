import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("HQ sends a message and an opening checklist; the shop reads and ticks it; HQ sees both", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", "/admin/ops");
  await owner.getByLabel("Checklist name").fill("Opening");
  await owner.getByLabel("Items").fill("Lights and music on\nTill float counted");
  await owner.getByRole("button", { name: "Add checklist" }).click();
  await expect(owner.getByRole("columnheader", { name: /Opening/ })).toBeVisible();
  await owner.getByLabel("Title").fill("Dashain sale starts Friday");
  await owner.getByLabel("Message").fill("20% off all kurtas. New window posters in the box.");
  await owner.getByRole("button", { name: "Send" }).click();
  await expect(owner.getByText(/0 of \d+ read/)).toBeVisible();

  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, "cashier", "/admin/today");
  await expect(cashier.getByText("Dashain sale starts Friday")).toBeVisible();
  await cashier.getByRole("button", { name: "Got it" }).click();
  await expect(cashier.getByText(/· read/)).toBeVisible();
  await cashier.getByLabel("Lights and music on").check();
  await cashier.getByLabel("Till float counted").check();
  await expect(cashier.getByText("Done ✓")).toBeVisible();

  await owner.reload();
  await expect(owner.getByText(/1 of \d+ read/)).toBeVisible();
  await expect(owner.getByRole("row", { name: /Asson Flagship/ }).getByText(/✓/)).toBeVisible();
});
