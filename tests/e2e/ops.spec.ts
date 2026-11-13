import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("HQ sends a message and an opening checklist; the shop reads and ticks it; HQ sees both", async ({ browser }, info) => {
  const tag = `${Date.now() % 100000}-${info.retry}`; // unique per attempt, so a retry doesn't see the first attempt's rows
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", "/admin/ops");
  await owner.getByLabel("Checklist name").fill(`Opening ${tag}`);
  await owner.getByLabel("Items").fill(`Lights on ${tag}\nTill float counted ${tag}`);
  await owner.getByRole("button", { name: "Add checklist" }).click();
  await expect(owner.getByRole("columnheader", { name: new RegExp(`Opening ${tag}`) })).toBeVisible();
  await owner.getByLabel("Title").fill(`Dashain sale ${tag}`);
  await owner.getByLabel("Message").fill("20% off all kurtas. New window posters in the box.");
  await owner.getByRole("button", { name: "Send" }).click();
  await expect(owner.getByText(/0 of \d+ read/).first()).toBeVisible();

  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, "cashier", "/admin/today");
  await expect(cashier.getByText(`Dashain sale ${tag}`)).toBeVisible();
  await cashier.getByRole("listitem").filter({ hasText: `Dashain sale ${tag}` }).getByRole("button", { name: "Got it" }).click();
  await expect(cashier.getByRole("listitem").filter({ hasText: `Dashain sale ${tag}` }).getByText(/· read/)).toBeVisible();
  await cashier.getByLabel(`Lights on ${tag}`).check();
  await cashier.getByLabel(`Till float counted ${tag}`).check();
  // the ticks show at once (optimistic): let both saves finish, then reload so we only move on once the server
  // has both (reloading straight away could cut off the second save: a flaky failure on 13 Nov 2026)
  await cashier.waitForLoadState("networkidle");
  await cashier.reload();
  await expect(cashier.getByText(new RegExp(`Opening ${tag} · 2/2`)).locator("xpath=..").getByText("Done ✓")).toBeVisible();

  await owner.reload();
  await expect(owner.getByText(/1 of \d+ read/).first()).toBeVisible();
  const col = await owner.getByRole("columnheader").evaluateAll((hs, name) => hs.findIndex((h) => h.textContent?.startsWith(name)), `Opening ${tag}`);
  await expect(owner.getByRole("row", { name: /Asson Flagship/ }).getByRole("cell").nth(col)).toHaveText(/^✓/);
});
